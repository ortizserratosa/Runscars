create type public.connector_kind as enum (
  'api_json',
  'rss',
  'html',
  'manual'
);

create type public.ingestion_trigger as enum (
  'manual',
  'scheduled',
  'fixture'
);

create type public.ingestion_run_status as enum (
  'running',
  'succeeded',
  'partial',
  'failed'
);

create type public.ingestion_event_level as enum (
  'info',
  'warning',
  'error'
);

create type public.professional_observation_type as enum (
  'review',
  'score_individual',
  'score_aggregate',
  'prediction_ordered',
  'prediction_selection'
);

create type public.prediction_intention as enum (
  'nomination',
  'winner'
);

create type public.professional_observation_state as enum (
  'pending_review',
  'published',
  'corrected',
  'excluded'
);

create type public.ingestion_review_kind as enum (
  'film_match',
  'person_match',
  'category_match',
  'invalid_value'
);

create type public.ingestion_review_status as enum (
  'pending',
  'resolved',
  'dismissed'
);

create table public.source_connectors (
  id text primary key,
  source_id text references public.sources (id) on delete restrict,
  name text not null,
  kind public.connector_kind not null,
  endpoint_url text,
  extractor_version text not null,
  is_active boolean not null default false,
  schedule_cron text,
  configuration jsonb not null default '{}'::jsonb,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_connectors_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint source_connectors_name_present check (
    nullif(trim(name), '') is not null
  ),
  constraint source_connectors_version_present check (
    nullif(trim(extractor_version), '') is not null
  ),
  constraint source_connectors_endpoint_https check (
    endpoint_url is null or endpoint_url ~ '^https://'
  ),
  constraint source_connectors_configuration_object check (
    jsonb_typeof(configuration) = 'object'
  ),
  constraint source_connectors_manual_source check (
    (kind = 'manual' and source_id is null)
    or (kind <> 'manual' and source_id is not null)
  )
);

create table public.ingestion_runs (
  id bigint generated always as identity primary key,
  run_key text not null unique,
  connector_id text not null references public.source_connectors (id)
    on delete restrict,
  trigger public.ingestion_trigger not null,
  status public.ingestion_run_status not null default 'running',
  started_at timestamptz not null,
  finished_at timestamptz,
  publications_seen integer not null default 0,
  observations_seen integer not null default 0,
  observations_inserted integer not null default 0,
  observations_duplicate integer not null default 0,
  review_items_created integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now(),
  constraint ingestion_runs_key_present check (
    nullif(trim(run_key), '') is not null
  ),
  constraint ingestion_runs_counts_nonnegative check (
    publications_seen >= 0
    and observations_seen >= 0
    and observations_inserted >= 0
    and observations_duplicate >= 0
    and review_items_created >= 0
  ),
  constraint ingestion_runs_finished_state check (
    (status = 'running' and finished_at is null)
    or (status <> 'running' and finished_at is not null)
  )
);

create table public.ingestion_run_events (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.ingestion_runs (id)
    on delete cascade,
  level public.ingestion_event_level not null,
  code text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ingestion_run_events_code_present check (
    nullif(trim(code), '') is not null
  ),
  constraint ingestion_run_events_message_present check (
    nullif(trim(message), '') is not null
  ),
  constraint ingestion_run_events_context_object check (
    jsonb_typeof(context) = 'object'
  )
);

create table public.source_publications (
  id bigint generated always as identity primary key,
  source_id text not null references public.sources (id) on delete restrict,
  external_id text not null,
  canonical_url text not null,
  title text not null,
  author text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_publications_external_id_present check (
    nullif(trim(external_id), '') is not null
  ),
  constraint source_publications_url_https check (
    canonical_url ~ '^https://'
  ),
  constraint source_publications_title_present check (
    nullif(trim(title), '') is not null
  ),
  unique (source_id, external_id),
  unique (source_id, canonical_url)
);

create table public.source_publication_captures (
  id bigint generated always as identity primary key,
  publication_id bigint not null references public.source_publications (id)
    on delete restrict,
  content_hash text not null,
  source_url text not null,
  original_data jsonb not null,
  captured_at timestamptz not null,
  extractor_version text not null,
  created_at timestamptz not null default now(),
  constraint source_publication_captures_hash_format check (
    content_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint source_publication_captures_url_https check (
    source_url ~ '^https://'
  ),
  constraint source_publication_captures_original_object check (
    jsonb_typeof(original_data) = 'object'
  ),
  constraint source_publication_captures_version_present check (
    nullif(trim(extractor_version), '') is not null
  ),
  unique (publication_id, content_hash)
);

create table public.professional_observations (
  id bigint generated always as identity primary key,
  dedupe_key text not null unique,
  source_id text not null references public.sources (id) on delete restrict,
  publication_id bigint not null references public.source_publications (id)
    on delete restrict,
  capture_id bigint not null references public.source_publication_captures (id)
    on delete restrict,
  run_id bigint not null references public.ingestion_runs (id)
    on delete restrict,
  season_id text not null references public.seasons (id) on delete restrict,
  film_id text references public.films (id) on delete restrict,
  person_id text references public.people (id) on delete restrict,
  category_id text references public.categories (id) on delete restrict,
  data_type public.professional_observation_type not null,
  prediction_intention public.prediction_intention,
  original_subject text not null,
  original_value jsonb not null,
  original_scale jsonb,
  source_url text not null,
  author text,
  published_at timestamptz,
  captured_at timestamptz not null,
  extractor_version text not null,
  participates boolean not null default false,
  state public.professional_observation_state not null
    default 'pending_review',
  corrects_observation_id bigint references public.professional_observations (id)
    on delete restrict,
  created_at timestamptz not null default now(),
  constraint professional_observations_dedupe_key_format check (
    dedupe_key ~ '^[a-f0-9]{64}$'
  ),
  constraint professional_observations_subject_present check (
    nullif(trim(original_subject), '') is not null
  ),
  constraint professional_observations_value_object check (
    jsonb_typeof(original_value) = 'object'
  ),
  constraint professional_observations_scale_object check (
    original_scale is null or jsonb_typeof(original_scale) = 'object'
  ),
  constraint professional_observations_url_https check (
    source_url ~ '^https://'
  ),
  constraint professional_observations_version_present check (
    nullif(trim(extractor_version), '') is not null
  ),
  constraint professional_observations_subject_exclusive check (
    not (film_id is not null and person_id is not null)
  ),
  constraint professional_observations_prediction_shape check (
    (
      data_type in ('prediction_ordered', 'prediction_selection')
      and category_id is not null
      and prediction_intention is not null
    )
    or (
      data_type not in ('prediction_ordered', 'prediction_selection')
      and prediction_intention is null
    )
  ),
  constraint professional_observations_review_participation check (
    data_type <> 'review' or participates = false
  ),
  constraint professional_observations_pending_not_participating check (
    state <> 'pending_review' or participates = false
  ),
  constraint professional_observations_correction_not_self check (
    corrects_observation_id is null or corrects_observation_id <> id
  )
);

create table public.ingestion_review_items (
  id bigint generated always as identity primary key,
  queue_key text not null unique,
  run_id bigint not null references public.ingestion_runs (id)
    on delete restrict,
  connector_id text not null references public.source_connectors (id)
    on delete restrict,
  observation_id bigint references public.professional_observations (id)
    on delete restrict,
  kind public.ingestion_review_kind not null,
  status public.ingestion_review_status not null default 'pending',
  subject_label text not null,
  candidate_film_ids text[] not null default '{}',
  candidate_person_ids text[] not null default '{}',
  context jsonb not null default '{}'::jsonb,
  resolution_note text,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now(),
  constraint ingestion_review_items_key_format check (
    queue_key ~ '^[a-f0-9]{64}$'
  ),
  constraint ingestion_review_items_subject_present check (
    nullif(trim(subject_label), '') is not null
  ),
  constraint ingestion_review_items_context_object check (
    jsonb_typeof(context) = 'object'
  ),
  constraint ingestion_review_items_resolution_state check (
    (
      status = 'pending'
      and resolved_at is null
      and resolved_by is null
    )
    or (
      status <> 'pending'
      and resolved_at is not null
      and nullif(trim(resolved_by), '') is not null
    )
  )
);

create index source_connectors_active_idx
  on public.source_connectors (is_active, id);
create index ingestion_runs_connector_started_idx
  on public.ingestion_runs (connector_id, started_at desc);
create index ingestion_run_events_run_idx
  on public.ingestion_run_events (run_id, created_at);
create index source_publications_source_published_idx
  on public.source_publications (source_id, published_at desc);
create index source_publication_captures_latest_idx
  on public.source_publication_captures (publication_id, captured_at desc);
create index professional_observations_public_idx
  on public.professional_observations (
    season_id,
    data_type,
    category_id,
    film_id
  )
  where state = 'published';
create index professional_observations_publication_idx
  on public.professional_observations (publication_id);
create index ingestion_review_items_pending_idx
  on public.ingestion_review_items (status, created_at)
  where status = 'pending';

create trigger source_connectors_set_updated_at
before update on public.source_connectors
for each row execute function public.set_updated_at();

create trigger source_publications_set_updated_at
before update on public.source_publications
for each row execute function public.set_updated_at();

alter table public.source_connectors enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.ingestion_run_events enable row level security;
alter table public.source_publications enable row level security;
alter table public.source_publication_captures enable row level security;
alter table public.professional_observations enable row level security;
alter table public.ingestion_review_items enable row level security;

grant select on table
  public.source_connectors,
  public.source_publications,
  public.source_publication_captures,
  public.professional_observations
to anon, authenticated;

grant select, insert, update on table
  public.source_connectors,
  public.ingestion_runs,
  public.source_publications
to service_role;

grant select, insert on table
  public.ingestion_run_events,
  public.source_publication_captures,
  public.professional_observations,
  public.ingestion_review_items
to service_role;

grant update on table
  public.ingestion_review_items
to service_role;

grant usage, select on all sequences in schema public to service_role;

create policy source_connectors_public_read
on public.source_connectors for select
to anon, authenticated
using (true);

create policy source_publications_public_read
on public.source_publications for select
to anon, authenticated
using (true);

create policy source_publication_captures_public_read
on public.source_publication_captures for select
to anon, authenticated
using (true);

create policy professional_observations_public_read
on public.professional_observations for select
to anon, authenticated
using (state = 'published');

comment on table public.source_connectors is
  'Configuración versionada de conectores sin secretos; el scheduler ejecuta solo los activos.';
comment on table public.ingestion_runs is
  'Intentos aislados por conector con contadores y resultado terminal.';
comment on table public.ingestion_run_events is
  'Log estructurado sin credenciales para diagnosticar una ejecución.';
comment on table public.source_publication_captures is
  'Capturas inmutables de los campos externos necesarios, identificadas por hash.';
comment on table public.professional_observations is
  'Señales profesionales originales; no contiene valores normalizados ni agregados Runscars.';
comment on table public.ingestion_review_items is
  'Cola privada para matches o valores que requieren decisión editorial.';
