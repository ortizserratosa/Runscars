create table public.editorial_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  constraint editorial_admins_note_present check (
    note is null or nullif(trim(note), '') is not null
  )
);

create table public.editorial_actions (
  id bigint generated always as identity primary key,
  operation_key text not null unique,
  admin_user_id uuid not null references auth.users (id) on delete restrict,
  action_type text not null,
  entity_type text not null,
  entity_id text not null,
  reason text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now(),
  constraint editorial_actions_operation_key_present check (
    char_length(trim(operation_key)) between 8 and 160
  ),
  constraint editorial_actions_action_type_present check (
    nullif(trim(action_type), '') is not null
  ),
  constraint editorial_actions_entity_type_present check (
    nullif(trim(entity_type), '') is not null
  ),
  constraint editorial_actions_entity_id_present check (
    nullif(trim(entity_id), '') is not null
  ),
  constraint editorial_actions_reason_present check (
    char_length(trim(reason)) between 4 and 500
  ),
  constraint editorial_actions_before_object check (
    before_state is null or jsonb_typeof(before_state) = 'object'
  ),
  constraint editorial_actions_after_object check (
    after_state is null or jsonb_typeof(after_state) = 'object'
  )
);

create index editorial_actions_created_idx
on public.editorial_actions (created_at desc, id desc);

create index editorial_actions_entity_idx
on public.editorial_actions (entity_type, entity_id, created_at desc);

create trigger editorial_actions_immutable
before update or delete on public.editorial_actions
for each row execute function public.prevent_locked_record_mutation();

alter table public.editorial_admins enable row level security;
alter table public.editorial_actions enable row level security;

grant select, insert, update, delete on table public.editorial_admins
to service_role;

grant select, insert on table public.editorial_actions
to service_role;

grant usage, select on sequence public.editorial_actions_id_seq
to service_role;

create function public.is_editorial_admin(requested_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.editorial_admins
    where user_id = requested_user_id
  );
$$;

create function public.record_editorial_action(
  requested_user_id uuid,
  requested_operation_key text,
  requested_action_type text,
  requested_entity_type text,
  requested_entity_id text,
  requested_reason text,
  requested_before_state jsonb default null,
  requested_after_state jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_id bigint;
begin
  if not public.is_editorial_admin(requested_user_id) then
    raise exception 'editorial administrator required';
  end if;

  select id into action_id
  from public.editorial_actions
  where operation_key = requested_operation_key;

  if action_id is not null then
    return action_id;
  end if;

  insert into public.editorial_actions (
    operation_key,
    admin_user_id,
    action_type,
    entity_type,
    entity_id,
    reason,
    before_state,
    after_state
  ) values (
    requested_operation_key,
    requested_user_id,
    requested_action_type,
    requested_entity_type,
    requested_entity_id,
    requested_reason,
    requested_before_state,
    requested_after_state
  )
  on conflict (operation_key) do nothing
  returning id into action_id;

  if action_id is null then
    select id into action_id
    from public.editorial_actions
    where operation_key = requested_operation_key;
  end if;

  return action_id;
end;
$$;

create function public.editorial_match_observation(
  requested_user_id uuid,
  requested_operation_key text,
  requested_observation_id bigint,
  requested_candidate_id text,
  requested_match_kind text,
  requested_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  observation_before public.professional_observations%rowtype;
  observation_after public.professional_observations%rowtype;
  candidate public.category_candidates%rowtype;
  actor_label text;
  normalized_subject text;
begin
  if not public.is_editorial_admin(requested_user_id) then
    raise exception 'editorial administrator required';
  end if;

  if requested_match_kind not in ('film', 'person', 'team', 'category') then
    raise exception 'invalid match kind';
  end if;

  if char_length(trim(requested_reason)) < 4 then
    raise exception 'editorial reason required';
  end if;

  select * into observation_before
  from public.professional_observations
  where id = requested_observation_id
  for update;

  if not found then
    raise exception 'observation not found';
  end if;

  select * into candidate
  from public.category_candidates
  where id = requested_candidate_id;

  if not found then
    raise exception 'candidate not found';
  end if;

  if observation_before.season_id <> candidate.season_id then
    raise exception 'candidate belongs to another season';
  end if;

  if requested_match_kind <> 'category'
    and observation_before.category_id is distinct from candidate.category_id
  then
    raise exception 'candidate belongs to another category';
  end if;

  actor_label := 'admin:' || requested_user_id::text;
  normalized_subject := coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        lower(trim(observation_before.original_subject)),
        '[^a-z0-9]+',
        '-',
        'g'
      )),
      ''
    ),
    'observation-' || requested_observation_id::text
  );

  insert into public.category_candidate_match_history (
    source_id,
    season_id,
    category_id,
    normalized_subject,
    category_candidate_id,
    match_kind,
    reason,
    actor
  ) values (
    observation_before.source_id,
    observation_before.season_id,
    candidate.category_id,
    normalized_subject,
    candidate.id,
    requested_match_kind,
    requested_reason,
    actor_label
  )
  on conflict do nothing;

  update public.professional_observations
  set
    category_id = candidate.category_id,
    category_candidate_id = candidate.id,
    film_id = candidate.film_id,
    person_id = null,
    state = 'published',
    participates = observation_before.data_type <> 'review'
  where id = requested_observation_id
  returning * into observation_after;

  update public.ingestion_review_items
  set
    status = 'resolved',
    resolution_note = requested_reason,
    resolved_at = now(),
    resolved_by = actor_label
  where observation_id = requested_observation_id
    and status = 'pending';

  perform public.record_editorial_action(
    requested_user_id,
    requested_operation_key,
    'observation.match',
    'professional_observation',
    requested_observation_id::text,
    requested_reason,
    to_jsonb(observation_before),
    to_jsonb(observation_after)
  );

  return to_jsonb(observation_after);
end;
$$;

create function public.editorial_match_observation_to_film(
  requested_user_id uuid,
  requested_operation_key text,
  requested_observation_id bigint,
  requested_film_id text,
  requested_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  observation_before public.professional_observations%rowtype;
  observation_after public.professional_observations%rowtype;
  actor_label text;
begin
  if not public.is_editorial_admin(requested_user_id) then
    raise exception 'editorial administrator required';
  end if;

  if char_length(trim(requested_reason)) < 4 then
    raise exception 'editorial reason required';
  end if;

  select * into observation_before
  from public.professional_observations
  where id = requested_observation_id
  for update;

  if not found then
    raise exception 'observation not found';
  end if;

  if not exists (
    select 1
    from public.season_films
    where season_id = observation_before.season_id
      and film_id = requested_film_id
  ) then
    raise exception 'film does not belong to observation season';
  end if;

  actor_label := 'admin:' || requested_user_id::text;

  update public.professional_observations
  set
    film_id = requested_film_id,
    person_id = null,
    state = 'published',
    participates = observation_before.data_type <> 'review'
  where id = requested_observation_id
  returning * into observation_after;

  update public.ingestion_review_items
  set
    status = 'resolved',
    resolution_note = requested_reason,
    resolved_at = now(),
    resolved_by = actor_label
  where observation_id = requested_observation_id
    and status = 'pending';

  perform public.record_editorial_action(
    requested_user_id,
    requested_operation_key,
    'observation.film-match',
    'professional_observation',
    requested_observation_id::text,
    requested_reason,
    to_jsonb(observation_before),
    to_jsonb(observation_after)
  );

  return to_jsonb(observation_after);
end;
$$;

create function public.editorial_exclude_observation(
  requested_user_id uuid,
  requested_operation_key text,
  requested_observation_id bigint,
  requested_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  observation_before public.professional_observations%rowtype;
  observation_after public.professional_observations%rowtype;
  actor_label text;
begin
  if not public.is_editorial_admin(requested_user_id) then
    raise exception 'editorial administrator required';
  end if;

  if char_length(trim(requested_reason)) < 4 then
    raise exception 'editorial reason required';
  end if;

  select * into observation_before
  from public.professional_observations
  where id = requested_observation_id
  for update;

  if not found then
    raise exception 'observation not found';
  end if;

  actor_label := 'admin:' || requested_user_id::text;

  update public.professional_observations
  set state = 'excluded', participates = false
  where id = requested_observation_id
  returning * into observation_after;

  update public.ingestion_review_items
  set
    status = 'dismissed',
    resolution_note = requested_reason,
    resolved_at = now(),
    resolved_by = actor_label
  where observation_id = requested_observation_id
    and status = 'pending';

  perform public.record_editorial_action(
    requested_user_id,
    requested_operation_key,
    'observation.exclude',
    'professional_observation',
    requested_observation_id::text,
    requested_reason,
    to_jsonb(observation_before),
    to_jsonb(observation_after)
  );

  return to_jsonb(observation_after);
end;
$$;

create function public.editorial_dismiss_review(
  requested_user_id uuid,
  requested_operation_key text,
  requested_review_id bigint,
  requested_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  review_before public.ingestion_review_items%rowtype;
  review_after public.ingestion_review_items%rowtype;
begin
  if not public.is_editorial_admin(requested_user_id) then
    raise exception 'editorial administrator required';
  end if;

  if char_length(trim(requested_reason)) < 4 then
    raise exception 'editorial reason required';
  end if;

  select * into review_before
  from public.ingestion_review_items
  where id = requested_review_id
  for update;

  if not found then
    raise exception 'review item not found';
  end if;

  if review_before.status = 'pending' then
    update public.ingestion_review_items
    set
      status = 'dismissed',
      resolution_note = requested_reason,
      resolved_at = now(),
      resolved_by = 'admin:' || requested_user_id::text
    where id = requested_review_id
    returning * into review_after;
  else
    review_after := review_before;
  end if;

  perform public.record_editorial_action(
    requested_user_id,
    requested_operation_key,
    'review.dismiss',
    'ingestion_review_item',
    requested_review_id::text,
    requested_reason,
    to_jsonb(review_before),
    to_jsonb(review_after)
  );

  return to_jsonb(review_after);
end;
$$;

create function public.editorial_update_source(
  requested_user_id uuid,
  requested_operation_key text,
  requested_source_id text,
  requested_editorial_status public.source_editorial_status,
  requested_technical_status public.source_technical_status,
  requested_publication_status public.source_publication_status,
  requested_notes text,
  requested_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_before public.sources%rowtype;
  source_after public.sources%rowtype;
begin
  if not public.is_editorial_admin(requested_user_id) then
    raise exception 'editorial administrator required';
  end if;

  if char_length(trim(requested_reason)) < 4 then
    raise exception 'editorial reason required';
  end if;

  select * into source_before
  from public.sources
  where id = requested_source_id
  for update;

  if not found then
    raise exception 'source not found';
  end if;

  update public.sources
  set
    editorial_status = requested_editorial_status,
    technical_status = requested_technical_status,
    publication_status = requested_publication_status,
    notes = nullif(trim(requested_notes), ''),
    last_reviewed_on = current_date
  where id = requested_source_id
  returning * into source_after;

  perform public.record_editorial_action(
    requested_user_id,
    requested_operation_key,
    'source.update',
    'source',
    requested_source_id,
    requested_reason,
    to_jsonb(source_before),
    to_jsonb(source_after)
  );

  return to_jsonb(source_after);
end;
$$;

create function public.editorial_update_connector(
  requested_user_id uuid,
  requested_operation_key text,
  requested_connector_id text,
  requested_is_active boolean,
  requested_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connector_before public.source_connectors%rowtype;
  connector_after public.source_connectors%rowtype;
begin
  if not public.is_editorial_admin(requested_user_id) then
    raise exception 'editorial administrator required';
  end if;

  if char_length(trim(requested_reason)) < 4 then
    raise exception 'editorial reason required';
  end if;

  select * into connector_before
  from public.source_connectors
  where id = requested_connector_id
  for update;

  if not found then
    raise exception 'connector not found';
  end if;

  update public.source_connectors
  set is_active = requested_is_active
  where id = requested_connector_id
  returning * into connector_after;

  perform public.record_editorial_action(
    requested_user_id,
    requested_operation_key,
    'connector.update',
    'source_connector',
    requested_connector_id,
    requested_reason,
    to_jsonb(connector_before),
    to_jsonb(connector_after)
  );

  return to_jsonb(connector_after);
end;
$$;

revoke all on function public.is_editorial_admin(uuid) from public;
revoke all on function public.record_editorial_action(
  uuid, text, text, text, text, text, jsonb, jsonb
) from public;
revoke all on function public.editorial_match_observation(
  uuid, text, bigint, text, text, text
) from public;
revoke all on function public.editorial_exclude_observation(
  uuid, text, bigint, text
) from public;
revoke all on function public.editorial_match_observation_to_film(
  uuid, text, bigint, text, text
) from public;
revoke all on function public.editorial_dismiss_review(
  uuid, text, bigint, text
) from public;
revoke all on function public.editorial_update_source(
  uuid,
  text,
  text,
  public.source_editorial_status,
  public.source_technical_status,
  public.source_publication_status,
  text,
  text
) from public;
revoke all on function public.editorial_update_connector(
  uuid, text, text, boolean, text
) from public;

grant execute on function public.is_editorial_admin(uuid)
to service_role;
grant execute on function public.record_editorial_action(
  uuid, text, text, text, text, text, jsonb, jsonb
) to service_role;
grant execute on function public.editorial_match_observation(
  uuid, text, bigint, text, text, text
) to service_role;
grant execute on function public.editorial_exclude_observation(
  uuid, text, bigint, text
) to service_role;
grant execute on function public.editorial_match_observation_to_film(
  uuid, text, bigint, text, text
) to service_role;
grant execute on function public.editorial_dismiss_review(
  uuid, text, bigint, text
) to service_role;
grant execute on function public.editorial_update_source(
  uuid,
  text,
  text,
  public.source_editorial_status,
  public.source_technical_status,
  public.source_publication_status,
  text,
  text
) to service_role;
grant execute on function public.editorial_update_connector(
  uuid, text, text, boolean, text
) to service_role;

comment on table public.editorial_admins is
  'Allowlist privada de usuarios autorizados para operar la consola editorial.';
comment on table public.editorial_actions is
  'Bitácora append-only e idempotente de cada mutación ejecutada desde administración.';
