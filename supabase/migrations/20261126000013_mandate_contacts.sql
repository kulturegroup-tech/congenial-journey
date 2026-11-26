-- The client's points of contact for each mandate (Ankit's feedback): who at the client this role
-- is with, so the CV share goes to the right partner and the team knows whom to chase.
-- A client already has many contacts (client_contacts); a mandate now names which of them it's with.
-- Only that client's contacts can be picked. Removing a contact takes them off every mandate.

alter table mandates add column contact_ids uuid[] not null default '{}';
create index mandates_contacts_idx on mandates using gin (contact_ids);

create function mandate_contacts_check() returns trigger
language plpgsql set search_path = public as $$
declare
  v_bad uuid;
begin
  -- Tidy: no repeats, order kept (the first is the main contact).
  new.contact_ids := coalesce((
    select array_agg(x order by n)
    from (select distinct on (x) x, n from unnest(new.contact_ids) with ordinality u (x, n) where x is not null order by x, n) d), '{}');

  -- Moving the mandate to another client drops the old client's contacts.
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    new.contact_ids := coalesce((
      select array_agg(x order by n) from unnest(new.contact_ids) with ordinality u (x, n)
      where exists (select 1 from client_contacts cc where cc.id = u.x and cc.client_id = new.client_id)), '{}');
  end if;

  select x into v_bad from unnest(new.contact_ids) x
  where not exists (select 1 from client_contacts cc where cc.id = x and cc.client_id = new.client_id) limit 1;
  if v_bad is not null then
    raise exception 'That contact belongs to another client' using hint = 'Pick contacts of this mandate''s client.';
  end if;
  return new;
end $$;

create trigger mandates_contacts_check before insert or update on mandates
  for each row execute function mandate_contacts_check();

create function client_contact_unlink() returns trigger
language plpgsql set search_path = public as $$
begin
  update mandates set contact_ids = array_remove(contact_ids, old.id) where old.id = any (contact_ids);
  return old;
end $$;

create trigger client_contacts_unlink after delete on client_contacts
  for each row execute function client_contact_unlink();
