-- 1. Close a gap: a pipeline entry could be INSERTED straight at 'cv_shared' or later, skipping the
--    share (and its duplicate check). Now only an import (app.bypass_guards = on) can do that.
-- 2. Import from Odoo exports and sheet tabs, one row at a time, into import_rows and the real tables.

create or replace function pipeline_before() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := coalesce(new.owner_id, auth.uid(), (select owner_id from mandates where id = new.mandate_id));
    if new.stage >= 'cv_shared' and coalesce(current_setting('app.bypass_guards', true), 'off') <> 'on' then
      raise exception 'Log the CV share first: it runs the duplicate check';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    -- A CV can only reach the client through cv_shares, which runs the duplicate check.
    if new.stage >= 'cv_shared' and old.stage < 'cv_shared'
       and coalesce(current_setting('app.bypass_guards', true), 'off') <> 'on'
       and not exists (select 1 from cv_shares where pipeline_entry_id = new.id) then
      raise exception 'Log the CV share first: it runs the duplicate check';
    end if;
  end if;
  if new.exit_reason is not null and (tg_op = 'INSERT' or old.exit_reason is null) then
    new.exited_at := now();
  elsif new.exit_reason is null then
    new.exited_at := null;
  end if;
  return new;
end $$;

-- Odoo stage names and the words people use in the sheets' Status column → stage and exit.
create function import_stage(raw text, out stage pipeline_stage, out exit_reason text)
language plpgsql immutable as $$
declare
  s text := lower(regexp_replace(trim(coalesce(raw, '')), '\s+', ' ', 'g'));
begin
  stage := 'mapped';
  exit_reason := null;
  case
    -- Odoo, exactly as exported
    when s = 'yet to speak' then stage := 'mapped';
    when s = 'relevant' then stage := 'called';
    when s in ('awaiting candidate feedback', 'awaiting cv') then stage := 'pitched';
    when s = 'cv received' then stage := 'confirmed';
    when s = 'shared profiles' then stage := 'cv_shared';
    when s = 'interviewed' then stage := 'interview';
    when s = 'advanced interview' then stage := 'final_round';
    when s = 'offer made' then stage := 'offer';
    when s = 'offer accepted' then stage := 'documents';
    when s = 'billed and closed' then stage := 'joined';
    when s = 'not interested' then stage := 'called'; exit_reason := 'rejected_role';
    when s = 'rejected' then stage := 'cv_shared'; exit_reason := 'client_rejected_cv';
    when s = 'duplicate' then stage := 'confirmed'; exit_reason := 'duplicate';
    when s = 'not relevant but interested' then stage := 'called'; exit_reason := 'not_a_fit';
    -- free text from the sheets
    when s = '' then stage := 'mapped';
    when s ~ 'not (interested|keen)|declined|^no$' then stage := 'called'; exit_reason := 'rejected_role';
    when s ~ 'no response|not respond|not reachable|unreachable|didn.?t pick' then stage := 'mapped'; exit_reason := 'no_response';
    when s ~ 'duplicate' then stage := 'confirmed'; exit_reason := 'duplicate';
    when s ~ 'reject' then stage := 'cv_shared'; exit_reason := 'client_rejected_cv';
    when s ~ 'joined' then stage := 'joined';
    when s ~ 'offer' then stage := 'offer';
    when s ~ 'final' then stage := 'final_round';
    when s ~ 'assignment' then stage := 'assignment';
    when s ~ 'interview' then stage := 'interview';
    when s ~ 'shared|sent to client|submitted' then stage := 'cv_shared';
    when s ~ 'cv (received|recd)|got cv' then stage := 'confirmed';
    when s ~ 'interested|^yes$|awaiting cv|pitched' then stage := 'pitched';
    when s ~ 'called|spoke|spoken|relevant' then stage := 'called';
    else stage := 'mapped';
  end case;
end $$;

-- Recruiter as written in the source (full name, email or first name) → team member.
create function import_member(raw text) returns uuid
language sql stable set search_path = public as $$
  select id from team_members t
  where nullif(trim(raw), '') is not null
    and (lower(t.email) = lower(trim(raw))
         or lower(t.full_name) = lower(trim(raw))
         or split_part(lower(t.full_name), ' ', 1) = split_part(lower(trim(raw)), ' ', 1)
         or split_part(lower(t.email), '@', 1) = lower(split_part(trim(raw), '@', 1)))
  order by (lower(t.email) = lower(trim(raw))) desc, (lower(t.full_name) = lower(trim(raw))) desc, t.active desc
  limit 1
$$;

-- One source row. Matches on LinkedIn, then phone, then email; otherwise creates the candidate.
-- Near-matches (similar name, same or unknown firm), unreadable PQE and phones that belong to someone
-- else are imported but flagged for review. With a mandate, the row also lands on that pipeline.
create function import_one(p_batch text, p_n int, p jsonb, p_mandate uuid default null) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
  v_row      bigint;
  v_name     text := nullif(regexp_replace(trim(coalesce(p->>'name', '')), '\s+', ' ', 'g'), '');
  v_li       text := nullif(trim(coalesce(p->>'linkedin', '')), '');
  v_slug     text := linkedin_slug(nullif(trim(coalesce(p->>'linkedin', '')), ''));
  v_phones   text[] := normalize_phones(coalesce(p->>'phone', ''));
  v_email    text := nullif(lower(trim(coalesce(p->>'email', ''))), '');
  v_firm_raw text := nullif(trim(coalesce(p->>'firm', '')), '');
  v_pqe_raw  text := nullif(trim(coalesce(p->>'pqe', '')), '');
  v_comment  text := nullif(trim(coalesce(p->>'comments', '')), '');
  v_owner    uuid := import_member(p->>'recruiter');
  v_source   candidate_source := case when p_batch like 'odoo%' then 'odoo_import' else 'sheet_import' end;
  v_start    date;
  v_firm     uuid;
  v_cand     uuid;
  v_dup_id   uuid;
  v_dup_name text;
  v_holder   uuid;
  v_ph       text;
  v_stage    pipeline_stage;
  v_exit     text;
  v_status   text := 'imported';
  v_issues   text[] := '{}';
begin
  if auth.uid() is not null and not is_admin() then raise exception 'Only an admin can import'; end if;
  insert into import_rows (batch, row_number, raw) values (p_batch, p_n, p) returning id into v_row;
  if v_name is null then
    update import_rows set status = 'skipped', issue = 'No name' where id = v_row;
    return jsonb_build_object('status', 'skipped', 'issue', 'No name');
  end if;

  if v_pqe_raw is not null then
    v_start := parse_sheet_pqe(v_pqe_raw);
    if v_start is null then v_issues := v_issues || format('PQE "%s" unreadable', v_pqe_raw); end if;
  end if;
  if v_li is not null and v_slug is null then v_issues := v_issues || 'LinkedIn link not recognised'; end if;
  v_firm := resolve_firm(v_firm_raw, true);

  select id into v_cand from candidates where v_slug is not null and linkedin_slug = v_slug;
  if v_cand is null and cardinality(v_phones) > 0 then
    select candidate_id into v_cand from candidate_phones where phone = any (v_phones) limit 1;
  end if;
  if v_cand is null and v_email is not null then
    select candidate_id into v_cand from candidate_emails where email = v_email limit 1;
  end if;

  if v_cand is not null then
    v_status := 'merged';
    update candidates set
      linkedin_url        = coalesce(linkedin_url, case when v_slug is not null then v_li end),
      current_firm_id     = coalesce(current_firm_id, v_firm),
      current_firm_raw    = coalesce(current_firm_raw, v_firm_raw),
      practice_start_date = coalesce(practice_start_date, v_start),
      pqe_recorded        = coalesce(pqe_recorded, v_pqe_raw),
      owner_id            = coalesce(owner_id, v_owner)
    where id = v_cand;
  else
    select c.id, c.full_name into v_dup_id, v_dup_name from candidates c
    where c.full_name % v_name and similarity(c.full_name, v_name) > 0.6
      and (v_firm is null or c.current_firm_id is null or c.current_firm_id = v_firm)
    order by similarity(c.full_name, v_name) desc
    limit 1;
    insert into candidates (full_name, linkedin_url, current_firm_id, current_firm_raw, practice_start_date, pqe_recorded, source, owner_id)
    values (v_name, v_li, v_firm, v_firm_raw, v_start, v_pqe_raw, v_source, v_owner)
    returning id into v_cand;
    if v_dup_id is not null then v_issues := v_issues || format('Possible duplicate of %s', v_dup_name); end if;
  end if;

  foreach v_ph in array v_phones loop
    select candidate_id into v_holder from candidate_phones where phone = v_ph;
    if v_holder is null then
      insert into candidate_phones (candidate_id, phone, raw, source)
      values (v_cand, v_ph, p->>'phone', v_source::text::contact_source);
    elsif v_holder <> v_cand then
      v_issues := v_issues || format('Phone %s is already on another candidate', v_ph);
    end if;
  end loop;
  if v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    insert into candidate_emails (candidate_id, email) values (v_cand, v_email) on conflict do nothing;
  end if;

  if p_mandate is not null then
    select s.stage, s.exit_reason into v_stage, v_exit from import_stage(p->>'stage') s;
    perform set_config('app.bypass_guards', 'on', true);
    insert into pipeline_entries (candidate_id, mandate_id, stage, exit_reason, exit_note, owner_id)
    values (v_cand, p_mandate, v_stage, v_exit, case when v_exit is not null then v_comment end, v_owner)
    on conflict (candidate_id, mandate_id) do update
      set stage = greatest(pipeline_entries.stage, excluded.stage);
    perform set_config('app.bypass_guards', 'off', true);
    -- "Not relevant but interested": they want this client, so a future mandate there alerts us.
    if v_exit = 'not_a_fit' then
      insert into interest_tags (candidate_id, firm_id, city, not_taken_reason)
      select v_cand, cl.firm_id, m.city, format('Not relevant for %s, but interested', m.title)
      from mandates m join clients cl on cl.id = m.client_id
      where m.id = p_mandate
        and not exists (select 1 from interest_tags t where t.candidate_id = v_cand and t.firm_id = cl.firm_id);
    end if;
  end if;
  if v_comment is not null and v_exit is null then
    update candidates set review_note = left(concat_ws(E'\n', review_note, v_comment), 2000) where id = v_cand;
  end if;

  if cardinality(v_issues) > 0 then
    v_status := 'needs_review';
    update candidates set needs_review = true where id = v_cand;
  end if;
  update import_rows
  set status = v_status, candidate_id = v_cand, issue = nullif(array_to_string(v_issues, '; '), ''),
      raw = raw || case when v_dup_id is not null then jsonb_build_object('_possible_duplicate', v_dup_id) else '{}'::jsonb end
  where id = v_row;
  return jsonb_build_object('status', v_status, 'candidate_id', v_cand, 'issue', array_to_string(v_issues, '; '));
end $$;

-- A batch from the import screen: [{ "n": 12, "data": {...}, "mandate_id": "..." }, ...].
-- A row that errors is recorded for review and the rest carry on.
create function import_batch(p_batch text, p_rows jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare
  r    jsonb;
  res  jsonb := '[]';
  one  jsonb;
begin
  if auth.uid() is not null and not is_admin() then raise exception 'Only an admin can import'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      one := import_one(p_batch, (r->>'n')::int, r->'data', nullif(r->>'mandate_id', '')::uuid);
    exception when others then
      insert into import_rows (batch, row_number, raw, status, issue)
      values (p_batch, (r->>'n')::int, r->'data', 'needs_review', sqlerrm);
      one := jsonb_build_object('status', 'needs_review', 'issue', sqlerrm);
    end;
    res := res || jsonb_build_array(one || jsonb_build_object('n', r->'n'));
  end loop;
  return res;
end $$;

revoke execute on function import_one(text, int, jsonb, uuid), import_batch(text, jsonb), import_stage(text), import_member(text) from public, anon;
