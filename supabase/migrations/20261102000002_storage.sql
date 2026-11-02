-- Private file buckets. Files open only through short-lived signed URLs, for signed-in team members.
--   candidate-files/<candidate_id>/<uuid>.<ext>   CVs and other candidate documents
--   agreements/<client_id>/<file>                 signed LoEs and client agreements
--   invoices/<invoice_number>.pdf                 generated invoice PDFs

insert into storage.buckets (id, name, public)
values ('candidate-files', 'candidate-files', false),
       ('agreements',      'agreements',      false),
       ('invoices',        'invoices',        false)
on conflict (id) do nothing;

create policy team_read_files on storage.objects for select to authenticated
  using (bucket_id in ('candidate-files', 'agreements', 'invoices') and public.is_team_member());

create policy team_upload_files on storage.objects for insert to authenticated
  with check (bucket_id in ('candidate-files', 'agreements', 'invoices') and public.is_team_member());

create policy team_update_files on storage.objects for update to authenticated
  using (bucket_id in ('candidate-files', 'agreements', 'invoices') and public.is_team_member());

create policy admin_delete_files on storage.objects for delete to authenticated
  using (bucket_id in ('candidate-files', 'agreements', 'invoices') and public.is_admin());
