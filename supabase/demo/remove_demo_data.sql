-- Removes every row created by demo_data.sql (ids starting 'de000000-') and anything that hangs off them.
-- Real data is untouched. Safe to run more than once.
do $$
declare
  demo text := 'de000000-%';
begin
  delete from notifications where mandate_id::text like demo or candidate_id::text like demo or recipient_id::text like demo;
  delete from payments  where invoice_id in (select id from invoices where placement_id::text like demo);
  delete from invoices  where placement_id::text like demo;
  delete from placements where id::text like demo or candidate_id::text like demo;
  delete from cv_shares  where candidate_id::text like demo or mandate_id::text like demo;
  delete from pipeline_entries where candidate_id::text like demo or mandate_id::text like demo;
  delete from screening_calls  where candidate_id::text like demo or recruiter_id::text like demo;
  delete from activities where mandate_id::text like demo or candidate_id::text like demo or client_id::text like demo
                            or actor_id::text like demo;
  delete from mandates   where id::text like demo;
  delete from candidates where id::text like demo;          -- phones, emails, tags, prior applications cascade
  delete from clients    where id::text like demo;          -- agreements and fee rates cascade
  delete from firms      where id::text like demo;
  delete from team_members where id::text like demo;
  delete from auth.users   where id::text like demo;
end $$;
