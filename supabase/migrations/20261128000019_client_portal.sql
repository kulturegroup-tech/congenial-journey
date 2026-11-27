-- Client portal (Ankit's item 4). A client contact opens a private link, types a 6-digit code, and
-- sees the CVs shared with them: only for the mandates they are on (main contact or copied), only
-- the details (name, current role and firm, PQE, city, practice, which role, when, where it stands),
-- never the CV file, phone, email or pay. They can mark each one Shortlist / Interview / Hold /
-- Not a fit with a note; the candidate's owner gets a notification and moves the stage themselves.
--
-- Clients never sign in to Supabase. Everything they do goes through the portal_* functions below,
-- which check the link and session themselves; the tables have no policies for anyone outside
-- the team.
--
-- portal_access    one per contact: the link (kept so the team can copy it again), the code (hashed,
--                  shown once when made), on/off, and a lock after 5 wrong codes (15 minutes)
-- portal_sessions  a signed-in browser: only a hash of its token is kept; 12 hours
-- portal_feedback  what a contact said about a shared CV; the latest one counts

create table portal_access (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null unique references client_contacts (id) on delete cascade,
  client_id     uuid not null references clients (id) on delete cascade,
  link_token    text not null unique,
  code_hash     text not null,
  code_set_at   timestamptz not null default now(),
  created_by    uuid references team_members (id) on delete set null,
  created_at    timestamptz not null default now(),
  turned_off_at timestamptz,
  failed_tries  int not null default 0,
  locked_until  timestamptz,
  last_seen_at  timestamptz
);
create index portal_access_client_idx on portal_access (client_id);
create index portal_access_created_by_idx on portal_access (created_by);

create table portal_sessions (
  token_hash  text primary key,
  access_id   uuid not null references portal_access (id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index portal_sessions_access_idx on portal_sessions (access_id);

create table portal_feedback (
  id           uuid primary key default gen_random_uuid(),
  cv_share_id  uuid not null references cv_shares (id) on delete cascade,
  contact_id   uuid not null references client_contacts (id) on delete cascade,
  verdict      text not null check (verdict in ('shortlist', 'interview', 'hold', 'not_a_fit')),
  note         text check (char_length(note) <= 2000),
  created_at   timestamptz not null default now()
);
create index portal_feedback_share_idx on portal_feedback (cv_share_id, created_at desc);
create index portal_feedback_contact_idx on portal_feedback (contact_id);

alter table portal_access   enable row level security;
alter table portal_sessions enable row level security;
alter table portal_feedback enable row level security;
create policy team_read on portal_access   for select to authenticated using ((select is_team_member()));
create policy team_read on portal_feedback for select to authenticated using ((select is_team_member()));
-- portal_sessions: no policies. Only the functions below touch it.

-- 64 hex characters from two random UUIDs (244 random bits): links and session tokens.
create function portal_random_token() returns text
language sql volatile set search_path = public as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

-- Six digits, from the random part of a UUID.
create function portal_random_code() returns text
language sql volatile set search_path = public as $$
  select lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0')
$$;

create function portal_hash(p_token text) returns text
language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

-- ---------------------------------------------------------------- the team (admins only)

-- Turns the portal on for a contact, or gives them a new code. The code is returned once and only
-- its hash is kept. The link stays the same unless p_new_link; either way, open sessions end.
create function portal_new_code(p_contact uuid, p_new_link boolean default false)
returns table (link_token text, code text)
language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
  v_code   text := portal_random_code();
  v_access portal_access;
begin
  if not is_admin() then
    raise exception 'Only an admin can give clients access to the portal' using errcode = '42501';
  end if;
  select cc.client_id into v_client from client_contacts cc where cc.id = p_contact;
  if v_client is null then
    raise exception 'Contact not found' using errcode = 'P0002';
  end if;

  insert into portal_access (contact_id, client_id, link_token, code_hash, created_by)
  values (p_contact, v_client, portal_random_token(), extensions.crypt(v_code, extensions.gen_salt('bf')), auth.uid())
  on conflict (contact_id) do update
     set code_hash     = excluded.code_hash,
         code_set_at   = now(),
         link_token    = case when p_new_link then excluded.link_token else portal_access.link_token end,
         turned_off_at = null,
         failed_tries  = 0,
         locked_until  = null
  returning * into v_access;

  delete from portal_sessions s where s.access_id = v_access.id;
  return query select v_access.link_token, v_code;
end $$;

create function portal_turn_off(p_contact uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Only an admin can turn the portal off' using errcode = '42501';
  end if;
  update portal_access set turned_off_at = now() where contact_id = p_contact and turned_off_at is null;
  delete from portal_sessions s using portal_access a where s.access_id = a.id and a.contact_id = p_contact;
end $$;

-- Undo for turning it off: the same link and code work again.
create function portal_turn_on(p_contact uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Only an admin can turn the portal on' using errcode = '42501';
  end if;
  update portal_access set turned_off_at = null, failed_tries = 0, locked_until = null where contact_id = p_contact;
end $$;

-- ---------------------------------------------------------------- the client

-- The link and code in, a session token out (or why not). Five wrong codes lock it for 15 minutes.
create function portal_sign_in(p_link text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_access portal_access;
  v_token  text;
begin
  select * into v_access from portal_access where link_token = p_link and turned_off_at is null;
  if v_access.id is null then
    return jsonb_build_object('error', 'link');
  end if;
  if v_access.locked_until > now() then
    return jsonb_build_object('error', 'locked', 'until', v_access.locked_until);
  end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' or extensions.crypt(p_code, v_access.code_hash) <> v_access.code_hash then
    update portal_access
       set failed_tries = case when failed_tries + 1 >= 5 then 0 else failed_tries + 1 end,
           locked_until = case when failed_tries + 1 >= 5 then now() + interval '15 minutes' else null end
     where id = v_access.id;
    if v_access.failed_tries + 1 >= 5 then
      return jsonb_build_object('error', 'locked', 'until', now() + interval '15 minutes');
    end if;
    return jsonb_build_object('error', 'code', 'tries_left', 5 - (v_access.failed_tries + 1));
  end if;

  v_token := portal_random_token();
  update portal_access set failed_tries = 0, locked_until = null, last_seen_at = now() where id = v_access.id;
  delete from portal_sessions s where s.access_id = v_access.id and s.expires_at < now();
  insert into portal_sessions (token_hash, access_id, expires_at) values (portal_hash(v_token), v_access.id, now() + interval '12 hours');
  return jsonb_build_object('token', v_token);
end $$;

-- The access a link and session token belong to, if both are good. Not callable from outside.
create function portal_session_access(p_link text, p_token text) returns portal_access
language sql stable security definer set search_path = public as $$
  select a.* from portal_access a
  join portal_sessions s on s.access_id = a.id
  where a.link_token = p_link and a.turned_off_at is null
    and s.token_hash = portal_hash(p_token) and s.expires_at > now()
$$;

-- Where a shared CV stands, in the client's terms.
create function portal_status(p_stage pipeline_stage, p_exit text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_exit is not null then 'closed'
    when p_stage = 'joined' then 'joined'
    when p_stage >= 'offer' then 'offer'
    when p_stage >= 'interview' then 'interviewing'
    else 'with_you'
  end
$$;

-- Everything the signed-in contact may see. Null when the session isn't good (sign in again).
create function portal_view(p_link text, p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_access portal_access := portal_session_access(p_link, p_token);
begin
  if v_access.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'firm', (select s.firm_name from settings s where s.id),
    'client', (select cl.display_name from clients cl where cl.id = v_access.client_id),
    'contact', (select cc.name from client_contacts cc where cc.id = v_access.contact_id),
    'shares', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', cs.id,
               'shared_at', cs.shared_at,
               'name', c.full_name,
               'designation', c.designation,
               'current_firm', f.name,
               'pqe', pqe_years(c.practice_start_date),
               'city', c.current_city,
               'practice_areas', c.practice_areas,
               'mandate', m.title,
               'mandate_city', m.city,
               'status', portal_status(pe.stage, pe.exit_reason),
               'feedback', (select jsonb_build_object('verdict', pf.verdict, 'note', pf.note, 'at', pf.created_at)
                              from portal_feedback pf
                             where pf.cv_share_id = cs.id and pf.contact_id = v_access.contact_id
                             order by pf.created_at desc limit 1)
             ) order by cs.shared_at desc)
        from cv_shares cs
        join mandates m on m.id = cs.mandate_id
        join candidates c on c.id = cs.candidate_id
        join pipeline_entries pe on pe.id = cs.pipeline_entry_id
        left join firms f on f.id = c.current_firm_id
       where cs.client_id = v_access.client_id
         and m.client_id = v_access.client_id
         and v_access.contact_id = any (m.contact_ids)
    ), '[]'::jsonb)
  );
end $$;

-- A contact's verdict on one shared CV. Tells the candidate's owner (or whoever shared it).
create function portal_give_feedback(p_link text, p_token text, p_share uuid, p_verdict text, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_access portal_access := portal_session_access(p_link, p_token);
  v_share  record;
  v_note   text := nullif(btrim(left(coalesce(p_note, ''), 2000)), '');
begin
  if v_access.id is null then
    return jsonb_build_object('error', 'session');
  end if;
  if p_verdict is null or p_verdict not in ('shortlist', 'interview', 'hold', 'not_a_fit') then
    return jsonb_build_object('error', 'verdict');
  end if;
  select cs.id, cs.candidate_id, cs.mandate_id, coalesce(pe.owner_id, cs.shared_by) as tell, c.full_name,
         cl.display_name as client, cc.name as contact
    into v_share
    from cv_shares cs
    join mandates m on m.id = cs.mandate_id
    join pipeline_entries pe on pe.id = cs.pipeline_entry_id
    join candidates c on c.id = cs.candidate_id
    join clients cl on cl.id = cs.client_id
    join client_contacts cc on cc.id = v_access.contact_id
   where cs.id = p_share
     and cs.client_id = v_access.client_id
     and m.client_id = v_access.client_id
     and v_access.contact_id = any (m.contact_ids);
  if v_share.id is null then
    return jsonb_build_object('error', 'share');
  end if;

  insert into portal_feedback (cv_share_id, contact_id, verdict, note) values (p_share, v_access.contact_id, p_verdict, v_note);
  if v_share.tell is not null then
    insert into notifications (recipient_id, kind, title, body, mandate_id, candidate_id)
    values (v_share.tell, 'client_feedback',
            format('%s (%s): %s for %s', v_share.contact, v_share.client,
                   case p_verdict when 'shortlist' then 'shortlisted' when 'interview' then 'wants to interview'
                                  when 'hold' then 'on hold' else 'not a fit' end,
                   v_share.full_name),
            left(v_note, 300), v_share.mandate_id, v_share.candidate_id);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create function portal_sign_out(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from portal_sessions where token_hash = portal_hash(p_token)
$$;

-- Who may call what. The helpers are for these functions only.
revoke execute on function portal_random_token(), portal_random_code(), portal_hash(text),
  portal_session_access(text, text), portal_status(pipeline_stage, text) from public, anon, authenticated;
revoke execute on function portal_new_code(uuid, boolean), portal_turn_off(uuid), portal_turn_on(uuid) from public, anon;
grant execute on function portal_new_code(uuid, boolean), portal_turn_off(uuid), portal_turn_on(uuid) to authenticated;
revoke execute on function portal_sign_in(text, text), portal_view(text, text),
  portal_give_feedback(text, text, uuid, text, text), portal_sign_out(text) from public;
grant execute on function portal_sign_in(text, text), portal_view(text, text),
  portal_give_feedback(text, text, uuid, text, text), portal_sign_out(text) to anon, authenticated;
