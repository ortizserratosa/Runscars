create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

select cron.unschedule(jobid)
from cron.job
where jobname = 'runscars-ingestion-daily'
   or starts_with(jobname, 'runscars-ingestion-daily-connector-');

select cron.schedule(
  'runscars-ingestion-daily-connector-' || connector.id,
  format(
    '%s %s * * *',
    (17 + connector.minute_offset) % 60,
    4 + (17 + connector.minute_offset) / 60
  ),
  format($command$
  select net.http_post(
    url := 'https://lgiqzrxeifwciykckzrn.supabase.co/functions/v1/run-ingestion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-runscars-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'runscars_ingestion_cron_secret'
        limit 1
      )
    ),
    -- A dedicated invocation and minute per connector avoid the previous
    -- simultaneous burst of every connector's six persistence workers.
    body := jsonb_build_object(
      'trigger', 'scheduled',
      'connectors', jsonb_build_array(%L)
    ),
    timeout_milliseconds := 120000
  )
  from public.source_connectors
  where id = %L and is_active = true;
  $command$, connector.id, connector.id)
)
from (
  select id, (row_number() over (order by id) - 1)::integer as minute_offset
  from public.source_connectors
  where is_active = true
) as connector;
