-- Helpers the screens call. Logic stays in the database, like the rest of the rules.

-- Finds a firm by name or alias (case-insensitive, extra spaces ignored); creates it if asked and missing.
create function resolve_firm(p_name text, p_create boolean default true) returns uuid
language plpgsql set search_path = public as $$
declare
  v_name text := nullif(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
  v_id   uuid;
begin
  if v_name is null then return null; end if;
  select id into v_id from firms
  where lower(name) = lower(v_name)
     or exists (select 1 from unnest(aliases) a where lower(a) = lower(v_name))
  order by (lower(name) = lower(v_name)) desc
  limit 1;
  if v_id is null and p_create then
    insert into firms (name) values (v_name) returning id into v_id;
  end if;
  return v_id;
end $$;

-- Admin adds or updates a team member who signs in with email + PIN.
-- Creates the login if it doesn't exist; sets the PIN when one is given.
create function admin_upsert_member(p_email text, p_full_name text, p_pin text default null, p_is_admin boolean default false)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(trim(p_email));
  v_id    uuid;
begin
  if auth.uid() is not null and not is_admin() then raise exception 'Only an admin can manage the team'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Enter a name'; end if;
  if p_pin is not null and p_pin !~ '^[0-9]{6,12}$' then raise exception 'PIN must be 6 to 12 digits'; end if;

  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is null then
    if p_pin is null then raise exception 'Set a PIN for a new member'; end if;
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
            crypt(p_pin, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
            '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
            'email', now(), now(), now());
  elsif p_pin is not null then
    update auth.users set encrypted_password = crypt(p_pin, gen_salt('bf')),
                          email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
    where id = v_id;
  end if;

  insert into team_members (id, full_name, email, is_admin, active)
  values (v_id, trim(p_full_name), v_email, p_is_admin, true)
  on conflict (id) do update set full_name = excluded.full_name, is_admin = excluded.is_admin, active = true;
  return v_id;
end $$;

revoke execute on function admin_upsert_member(text, text, text, boolean) from public, anon;
revoke execute on function resolve_firm(text, boolean) from public, anon;
