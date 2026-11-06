-- A capture is visible to prediction readers only after every expected row is
-- durable. Observation matching may remain pending; persistence may not.
create table public.source_capture_completions (
  capture_id bigint primary key references public.source_publication_captures(id) on delete restrict,
  expected_observation_count integer not null check (expected_observation_count > 0),
  completed_at timestamptz not null
);
create table public.source_capture_observations (
  capture_id bigint not null references public.source_capture_completions(capture_id) on delete restrict,
  observation_id bigint not null references public.professional_observations(id) on delete restrict,
  primary key (capture_id, observation_id)
);
create index source_capture_observations_observation_idx
  on public.source_capture_observations(observation_id);
alter table public.source_capture_completions enable row level security;
alter table public.source_capture_observations enable row level security;
revoke all on public.source_capture_completions, public.source_capture_observations from public, anon, authenticated;
grant select on public.source_capture_completions, public.source_capture_observations to service_role;

-- Recognized receipts preserve their full pre-matching list. Unknown legacy
-- formats need a successful importer retry, never a guessed completion marker.
create function public.source_capture_expected_observations(original_data jsonb)
returns integer language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(original_data->'categories') = 'object'
      and (select count(*) > 0 and bool_and(jsonb_typeof(value) = 'array')
        from jsonb_each(case when jsonb_typeof(original_data->'categories') = 'object' then original_data->'categories' else '{}'::jsonb end))
      then (select count(distinct (category.key, entry.value))::integer
        from jsonb_each(original_data->'categories') category
        cross join lateral jsonb_array_elements(category.value) entry)
    when jsonb_typeof(original_data->'ranking_rows') = 'array'
      then jsonb_array_length(original_data->'ranking_rows')
    when jsonb_typeof(original_data->'rows') = 'array'
      then jsonb_array_length(original_data->'rows')
    when jsonb_typeof(original_data->'observations') = 'array'
      then jsonb_array_length(original_data->'observations')
    else null end;
$$;
revoke all on function public.source_capture_expected_observations(jsonb) from public, anon, authenticated;
grant execute on function public.source_capture_expected_observations(jsonb) to service_role;

create function public.finalize_source_capture(
  p_capture_id bigint,
  p_expected_observation_count integer,
  p_observation_ids bigint[],
  p_completed_at timestamptz
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  capture public.source_publication_captures%rowtype;
  receipt_count integer;
  existing_count integer;
  existing_ids bigint[];
  requested_ids bigint[];
begin
  select * into capture from public.source_publication_captures
    where id = p_capture_id for update;
  if not found then raise exception 'Unknown source capture %', p_capture_id; end if;
  select array_agg(id order by id) into requested_ids from unnest(p_observation_ids) as ids(id);
  if p_expected_observation_count is null or p_expected_observation_count < 1
    or p_completed_at is null or coalesce(cardinality(p_observation_ids), 0) <> p_expected_observation_count
    or (select count(distinct id) from unnest(p_observation_ids) as ids(id)) <> p_expected_observation_count then
    raise exception 'A complete source capture needs every distinct expected observation';
  end if;
  receipt_count := public.source_capture_expected_observations(capture.original_data);
  if receipt_count is not null and receipt_count <> p_expected_observation_count then
    raise exception 'Source capture receipt expects % observations, received %', receipt_count, p_expected_observation_count;
  end if;
  if exists (
    select 1 from unnest(p_observation_ids) as requested(id)
    left join public.professional_observations o on o.id = requested.id
    where o.id is null or o.publication_id <> capture.publication_id
  ) then raise exception 'Capture observations must belong to the same publication'; end if;

  select expected_observation_count into existing_count from public.source_capture_completions
    where capture_id = p_capture_id;
  if found then
    select array_agg(observation_id order by observation_id) into existing_ids
      from public.source_capture_observations where capture_id = p_capture_id;
    if existing_count <> p_expected_observation_count or existing_ids is distinct from requested_ids then
      raise exception 'Completed source capture membership is immutable';
    end if;
    return false;
  end if;
  insert into public.source_capture_completions values (p_capture_id, p_expected_observation_count, p_completed_at);
  insert into public.source_capture_observations(capture_id, observation_id)
    select p_capture_id, id from unnest(p_observation_ids) as ids(id);
  return true;
end;
$$;
revoke all on function public.finalize_source_capture(bigint, integer, bigint[], timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_source_capture(bigint, integer, bigint[], timestamptz) to service_role;

-- Backfill complete prediction receipts by stored row count, including pending
-- matches. A failed original run can have been completed by an idempotent retry;
-- conversely, a run status alone cannot prove that a whole receipt is durable.
with complete as (
  select c.id, public.source_capture_expected_observations(c.original_data) as expected_count,
    count(o.id)::integer as observed_count, max(o.created_at) as completed_at
  from public.source_publication_captures c
  join public.professional_observations o on o.capture_id = c.id
  group by c.id
  having bool_or(o.data_type in ('prediction_ordered', 'prediction_selection'))
)
insert into public.source_capture_completions(capture_id, expected_observation_count, completed_at)
select id, expected_count, completed_at from complete
where expected_count > 0 and expected_count = observed_count;
insert into public.source_capture_observations(capture_id, observation_id)
select o.capture_id, o.id from public.professional_observations o
join public.source_capture_completions c on c.capture_id = o.capture_id;

create trigger source_capture_completions_immutable
before update or delete on public.source_capture_completions
for each row execute function public.prevent_locked_record_mutation();
create trigger source_capture_observations_immutable
before update or delete on public.source_capture_observations
for each row execute function public.prevent_locked_record_mutation();

create view public.completed_professional_observations with (security_barrier = true) as
select o.id, o.dedupe_key, o.source_id, o.publication_id, capture.id as capture_id,
  o.run_id, o.season_id, o.film_id, o.person_id, o.category_id, o.category_candidate_id, o.data_type,
  o.prediction_intention, o.original_subject, o.original_value, o.original_scale,
  o.source_url, o.author,
  case when capture.original_data ? 'publication_date' then
    case when capture.original_data->>'publication_date' ~ '^\d{4}-\d{2}-\d{2}(T|$)'
      then (capture.original_data->>'publication_date')::timestamptz
      when capture.original_data->'publication_date' = 'null'::jsonb then null
      else o.published_at end
    else o.published_at end as published_at,
  capture.captured_at, capture.extractor_version, o.participates, o.state,
  o.corrects_observation_id, o.created_at
from public.source_capture_observations member
join public.source_capture_completions completion on completion.capture_id = member.capture_id
join public.source_publication_captures capture on capture.id = member.capture_id
join public.professional_observations o on o.id = member.observation_id;
create view public.completed_source_publication_captures with (security_barrier = true) as
select capture.* from public.source_publication_captures capture
join public.source_capture_completions completion on completion.capture_id = capture.id;
revoke all on public.completed_professional_observations, public.completed_source_publication_captures from public, anon, authenticated;
grant select on public.completed_professional_observations, public.completed_source_publication_captures to service_role;

-- Keep the direct anonymous observation API under the same publication barrier
-- without exposing commit membership or private capture data through RLS.
create function public.source_observation_is_complete(p_observation_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.source_capture_observations member
    join public.source_capture_completions completion on completion.capture_id = member.capture_id
    where member.observation_id = p_observation_id);
$$;
revoke all on function public.source_observation_is_complete(bigint) from public;
grant execute on function public.source_observation_is_complete(bigint) to anon, authenticated, service_role;

drop policy professional_observations_publishable_read on public.professional_observations;
create policy professional_observations_publishable_read
on public.professional_observations for select to anon, authenticated using (
  state = 'published'
  and (data_type not in ('prediction_ordered', 'prediction_selection')
    or public.source_observation_is_complete(id))
  and (
    exists (select 1 from public.sources source
      where source.id = professional_observations.source_id and source.publication_status = 'publishable')
    or (source_id = 'metacritic' and data_type = 'score_aggregate')
  )
);
