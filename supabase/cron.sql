-- Schedules the agent's background jobs with pg_cron + pg_net.
-- Run this AFTER the migration, and after storing two secrets in Vault
-- (Dashboard > Project Settings > Vault, or with the SQL below):
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<same value as CRON_SECRET in functions/.env>', 'cron_secret');

create or replace function public.call_edge_function(fn text)
returns bigint language sql security definer set search_path = public as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/' || fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$$;
revoke execute on function public.call_edge_function(text) from public, anon, authenticated;

-- Re-running this file replaces the jobs instead of duplicating them.
select cron.unschedule(jobname) from cron.job
 where jobname in ('rca-tick', 'rca-gmail-sync');

-- Every minute: medication doses, due reminders, refill alerts, morning briefing.
select cron.schedule('rca-tick', '* * * * *', $$ select public.call_edge_function('tick') $$);

-- Every 10 minutes: pull new Gmail messages and triage them.
select cron.schedule('rca-gmail-sync', '*/10 * * * *', $$ select public.call_edge_function('gmail-sync') $$);
