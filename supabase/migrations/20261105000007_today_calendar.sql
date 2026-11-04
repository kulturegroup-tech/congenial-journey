-- For the redesign: the monthly target on Today, interview dates on the calendar,
-- and undo for "add these people to the mandate".

alter table settings add column monthly_joining_target int not null default 5 check (monthly_joining_target >= 0);

-- When the interview, assignment or final round is. Asked for when a card moves into those stages.
alter table pipeline_entries add column interview_at timestamptz;
create index pipeline_entries_interview_idx on pipeline_entries (interview_at) where interview_at is not null;

-- Undo for a bulk add: removes entries this person just created, if nothing has happened to them yet.
-- Deletes are admin-only elsewhere; this is the one narrow exception, so it checks everything itself.
create function undo_pipeline_adds(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if auth.uid() is null or not is_team_member() then raise exception 'Not allowed'; end if;
  delete from activities
  where entity_type = 'pipeline_entries' and entity_id = any (p_ids)
    and entity_id in (select id from pipeline_entries
                      where id = any (p_ids) and owner_id = auth.uid() and stage = 'mapped'
                        and exit_reason is null and created_at > now() - interval '15 minutes');
  delete from pipeline_entries
  where id = any (p_ids) and owner_id = auth.uid() and stage = 'mapped'
    and exit_reason is null and created_at > now() - interval '15 minutes'
    and not exists (select 1 from cv_shares s where s.pipeline_entry_id = pipeline_entries.id);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function undo_pipeline_adds(uuid[]) from public, anon;
