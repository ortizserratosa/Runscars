-- Hace explícita la cobertura mínima esperada de cada fuente automática.
-- Una revisión parcial ya no puede cerrar el conector como correcto.

update public.source_connectors
set
  extractor_version = 'awardswatch-multicategory-v5',
  configuration = configuration || jsonb_build_object(
  'required_category_ids', jsonb_build_array(
    'best-picture',
    'directing',
    'actor',
    'actress',
    'supporting-actor',
    'supporting-actress'
  )
)
where id = 'awardswatch-predictions';

update public.source_connectors
set
  extractor_version = 'awards-daily-v6',
  configuration = configuration || jsonb_build_object(
  'discovery_concurrency', 4,
  'required_category_ids', jsonb_build_array(
    'best-picture',
    'directing',
    'actor',
    'actress',
    'supporting-actor',
    'supporting-actress',
    'original-screenplay',
    'adapted-screenplay'
  )
)
where id = 'awards-daily-predictions';

update public.source_connectors
set configuration = configuration || jsonb_build_object(
  'required_category_ids', jsonb_build_array(
    'best-picture',
    'directing',
    'actor',
    'actress',
    'supporting-actor',
    'supporting-actress',
    'original-screenplay',
    'adapted-screenplay'
  )
)
where id in (
  'next-best-picture-predictions',
  'midnight-critics-predictions'
);

update public.source_connectors
set configuration = configuration || jsonb_build_object(
  'category_concurrency', 4,
  'required_category_ids', jsonb_build_array(
    'best-picture',
    'directing',
    'actor',
    'actress',
    'supporting-actor',
    'supporting-actress',
    'original-screenplay',
    'adapted-screenplay'
  )
)
where id = 'awards-radar-predictions';

update public.source_connectors
set configuration = configuration || jsonb_build_object(
  'required_category_ids', jsonb_build_array('best-picture')
)
where id = 'ringer-best-picture';

update public.ingestion_review_items as review
set
  status = 'dismissed',
  resolution_note =
    'Descartada al sustituir el parser narrativo de Awards Daily por el bloque estructurado v5',
  resolved_at = now(),
  resolved_by = 'migration:20260901200000'
from public.professional_observations as observation
where observation.id = review.observation_id
  and review.status = 'pending'
  and observation.extractor_version = 'awards-daily-v3'
  and observation.category_id in (
    'best-picture',
    'directing',
    'actor',
    'actress',
    'supporting-actor',
    'supporting-actress',
    'original-screenplay',
    'adapted-screenplay'
  );

update public.ingestion_review_items as review
set
  status = 'dismissed',
  resolution_note =
    'Sustituida por una revisión que elimina el sufijo editorial de distribuidor A24',
  resolved_at = now(),
  resolved_by = 'migration:20260901200000'
from public.professional_observations as observation
where observation.id = review.observation_id
  and review.status = 'pending'
  and observation.extractor_version = 'awardswatch-multicategory-v4'
  and observation.original_subject = 'The Invite ( A24)';

create table public.snapshot_refresh_runs (
  id bigint generated always as identity primary key,
  trigger text not null,
  status text not null default 'running',
  started_at timestamptz not null,
  finished_at timestamptz,
  schedules_seen integer not null default 0,
  snapshots_created integer not null default 0,
  snapshots_unchanged integer not null default 0,
  schedules_skipped integer not null default 0,
  schedules_failed integer not null default 0,
  error_summary text,
  details jsonb not null default '[]'::jsonb,
  constraint snapshot_refresh_runs_trigger_valid check (
    trigger in ('scheduled', 'manual')
  ),
  constraint snapshot_refresh_runs_status_valid check (
    status in ('running', 'succeeded', 'partial', 'failed')
  ),
  constraint snapshot_refresh_runs_counts_valid check (
    schedules_seen >= 0
    and snapshots_created >= 0
    and snapshots_unchanged >= 0
    and schedules_skipped >= 0
    and schedules_failed >= 0
  ),
  constraint snapshot_refresh_runs_details_array check (
    jsonb_typeof(details) = 'array'
  ),
  constraint snapshot_refresh_runs_finished_state check (
    (status = 'running' and finished_at is null)
    or (status <> 'running' and finished_at is not null)
  )
);

create index snapshot_refresh_runs_started_idx
  on public.snapshot_refresh_runs (started_at desc);

alter table public.snapshot_refresh_runs enable row level security;

revoke all on table public.snapshot_refresh_runs from anon, authenticated;
grant select, insert, update on table public.snapshot_refresh_runs
  to service_role;
grant usage, select on sequence public.snapshot_refresh_runs_id_seq
  to service_role;

comment on table public.snapshot_refresh_runs is
  'Private durable evidence for every daily snapshot refresh, including unchanged runs and abandoned-run recovery.';
