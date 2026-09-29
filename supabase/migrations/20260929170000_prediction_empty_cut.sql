-- Record a real withdrawal when every prediction source expires. Historical
-- snapshots remain immutable; final closures still require selected evidence.
alter table public.aggregate_snapshots
  drop constraint aggregate_snapshots_sources_present;
alter table public.aggregate_snapshots
  add constraint aggregate_snapshots_sources_present check (
    cardinality(active_source_ids) > 0
    or coalesce(
      kind = 'periodic'
      and schema_version = 'runscars-snapshot-v2'
      and method_version = 'runscars-aggregation-v3'
      and cardinality(active_source_ids) = 0
      and payload -> 'activeSourceIds' = '[]'::jsonb
      and payload -> 'includedObservationIds' = '[]'::jsonb
      and payload -> 'aggregate' -> 'ranking' = '[]'::jsonb
      and payload -> 'aggregate' -> 'sourceLists' = '[]'::jsonb
      and payload -> 'aggregate' -> 'orderedSourceCount' = '0'::jsonb
      and payload -> 'aggregate' -> 'applicableSourceCount' = '0'::jsonb
      and jsonb_array_length(payload -> 'excludedObservationIds') > 0,
      false
    )
  );

create or replace function public.lock_aggregate_snapshot(
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

  if coalesce(cardinality(included_observation_ids), 0) = 0 then
    if not coalesce(
      snapshot_kind = 'periodic'
      and snapshot_schema_version = 'runscars-snapshot-v2'
      and snapshot_method_version = 'runscars-aggregation-v3'
      and cardinality(included_observation_ids) = 0
      and cardinality(snapshot_active_source_ids) = 0
      and cardinality(excluded_observation_ids) > 0
      and snapshot_payload -> 'activeSourceIds' = '[]'::jsonb
      and snapshot_payload -> 'includedObservationIds' = '[]'::jsonb
      and snapshot_payload -> 'aggregate' -> 'ranking' = '[]'::jsonb
      and snapshot_payload -> 'aggregate' -> 'sourceLists' = '[]'::jsonb
      and snapshot_payload -> 'aggregate' -> 'orderedSourceCount' = '0'::jsonb
      and snapshot_payload -> 'aggregate' -> 'applicableSourceCount' = '0'::jsonb
      and jsonb_array_length(snapshot_payload -> 'excludedObservationIds') > 0
      and (
        select array_agg(value order by value)
        from jsonb_array_elements_text(snapshot_payload -> 'excludedObservationIds')
      ) = (
        select array_agg(observation_id::text order by observation_id::text)
        from unnest(excluded_observation_ids) as evidence(observation_id)
      ),
      false
    ) then
      raise exception 'A snapshot needs included observations or an empty periodic cut with excluded evidence';
    end if;

    if exists (
      select 1
      from unnest(excluded_observation_ids) as requested(observation_id)
      join public.professional_observations as observation
        on observation.id = requested.observation_id
      where observation.season_id <> snapshot_season_id
        or observation.category_id is distinct from snapshot_category_id
        or observation.prediction_intention is distinct from snapshot_intention
        or observation.data_type not in ('prediction_ordered', 'prediction_selection')
    ) then
      raise exception 'An empty cut needs excluded prediction evidence from the same scope';
    end if;
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
