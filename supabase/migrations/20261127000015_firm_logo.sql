-- The firm's own logo, for the cover page put in front of a CV when it's shared (Ankit's list, step 3).
-- Uploaded by an admin in Settings, never hard-coded, so each firm's copy shows its own.
--
-- branding/<file>     private bucket, like every other; the whole team reads it (the cover is
--                     built in the browser), only admins add, change or remove files.
-- settings.logo_path  which file in it is the logo now; null = no logo (the cover shows the firm name).

alter table settings add column logo_path text;

insert into storage.buckets (id, name, public)
values ('branding', 'branding', false)
on conflict (id) do nothing;

create policy team_read_branding on storage.objects for select to authenticated
  using (bucket_id = 'branding' and (select public.is_team_member()));

create policy admin_upload_branding on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and (select public.is_admin()));

create policy admin_update_branding on storage.objects for update to authenticated
  using (bucket_id = 'branding' and (select public.is_admin()))
  with check (bucket_id = 'branding' and (select public.is_admin()));

create policy admin_delete_branding on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and (select public.is_admin()));
