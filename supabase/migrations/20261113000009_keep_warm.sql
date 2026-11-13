-- Keep the app awake in office hours. Vercel's free plan stops the server after a few idle
-- minutes, and starting it again made the first page take 3–10 seconds. Every 5 minutes,
-- Monday to Saturday, 08:30–21:30 India time (03:00–15:55 UTC), the database's scheduler opens
-- the app's /warm page. The request carries no data and the page reads none.
--
-- Skipped where the scheduler isn't available (the PGlite tests).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron with schema pg_catalog;
    create extension if not exists pg_net with schema extensions;
    perform cron.schedule(
      'keep-app-awake',
      '*/5 3-15 * * 1-6',
      $job$ select net.http_get(url := 'https://paradigmshifters.vercel.app/warm', timeout_milliseconds := 15000) $job$
    );
  end if;
end $$;
