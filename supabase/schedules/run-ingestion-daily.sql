create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

select cron.unschedule(jobid)
from cron.job
where jobname = 'runscars-ingestion-daily';

select cron.schedule(
  'runscars-ingestion-daily',
  '17 4 * * *',
  $$
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
    -- Separate Edge invocations keep one connector's resource exhaustion from
    -- terminating the remaining connectors in a shared runConnectorSet worker.
    body := jsonb_build_object(
      'trigger', 'scheduled',
      'connectors', jsonb_build_array(connector.id)
    ),
    timeout_milliseconds := 120000
  )
  from public.source_connectors as connector
  where connector.is_active = true
  order by connector.id;
  $$
);
