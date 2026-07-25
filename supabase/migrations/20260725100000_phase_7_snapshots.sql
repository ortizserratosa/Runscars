create type public.aggregate_snapshot_kind as enum (
  'periodic',
  'nomination_final',
  'winner_final'
);

create type public.snapshot_observation_role as enum (
  'included',
  'excluded'
);

create type public.official_result_kind as enum (
  'nominations',
  'winners'
);

create type public.official_result_outcome as enum (
  'nominee',
  'winner'
);

create table public.snapshot_schedules (
  id text primary key,
  season_id text not null references public.seasons (id) on delete cascade,
  category_id text not null references public.categories (id)
    on delete restrict,
  prediction_intention public.prediction_intention not null,
  kind public.aggregate_snapshot_kind not null default 'periodic',
  cron_expression text not null,
  time_zone text not null default 'UTC',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint snapshot_schedules_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint snapshot_schedules_periodic_only check (kind = 'periodic'),
  constraint snapshot_schedules_cron_present check (
    nullif(trim(cron_expression), '') is not null
  ),
  constraint snapshot_schedules_timezone_present check (
    nullif(trim(time_zone), '') is not null
  ),
  unique (season_id, category_id, prediction_intention, kind)
);

create table public.aggregate_snapshots (
  id text primary key,
  season_id text not null references public.seasons (id) on delete restrict,
  category_id text not null references public.categories (id)
    on delete restrict,
  prediction_intention public.prediction_intention not null,
  kind public.aggregate_snapshot_kind not null,
  cutoff_at timestamptz not null,
  time_zone text not null,
  method_version text not null,
  schema_version text not null,
  content_hash text not null,
  payload jsonb not null,
  active_source_ids text[] not null,
  locked_at timestamptz not null,
  locked_by text not null,
  corrects_snapshot_id text references public.aggregate_snapshots (id)
    on delete restrict,
  correction_reason text,
  created_at timestamptz not null default now(),
  constraint aggregate_snapshots_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint aggregate_snapshots_final_intention check (
    (kind <> 'nomination_final' or prediction_intention = 'nomination')
    and (kind <> 'winner_final' or prediction_intention = 'winner')
  ),
  constraint aggregate_snapshots_timezone_present check (
    nullif(trim(time_zone), '') is not null
  ),
  constraint aggregate_snapshots_method_present check (
    nullif(trim(method_version), '') is not null
  ),
  constraint aggregate_snapshots_schema_present check (
    nullif(trim(schema_version), '') is not null
  ),
  constraint aggregate_snapshots_hash_format check (
    content_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint aggregate_snapshots_payload_object check (
    jsonb_typeof(payload) = 'object'
    and jsonb_typeof(payload -> 'aggregate') = 'object'
    and jsonb_typeof(payload -> 'includedObservationIds') = 'array'
    and jsonb_typeof(payload -> 'excludedObservationIds') = 'array'
    and jsonb_typeof(payload -> 'activeSourceIds') = 'array'
    and jsonb_typeof(payload -> 'selectedCandidateIds') = 'array'
  ),
  constraint aggregate_snapshots_payload_scope check (
    payload ->> 'schemaVersion' = schema_version
    and payload ->> 'kind' = kind::text
    and payload ->> 'seasonId' = season_id
    and payload ->> 'categoryId' = category_id
    and payload ->> 'intention' = prediction_intention::text
    and payload ->> 'methodVersion' = method_version
  ),
  constraint aggregate_snapshots_sources_present check (
    cardinality(active_source_ids) > 0
  ),
  constraint aggregate_snapshots_actor_present check (
    nullif(trim(locked_by), '') is not null
  ),
  constraint aggregate_snapshots_correction_pair check (
    (
      corrects_snapshot_id is null
      and correction_reason is null
    )
    or (
      corrects_snapshot_id is not null
      and nullif(trim(correction_reason), '') is not null
    )
  ),
  constraint aggregate_snapshots_not_self_correction check (
    corrects_snapshot_id is null or corrects_snapshot_id <> id
  ),
  unique (
    season_id,
    category_id,
    prediction_intention,
    kind,
    content_hash
  )
);

create table public.snapshot_observations (
  snapshot_id text not null references public.aggregate_snapshots (id)
    on delete restrict,
  observation_id bigint not null references public.professional_observations (id)
    on delete restrict,
  role public.snapshot_observation_role not null,
  created_at timestamptz not null default now(),
  primary key (snapshot_id, observation_id),
  unique (snapshot_id, observation_id, role)
);

create table public.current_aggregate_snapshots (
  season_id text not null references public.seasons (id) on delete cascade,
  category_id text not null references public.categories (id)
    on delete restrict,
  prediction_intention public.prediction_intention not null,
  kind public.aggregate_snapshot_kind not null,
  snapshot_id text not null unique references public.aggregate_snapshots (id)
    on delete restrict,
  published_at timestamptz not null default now(),
  primary key (
    season_id,
    category_id,
    prediction_intention,
    kind
  )
);

create table public.official_result_sets (
  id text primary key,
  season_id text not null references public.seasons (id) on delete restrict,
  kind public.official_result_kind not null,
  source_id text not null references public.sources (id) on delete restrict,
  source_url text not null,
  author text,
  published_at timestamptz not null,
  captured_at timestamptz not null,
  schema_version text not null,
  content_hash text not null,
  payload jsonb not null,
  locked_at timestamptz not null,
  locked_by text not null,
  corrects_result_set_id text references public.official_result_sets (id)
    on delete restrict,
  correction_reason text,
  created_at timestamptz not null default now(),
  constraint official_result_sets_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint official_result_sets_url_https check (
    source_url ~ '^https://'
  ),
  constraint official_result_sets_date_order check (
    published_at <= captured_at
  ),
  constraint official_result_sets_schema_present check (
    nullif(trim(schema_version), '') is not null
  ),
  constraint official_result_sets_hash_format check (
    content_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint official_result_sets_payload_object check (
    jsonb_typeof(payload) = 'object'
    and jsonb_typeof(payload -> 'source') = 'object'
    and jsonb_typeof(payload -> 'entries') = 'array'
    and jsonb_typeof(payload -> 'originalData') = 'object'
  ),
  constraint official_result_sets_payload_scope check (
    payload ->> 'schemaVersion' = schema_version
    and payload ->> 'seasonId' = season_id
    and payload ->> 'kind' = kind::text
    and payload -> 'source' ->> 'sourceId' = source_id
    and payload -> 'source' ->> 'sourceUrl' = source_url
  ),
  constraint official_result_sets_actor_present check (
    nullif(trim(locked_by), '') is not null
  ),
  constraint official_result_sets_correction_pair check (
    (
      corrects_result_set_id is null
      and correction_reason is null
    )
    or (
      corrects_result_set_id is not null
      and nullif(trim(correction_reason), '') is not null
    )
  ),
  constraint official_result_sets_not_self_correction check (
    corrects_result_set_id is null or corrects_result_set_id <> id
  ),
  unique (season_id, kind, content_hash)
);

create table public.official_result_entries (
  result_set_id text not null references public.official_result_sets (id)
    on delete restrict,
  category_id text not null references public.categories (id)
    on delete restrict,
  candidate_id text not null,
  film_id text references public.films (id) on delete restrict,
  person_id text references public.people (id) on delete restrict,
  outcome public.official_result_outcome not null,
  created_at timestamptz not null default now(),
  primary key (result_set_id, category_id, candidate_id),
  constraint official_result_entries_candidate_present check (
    nullif(trim(candidate_id), '') is not null
  ),
  constraint official_result_entries_subject_exclusive check (
    (film_id is not null and person_id is null)
    or (film_id is null and person_id is not null)
  ),
  constraint official_result_entries_candidate_matches check (
    candidate_id = coalesce(film_id, person_id)
  )
);

create table public.current_official_result_sets (
  season_id text not null references public.seasons (id) on delete cascade,
  kind public.official_result_kind not null,
  result_set_id text not null unique references public.official_result_sets (id)
    on delete restrict,
  published_at timestamptz not null default now(),
  primary key (season_id, kind)
);

create function public.prevent_locked_record_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% is immutable after insertion', tg_table_name;
end;
$$;

create trigger aggregate_snapshots_immutable
before update or delete on public.aggregate_snapshots
for each row execute function public.prevent_locked_record_mutation();

create trigger snapshot_observations_immutable
before update or delete on public.snapshot_observations
for each row execute function public.prevent_locked_record_mutation();

create trigger official_result_sets_immutable
before update or delete on public.official_result_sets
for each row execute function public.prevent_locked_record_mutation();

create trigger official_result_entries_immutable
before update or delete on public.official_result_entries
for each row execute function public.prevent_locked_record_mutation();

create trigger snapshot_schedules_set_updated_at
before update on public.snapshot_schedules
for each row execute function public.set_updated_at();

create function public.lock_aggregate_snapshot(
  snapshot_id text,
  snapshot_season_id text,
  snapshot_category_id text,
  snapshot_intention public.prediction_intention,
  snapshot_kind public.aggregate_snapshot_kind,
  snapshot_cutoff_at timestamptz,
  snapshot_time_zone text,
  snapshot_method_version text,
  snapshot_schema_version text,
  snapshot_content_hash text,
  snapshot_payload jsonb,
  snapshot_active_source_ids text[],
  included_observation_ids bigint[],
  excluded_observation_ids bigint[],
  snapshot_locked_at timestamptz,
  snapshot_locked_by text,
  corrected_snapshot_id text default null,
  snapshot_correction_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_snapshot public.aggregate_snapshots%rowtype;
  existing_hash text;
begin
  select content_hash
  into existing_hash
  from public.aggregate_snapshots
  where id = snapshot_id;

  if found then
    if existing_hash = snapshot_content_hash then
      return false;
    end if;
    raise exception 'Snapshot ID % already exists with different content',
      snapshot_id;
  end if;

  if cardinality(included_observation_ids) is null
    or cardinality(included_observation_ids) = 0 then
    raise exception 'A snapshot needs included observations';
  end if;

  if exists (
    select 1
    from unnest(snapshot_active_source_ids) as requested(source_id)
    left join public.sources
      on sources.id = requested.source_id
    where sources.id is null
  ) then
    raise exception 'A snapshot references an unknown source';
  end if;

  if exists (
    select 1
    from unnest(included_observation_ids) as requested(observation_id)
    left join public.professional_observations
      on professional_observations.id = requested.observation_id
    left join public.sources
      on sources.id = professional_observations.source_id
    where professional_observations.id is null
      or professional_observations.state <> 'published'
      or professional_observations.participates = false
      or sources.publication_status <> 'publishable'
      or not (
        professional_observations.source_id
        = any(snapshot_active_source_ids)
      )
  ) then
    raise exception
      'Included observations must be published, participating and publishable';
  end if;

  if exists (
    select 1
    from unnest(coalesce(excluded_observation_ids, '{}'::bigint[]))
      as requested(observation_id)
    left join public.professional_observations
      on professional_observations.id = requested.observation_id
    where professional_observations.id is null
  ) then
    raise exception 'A snapshot references an unknown excluded observation';
  end if;

  if corrected_snapshot_id is not null then
    select *
    into previous_snapshot
    from public.aggregate_snapshots
    where id = corrected_snapshot_id;

    if not found then
      raise exception 'Corrected snapshot % does not exist',
        corrected_snapshot_id;
    end if;
    if nullif(trim(snapshot_correction_reason), '') is null then
      raise exception 'A correction reason is required';
    end if;
    if previous_snapshot.season_id <> snapshot_season_id
      or previous_snapshot.category_id <> snapshot_category_id
      or previous_snapshot.prediction_intention <> snapshot_intention
      or previous_snapshot.kind <> snapshot_kind then
      raise exception 'A correction must keep the original scope';
    end if;
  elsif snapshot_correction_reason is not null then
    raise exception 'A correction reason requires a corrected snapshot';
  end if;

  insert into public.aggregate_snapshots (
    id,
    season_id,
    category_id,
    prediction_intention,
    kind,
    cutoff_at,
    time_zone,
    method_version,
    schema_version,
    content_hash,
    payload,
    active_source_ids,
    locked_at,
    locked_by,
    corrects_snapshot_id,
    correction_reason
  )
  values (
    snapshot_id,
    snapshot_season_id,
    snapshot_category_id,
    snapshot_intention,
    snapshot_kind,
    snapshot_cutoff_at,
    snapshot_time_zone,
    snapshot_method_version,
    snapshot_schema_version,
    snapshot_content_hash,
    snapshot_payload,
    snapshot_active_source_ids,
    snapshot_locked_at,
    snapshot_locked_by,
    corrected_snapshot_id,
    snapshot_correction_reason
  );

  insert into public.snapshot_observations (
    snapshot_id,
    observation_id,
    role
  )
  select snapshot_id, observation_id, 'included'
  from (
    select distinct unnest(included_observation_ids) as observation_id
  ) as included;

  insert into public.snapshot_observations (
    snapshot_id,
    observation_id,
    role
  )
  select snapshot_id, observation_id, 'excluded'
  from (
    select distinct unnest(
      coalesce(excluded_observation_ids, '{}'::bigint[])
    ) as observation_id
  ) as excluded
  where not (observation_id = any(included_observation_ids));

  insert into public.current_aggregate_snapshots (
    season_id,
    category_id,
    prediction_intention,
    kind,
    snapshot_id,
    published_at
  )
  values (
    snapshot_season_id,
    snapshot_category_id,
    snapshot_intention,
    snapshot_kind,
    snapshot_id,
    snapshot_locked_at
  )
  on conflict (
    season_id,
    category_id,
    prediction_intention,
    kind
  ) do update set
    snapshot_id = excluded.snapshot_id,
    published_at = excluded.published_at;

  return true;
end;
$$;

create function public.lock_official_result_set(
  result_set_id text,
  result_season_id text,
  result_kind public.official_result_kind,
  result_source_id text,
  result_source_url text,
  result_author text,
  result_published_at timestamptz,
  result_captured_at timestamptz,
  result_schema_version text,
  result_content_hash text,
  result_payload jsonb,
  result_locked_at timestamptz,
  result_locked_by text,
  corrected_result_set_id text default null,
  result_correction_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_result public.official_result_sets%rowtype;
  existing_hash text;
begin
  select content_hash
  into existing_hash
  from public.official_result_sets
  where id = result_set_id;

  if found then
    if existing_hash = result_content_hash then
      return false;
    end if;
    raise exception 'Result set ID % already exists with different content',
      result_set_id;
  end if;

  if not exists (
    select 1
    from public.sources
    where id = result_source_id
      and 'official' = any(source_types)
      and publication_status = 'publishable'
  ) then
    raise exception 'Official results require a publishable official source';
  end if;

  if jsonb_typeof(result_payload -> 'entries') <> 'array'
    or jsonb_array_length(result_payload -> 'entries') = 0 then
    raise exception 'Official results need entries';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(result_payload -> 'entries') as raw(entry)
    left join public.categories
      on categories.id = raw.entry ->> 'categoryId'
    left join public.season_films
      on season_films.season_id = result_season_id
      and season_films.film_id = nullif(raw.entry ->> 'filmId', '')
    where categories.id is null
      or (
        result_kind = 'nominations'
        and raw.entry ->> 'outcome' <> 'nominee'
      )
      or (
        result_kind = 'winners'
        and raw.entry ->> 'outcome' <> 'winner'
      )
      or (
        categories.subject = 'film'
        and (
          nullif(raw.entry ->> 'filmId', '') is null
          or season_films.film_id is null
        )
      )
      or (
        categories.subject = 'person'
        and nullif(raw.entry ->> 'personId', '') is null
      )
  ) then
    raise exception 'An official result entry has an invalid shape';
  end if;

  if result_kind = 'winners' and exists (
    select 1
    from (
      select
        entry ->> 'categoryId' as category_id,
        count(*) as winners
      from jsonb_array_elements(result_payload -> 'entries') as raw(entry)
      group by entry ->> 'categoryId'
    ) as category_winners
    where winners <> 1
  ) then
    raise exception 'Each category must have exactly one winner';
  end if;

  if corrected_result_set_id is not null then
    select *
    into previous_result
    from public.official_result_sets
    where id = corrected_result_set_id;

    if not found then
      raise exception 'Corrected result set % does not exist',
        corrected_result_set_id;
    end if;
    if nullif(trim(result_correction_reason), '') is null then
      raise exception 'A correction reason is required';
    end if;
    if previous_result.season_id <> result_season_id
      or previous_result.kind <> result_kind then
      raise exception 'A correction must keep the original result scope';
    end if;
  elsif result_correction_reason is not null then
    raise exception 'A correction reason requires a corrected result set';
  end if;

  insert into public.official_result_sets (
    id,
    season_id,
    kind,
    source_id,
    source_url,
    author,
    published_at,
    captured_at,
    schema_version,
    content_hash,
    payload,
    locked_at,
    locked_by,
    corrects_result_set_id,
    correction_reason
  )
  values (
    result_set_id,
    result_season_id,
    result_kind,
    result_source_id,
    result_source_url,
    result_author,
    result_published_at,
    result_captured_at,
    result_schema_version,
    result_content_hash,
    result_payload,
    result_locked_at,
    result_locked_by,
    corrected_result_set_id,
    result_correction_reason
  );

  insert into public.official_result_entries (
    result_set_id,
    category_id,
    candidate_id,
    film_id,
    person_id,
    outcome
  )
  select
    result_set_id,
    entry ->> 'categoryId',
    entry ->> 'candidateId',
    nullif(entry ->> 'filmId', ''),
    nullif(entry ->> 'personId', ''),
    (entry ->> 'outcome')::public.official_result_outcome
  from jsonb_array_elements(result_payload -> 'entries') as raw(entry);

  insert into public.current_official_result_sets (
    season_id,
    kind,
    result_set_id,
    published_at
  )
  values (
    result_season_id,
    result_kind,
    result_set_id,
    result_locked_at
  )
  on conflict (season_id, kind) do update set
    result_set_id = excluded.result_set_id,
    published_at = excluded.published_at;

  return true;
end;
$$;

create index aggregate_snapshots_scope_locked_idx
  on public.aggregate_snapshots (
    season_id,
    category_id,
    prediction_intention,
    kind,
    locked_at desc
  );
create index snapshot_observations_observation_idx
  on public.snapshot_observations (observation_id);
create index official_result_sets_scope_locked_idx
  on public.official_result_sets (season_id, kind, locked_at desc);
create index official_result_entries_category_idx
  on public.official_result_entries (category_id, outcome);

alter table public.snapshot_schedules enable row level security;
alter table public.aggregate_snapshots enable row level security;
alter table public.snapshot_observations enable row level security;
alter table public.current_aggregate_snapshots enable row level security;
alter table public.official_result_sets enable row level security;
alter table public.official_result_entries enable row level security;
alter table public.current_official_result_sets enable row level security;

grant select on table
  public.aggregate_snapshots,
  public.snapshot_observations,
  public.current_aggregate_snapshots,
  public.official_result_sets,
  public.official_result_entries,
  public.current_official_result_sets
to anon, authenticated;

grant select on table public.snapshot_schedules to service_role;

create policy aggregate_snapshots_public_read
on public.aggregate_snapshots for select
to anon, authenticated
using (true);

create policy snapshot_observations_public_read
on public.snapshot_observations for select
to anon, authenticated
using (true);

create policy current_aggregate_snapshots_public_read
on public.current_aggregate_snapshots for select
to anon, authenticated
using (true);

create policy official_result_sets_public_read
on public.official_result_sets for select
to anon, authenticated
using (true);

create policy official_result_entries_public_read
on public.official_result_entries for select
to anon, authenticated
using (true);

create policy current_official_result_sets_public_read
on public.current_official_result_sets for select
to anon, authenticated
using (true);

revoke all on function public.lock_aggregate_snapshot(
  text,
  text,
  text,
  public.prediction_intention,
  public.aggregate_snapshot_kind,
  timestamptz,
  text,
  text,
  text,
  text,
  jsonb,
  text[],
  bigint[],
  bigint[],
  timestamptz,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.lock_aggregate_snapshot(
  text,
  text,
  text,
  public.prediction_intention,
  public.aggregate_snapshot_kind,
  timestamptz,
  text,
  text,
  text,
  text,
  jsonb,
  text[],
  bigint[],
  bigint[],
  timestamptz,
  text,
  text,
  text
) to service_role;

revoke all on function public.lock_official_result_set(
  text,
  text,
  public.official_result_kind,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  jsonb,
  timestamptz,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.lock_official_result_set(
  text,
  text,
  public.official_result_kind,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  jsonb,
  timestamptz,
  text,
  text,
  text
) to service_role;

comment on table public.aggregate_snapshots is
  'Agregados profesionales bloqueados; toda corrección crea otra fila enlazada.';
comment on table public.snapshot_observations is
  'Evidencia incluida o excluida por cada snapshot bloqueado.';
comment on table public.current_aggregate_snapshots is
  'Puntero publicable a la versión vigente sin mutar el snapshot histórico.';
comment on table public.official_result_sets is
  'Capturas inmutables y versionadas de nominaciones o ganadores oficiales.';
comment on function public.lock_aggregate_snapshot is
  'Bloquea evidencia, payload y versión de método en una transacción idempotente.';
comment on function public.lock_official_result_set is
  'Registra resultados oficiales y su procedencia en una versión inmutable.';
