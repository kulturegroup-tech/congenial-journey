-- Speed, before the real data arrives.
-- 1. Row-level checks run once per query instead of once per row: wrapping the helper in (select …)
--    lets Postgres evaluate it a single time (Supabase linter: auth_rls_initplan). Same rules as before.
-- 2. One SELECT policy on team_members instead of two (linter: multiple_permissive_policies).
-- 3. Indexes on the foreign keys the app joins and filters on (linter: unindexed_foreign_keys).

do $$
declare
  t text;
begin
  foreach t in array array[
    'firms', 'firm_grades', 'practice_areas', 'clients', 'client_contacts', 'agreements', 'agreement_fee_rates',
    'candidates', 'candidate_phones', 'candidate_emails', 'candidate_files', 'prior_applications', 'mandates',
    'screening_calls', 'interest_tags', 'exit_reasons', 'pipeline_entries', 'cv_shares', 'placements',
    'invoices', 'payments', 'import_rows'
  ] loop
    execute format('alter policy team_read    on %I using ((select is_team_member()))', t);
    execute format('alter policy team_insert  on %I with check ((select is_team_member()))', t);
    execute format('alter policy team_update  on %I using ((select is_team_member())) with check ((select is_team_member()))', t);
    execute format('alter policy admin_delete on %I using ((select is_admin()))', t);
  end loop;
end $$;

alter policy team_read on team_members using ((select is_team_member()));
drop policy admin_write on team_members;
create policy admin_insert on team_members for insert to authenticated with check ((select is_admin()));
create policy admin_update on team_members for update to authenticated using ((select is_admin())) with check ((select is_admin()));
create policy admin_delete on team_members for delete to authenticated using ((select is_admin()));

alter policy team_read    on settings using ((select is_team_member()));
alter policy admin_update on settings using ((select is_admin())) with check ((select is_admin()));
alter policy team_read    on activities using ((select is_team_member()));
alter policy own_read     on notifications using (recipient_id = (select auth.uid()) or (select is_admin()));
alter policy own_update   on notifications using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

create index if not exists activities_actor_idx             on activities (actor_id);
create index if not exists activities_client_idx            on activities (client_id);
create index if not exists agreements_client_idx            on agreements (client_id);
create index if not exists candidates_owner_idx             on candidates (owner_id);
create index if not exists client_contacts_client_idx       on client_contacts (client_id);
create index if not exists clients_owner_idx                on clients (owner_id);
create index if not exists cv_shares_candidate_idx          on cv_shares (candidate_id);
create index if not exists cv_shares_mandate_idx            on cv_shares (mandate_id);
create index if not exists cv_shares_entry_idx              on cv_shares (pipeline_entry_id);
create index if not exists cv_shares_file_idx               on cv_shares (cv_file_id);
create index if not exists import_rows_candidate_idx        on import_rows (candidate_id);
create index if not exists interest_tags_call_idx           on interest_tags (screening_call_id);
create index if not exists interest_tags_practice_idx       on interest_tags (practice_area);
create index if not exists invoices_client_idx              on invoices (client_id);
create index if not exists mandates_owner_idx               on mandates (owner_id);
create index if not exists mandates_practice_idx            on mandates (practice_area);
create index if not exists mandates_replaces_idx            on mandates (replaces_placement_id);
create index if not exists notifications_candidate_idx      on notifications (candidate_id);
create index if not exists notifications_mandate_idx        on notifications (mandate_id);
create index if not exists payments_invoice_idx             on payments (invoice_id);
create index if not exists pipeline_entries_owner_idx       on pipeline_entries (owner_id);
create index if not exists pipeline_entries_exit_idx        on pipeline_entries (exit_reason);
create index if not exists placements_candidate_idx         on placements (candidate_id);
create index if not exists placements_client_idx            on placements (client_id);
create index if not exists placements_mandate_idx           on placements (mandate_id);
create index if not exists placements_agreement_idx         on placements (agreement_id);
create index if not exists placements_replacement_idx       on placements (replacement_mandate_id);
create index if not exists prior_applications_firm_idx      on prior_applications (firm_id);
create index if not exists screening_calls_mandate_idx      on screening_calls (mandate_id);
