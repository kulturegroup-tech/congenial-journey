-- Paradigm Shifters' app moved to Render, which never sleeps, so the keep-awake ping from
-- migration 9 has nothing left to do (it was still opening the old Vercel copy). Stop it.
-- The /warm page stays: Render uses it as the health check.
--
-- Does nothing where the scheduler or the job isn't there (the demo project, the PGlite tests).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if exists (select 1 from cron.job where jobname = 'keep-app-awake') then
      perform cron.unschedule('keep-app-awake');
    end if;
  end if;
end $$;
