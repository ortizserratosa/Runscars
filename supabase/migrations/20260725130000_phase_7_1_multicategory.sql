alter table public.categories
add column is_public boolean not null default true,
add column candidate_kind text not null default 'film',
add constraint categories_candidate_kind_valid check (
  candidate_kind in ('film', 'performance', 'team', 'work')
);

update public.categories
set candidate_kind = case
  when id in ('actor', 'actress', 'supporting-actor', 'supporting-actress')
    then 'performance'
  when id in ('directing', 'original-screenplay', 'adapted-screenplay')
    then 'team'
  else 'film'
end;

alter table public.people
add column alternate_names text[] not null default '{}';

alter table public.sources
drop constraint sources_types_valid;

alter table public.sources
add constraint sources_types_valid check (
  source_types <@ array[
    'metadata',
    'official',
    'score',
    'prediction',
    'review',
    'festival',
    'market'
  ]::text[]
);

create table public.category_candidates (
  id text primary key,
  season_id text not null references public.seasons (id) on delete cascade,
  category_id text not null references public.categories (id)
    on delete restrict,
  film_id text references public.films (id) on delete restrict,
  work_title text,
  display_label text not null,
  identity_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_candidates_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint category_candidates_label_present check (
    nullif(trim(display_label), '') is not null
  ),
  constraint category_candidates_work_present check (
    work_title is null or nullif(trim(work_title), '') is not null
  ),
  constraint category_candidates_subject_present check (
    film_id is not null or nullif(trim(work_title), '') is not null
  ),
  constraint category_candidates_identity_format check (
    identity_key ~ '^[a-f0-9]{64}$'
  ),
  unique (season_id, category_id, identity_key),
  unique (season_id, category_id, id)
);

create table public.category_candidate_people (
  category_candidate_id text not null
    references public.category_candidates (id) on delete cascade,
  person_id text not null references public.people (id) on delete restrict,
  role text not null,
  display_order smallint not null,
  created_at timestamptz not null default now(),
  primary key (category_candidate_id, person_id, role),
  constraint category_candidate_people_role_present check (
    nullif(trim(role), '') is not null
  ),
  constraint category_candidate_people_order_valid check (display_order >= 0),
  unique (category_candidate_id, display_order)
);

create table public.category_candidate_match_history (
  id bigint generated always as identity primary key,
  source_id text not null references public.sources (id) on delete restrict,
  season_id text not null references public.seasons (id) on delete cascade,
  category_id text not null references public.categories (id)
    on delete restrict,
  normalized_subject text not null,
  category_candidate_id text not null
    references public.category_candidates (id) on delete restrict,
  match_kind text not null,
  reason text not null,
  actor text not null,
  created_at timestamptz not null default now(),
  constraint category_candidate_match_subject_present check (
    nullif(trim(normalized_subject), '') is not null
  ),
  constraint category_candidate_match_kind_valid check (
    match_kind in ('film', 'person', 'team', 'category')
  ),
  constraint category_candidate_match_reason_present check (
    nullif(trim(reason), '') is not null
  ),
  constraint category_candidate_match_actor_present check (
    nullif(trim(actor), '') is not null
  ),
  unique (
    source_id,
    season_id,
    category_id,
    normalized_subject,
    category_candidate_id,
    match_kind
  )
);

create table public.film_credit_match_history (
  id bigint generated always as identity primary key,
  film_id text not null references public.films (id) on delete cascade,
  person_id text not null references public.people (id) on delete restrict,
  tmdb_credit_id text not null,
  role text not null,
  department text,
  source_url text not null,
  reason text not null,
  actor text not null,
  created_at timestamptz not null default now(),
  constraint film_credit_match_credit_present check (
    nullif(trim(tmdb_credit_id), '') is not null
  ),
  constraint film_credit_match_role_present check (
    nullif(trim(role), '') is not null
  ),
  constraint film_credit_match_source_https check (source_url ~ '^https://'),
  constraint film_credit_match_reason_present check (
    nullif(trim(reason), '') is not null
  ),
  constraint film_credit_match_actor_present check (
    nullif(trim(actor), '') is not null
  ),
  unique (film_id, person_id, role, source_url)
);

alter table public.professional_observations
add column category_candidate_id text
references public.category_candidates (id) on delete restrict;

insert into public.category_candidates (
  id,
  season_id,
  category_id,
  film_id,
  display_label,
  identity_key
)
select
  'candidate-' || observations.film_id || '-' || observations.category_id,
  observations.season_id,
  observations.category_id,
  observations.film_id,
  films.title,
  md5(
    observations.season_id || ':' || observations.category_id || ':'
    || observations.film_id
  ) || md5(
    'runscars:' || observations.season_id || ':'
    || observations.category_id || ':' || observations.film_id
  )
from public.professional_observations as observations
join public.films on films.id = observations.film_id
where observations.category_id is not null
  and observations.film_id is not null
on conflict (season_id, category_id, identity_key) do nothing;

update public.professional_observations as observations
set category_candidate_id = candidates.id
from public.category_candidates as candidates
where observations.category_candidate_id is null
  and observations.season_id = candidates.season_id
  and observations.category_id = candidates.category_id
  and observations.film_id = candidates.film_id
  and not exists (
    select 1
    from public.category_candidate_people as candidate_people
    where candidate_people.category_candidate_id = candidates.id
  );

alter table public.official_result_entries
add column category_candidate_id text
references public.category_candidates (id) on delete restrict;

alter table public.official_result_entries
drop constraint official_result_entries_subject_exclusive,
drop constraint official_result_entries_candidate_matches;

alter table public.official_result_entries
add constraint official_result_entries_subject_present check (
  category_candidate_id is not null
  or (
    (film_id is not null and person_id is null)
    or (film_id is null and person_id is not null)
  )
),
add constraint official_result_entries_candidate_matches check (
  (
    category_candidate_id is not null
    and candidate_id = category_candidate_id
  )
  or (
    category_candidate_id is null
    and candidate_id = coalesce(film_id, person_id)
  )
);

create type public.market_provider as enum ('kalshi', 'polymarket');

create table public.market_connectors (
  id text primary key,
  source_id text not null references public.sources (id) on delete restrict,
  provider public.market_provider not null unique,
  endpoint_url text not null,
  extractor_version text not null,
  schedule_cron text not null default '17 * * * *',
  is_active boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_connectors_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint market_connectors_url_https check (endpoint_url ~ '^https://'),
  constraint market_connectors_version_present check (
    nullif(trim(extractor_version), '') is not null
  ),
  constraint market_connectors_schedule_present check (
    nullif(trim(schedule_cron), '') is not null
  ),
  constraint market_connectors_configuration_object check (
    jsonb_typeof(configuration) = 'object'
  )
);

create table public.market_capture_runs (
  id bigint generated always as identity primary key,
  connector_id text not null references public.market_connectors (id)
    on delete restrict,
  run_key text not null unique,
  status public.ingestion_run_status not null default 'running',
  started_at timestamptz not null,
  finished_at timestamptz,
  contracts_seen integer not null default 0,
  snapshots_inserted integer not null default 0,
  snapshots_duplicate integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now(),
  constraint market_capture_runs_counts_nonnegative check (
    contracts_seen >= 0
    and snapshots_inserted >= 0
    and snapshots_duplicate >= 0
  )
);

create table public.market_contracts (
  id bigint generated always as identity primary key,
  provider public.market_provider not null,
  source_id text not null references public.sources (id) on delete restrict,
  external_market_id text not null,
  external_contract_id text not null,
  season_id text references public.seasons (id) on delete restrict,
  category_id text references public.categories (id) on delete restrict,
  category_candidate_id text references public.category_candidates (id)
    on delete restrict,
  market_title text not null,
  outcome_label text not null,
  source_url text not null,
  closes_at timestamptz,
  resolved_at timestamptz,
  original_data jsonb not null,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint market_contracts_external_ids_present check (
    nullif(trim(external_market_id), '') is not null
    and nullif(trim(external_contract_id), '') is not null
  ),
  constraint market_contracts_labels_present check (
    nullif(trim(market_title), '') is not null
    and nullif(trim(outcome_label), '') is not null
  ),
  constraint market_contracts_url_https check (source_url ~ '^https://'),
  constraint market_contracts_original_object check (
    jsonb_typeof(original_data) = 'object'
  ),
  unique (provider, external_market_id, external_contract_id)
);

create table public.market_price_snapshots (
  id bigint generated always as identity primary key,
  contract_id bigint not null references public.market_contracts (id)
    on delete restrict,
  run_id bigint not null references public.market_capture_runs (id)
    on delete restrict,
  content_hash text not null,
  probability numeric(8, 7),
  original_price numeric,
  original_currency text,
  volume numeric,
  open_interest numeric,
  observed_at timestamptz not null,
  captured_at timestamptz not null,
  original_data jsonb not null,
  created_at timestamptz not null default now(),
  constraint market_price_snapshots_hash_format check (
    content_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint market_price_snapshots_probability_valid check (
    probability is null or probability between 0 and 1
  ),
  constraint market_price_snapshots_numbers_nonnegative check (
    (volume is null or volume >= 0)
    and (open_interest is null or open_interest >= 0)
  ),
  constraint market_price_snapshots_original_object check (
    jsonb_typeof(original_data) = 'object'
  ),
  unique (contract_id, content_hash)
);

create index category_candidates_scope_idx
  on public.category_candidates (season_id, category_id, display_label);
create index category_candidate_people_person_idx
  on public.category_candidate_people (person_id);
create index professional_observations_candidate_idx
  on public.professional_observations (
    season_id,
    category_id,
    category_candidate_id
  )
  where state = 'published';
create index market_contracts_scope_idx
  on public.market_contracts (season_id, category_id, provider);
create index market_price_snapshots_latest_idx
  on public.market_price_snapshots (contract_id, observed_at desc);

create trigger category_candidates_set_updated_at
before update on public.category_candidates
for each row execute function public.set_updated_at();

create trigger market_connectors_set_updated_at
before update on public.market_connectors
for each row execute function public.set_updated_at();

create trigger market_contracts_immutable
before update or delete on public.market_contracts
for each row execute function public.prevent_locked_record_mutation();

create trigger market_price_snapshots_immutable
before update or delete on public.market_price_snapshots
for each row execute function public.prevent_locked_record_mutation();

alter table public.category_candidates enable row level security;
alter table public.category_candidate_people enable row level security;
alter table public.category_candidate_match_history enable row level security;
alter table public.film_credit_match_history enable row level security;
alter table public.market_connectors enable row level security;
alter table public.market_capture_runs enable row level security;
alter table public.market_contracts enable row level security;
alter table public.market_price_snapshots enable row level security;

grant select on table
  public.category_candidates,
  public.category_candidate_people,
  public.market_contracts,
  public.market_price_snapshots
to anon, authenticated;

grant select, insert, update on table
  public.category_candidates,
  public.category_candidate_people,
  public.market_connectors,
  public.market_capture_runs
to service_role;

grant select, insert on table
  public.category_candidate_match_history,
  public.film_credit_match_history,
  public.market_contracts,
  public.market_price_snapshots
to service_role;

grant usage, select on all sequences in schema public to service_role;

-- Los procesos server-side de matching necesitan resolver y ampliar el catálogo
-- base. El service role evita RLS, pero PostgreSQL sigue exigiendo privilegios
-- explícitos sobre las tablas creadas en la fase 3.
grant select on table
  public.seasons,
  public.categories,
  public.season_categories,
  public.sources
to service_role;

grant select, insert, update on table public.films to service_role;
grant select, insert on table public.season_films to service_role;

create policy category_candidates_public_read
on public.category_candidates for select
to anon, authenticated
using (
  exists (
    select 1
    from public.categories
    where categories.id = category_candidates.category_id
      and categories.is_public = true
  )
);

create policy category_candidate_people_public_read
on public.category_candidate_people for select
to anon, authenticated
using (
  exists (
    select 1
    from public.category_candidates
    join public.categories
      on categories.id = category_candidates.category_id
    where category_candidates.id
      = category_candidate_people.category_candidate_id
      and categories.is_public = true
  )
);

create policy market_contracts_public_read
on public.market_contracts for select
to anon, authenticated
using (
  category_id is null
  or exists (
    select 1
    from public.categories
    where categories.id = market_contracts.category_id
      and categories.is_public = true
  )
);

create policy market_price_snapshots_public_read
on public.market_price_snapshots for select
to anon, authenticated
using (
  exists (
    select 1
    from public.market_contracts
    where market_contracts.id = market_price_snapshots.contract_id
  )
);

comment on table public.category_candidates is
  'Identidad canónica v2 por temporada, categoría, película u obra y equipo ordenado.';
comment on table public.category_candidate_match_history is
  'Correcciones editoriales trazables; nunca sustituyen la captura original.';
comment on table public.market_price_snapshots is
  'Capturas append-only de mercado, deliberadamente fuera de observaciones profesionales.';

create or replace function public.lock_official_result_set(
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

  if result_schema_version = 'runscars-snapshot-v2' then
    if exists (
      select 1
      from jsonb_array_elements(result_payload -> 'entries') as raw(entry)
      left join public.category_candidates
        on category_candidates.id = nullif(
          raw.entry ->> 'categoryCandidateId',
          ''
        )
        and category_candidates.season_id = result_season_id
        and category_candidates.category_id = raw.entry ->> 'categoryId'
      where category_candidates.id is null
        or raw.entry ->> 'candidateId'
          <> raw.entry ->> 'categoryCandidateId'
        or (
          result_kind = 'nominations'
          and raw.entry ->> 'outcome' <> 'nominee'
        )
        or (
          result_kind = 'winners'
          and raw.entry ->> 'outcome' <> 'winner'
        )
    ) then
      raise exception 'An official v2 result entry has an invalid shape';
    end if;
  elsif exists (
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
    raise exception 'An official legacy result entry has an invalid shape';
  end if;

  if result_kind = 'winners' and exists (
    select 1
    from (
      select entry ->> 'categoryId' as category_id, count(*) as winners
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
    category_candidate_id,
    outcome
  )
  select
    result_set_id,
    entry ->> 'categoryId',
    entry ->> 'candidateId',
    nullif(entry ->> 'filmId', ''),
    nullif(entry ->> 'personId', ''),
    nullif(entry ->> 'categoryCandidateId', ''),
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

-- Configuración desplegable de fase 7.1. El seed local conserva el mismo
-- catálogo, pero staging no depende de que se ejecute un seed destructivo.
insert into public.seasons (
  id,
  ceremony_year,
  eligibility_year,
  status
)
values ('oscars-2027', 2027, 2026, 'active')
on conflict (id) do update set
  ceremony_year = excluded.ceremony_year,
  eligibility_year = excluded.eligibility_year,
  status = excluded.status;

insert into public.seasons (
  id,
  ceremony_year,
  eligibility_year,
  nominations_announced_on,
  ceremony_on,
  status
)
values (
  'oscars-2026',
  2026,
  2025,
  '2026-01-22',
  '2026-03-15',
  'closed'
)
on conflict (id) do update set
  ceremony_year = excluded.ceremony_year,
  eligibility_year = excluded.eligibility_year,
  nominations_announced_on = excluded.nominations_announced_on,
  ceremony_on = excluded.ceremony_on,
  status = excluded.status;

insert into public.categories (
  id,
  name,
  subject,
  display_order,
  is_public,
  candidate_kind
)
values
  ('best-picture', 'Mejor película', 'film', 1, true, 'film'),
  ('directing', 'Dirección', 'person', 2, true, 'team'),
  ('actor', 'Actor protagonista', 'person', 3, true, 'performance'),
  ('actress', 'Actriz protagonista', 'person', 4, true, 'performance'),
  ('supporting-actor', 'Actor de reparto', 'person', 5, true, 'performance'),
  ('supporting-actress', 'Actriz de reparto', 'person', 6, true, 'performance'),
  ('original-screenplay', 'Guion original', 'film', 7, true, 'team'),
  ('adapted-screenplay', 'Guion adaptado', 'film', 8, true, 'team'),
  ('casting', 'Casting', 'film', 9, false, 'team'),
  ('cinematography', 'Fotografía', 'film', 10, false, 'team'),
  ('film-editing', 'Montaje', 'film', 11, false, 'team'),
  ('original-score', 'Música original', 'film', 12, false, 'team'),
  ('original-song', 'Canción original', 'film', 13, false, 'work'),
  ('sound', 'Sonido', 'film', 14, false, 'team'),
  ('visual-effects', 'Efectos visuales', 'film', 15, false, 'team'),
  ('animated-feature', 'Película de animación', 'film', 16, false, 'film'),
  ('documentary-feature', 'Documental', 'film', 17, false, 'film'),
  ('international-feature', 'Película internacional', 'film', 18, false, 'film'),
  ('costume-design', 'Vestuario', 'film', 19, false, 'team'),
  ('makeup-hairstyling', 'Maquillaje y peluquería', 'film', 20, false, 'team'),
  ('production-design', 'Diseño de producción', 'film', 21, false, 'team')
on conflict (id) do update set
  name = excluded.name,
  subject = excluded.subject,
  display_order = excluded.display_order,
  is_public = excluded.is_public,
  candidate_kind = excluded.candidate_kind;

insert into public.season_categories (season_id, category_id)
select 'oscars-2027', id
from public.categories
on conflict (season_id, category_id) do update set is_enabled = true;

insert into public.season_categories (season_id, category_id)
select 'oscars-2026', id
from public.categories
where is_public = true
on conflict (season_id, category_id) do update set is_enabled = true;

insert into public.films (
  id,
  title,
  alternate_titles,
  eligibility_year,
  release_status,
  release_date,
  verification_url,
  notes
)
values
  ('one-battle-after-another', 'One Battle After Another', '{}', 2025, 'released', '2025-09-23', 'https://www.oscars.org/oscars/ceremonies/2026', 'Nominada y ganadora oficial de 2026'),
  ('bugonia', 'Bugonia', '{}', 2025, 'released', '2025-10-23', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('f1', 'F1', array['F1 The Movie'], 2025, 'released', '2025-06-25', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('frankenstein-2025', 'Frankenstein', '{}', 2025, 'released', '2025-10-17', 'https://www.oscars.org/oscars/ceremonies/2026', 'Película de Guillermo del Toro'),
  ('hamnet', 'Hamnet', '{}', 2025, 'released', '2025-11-26', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('marty-supreme', 'Marty Supreme', '{}', 2025, 'released', '2025-12-19', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('the-secret-agent', 'The Secret Agent', '{}', 2025, 'released', '2025-07-23', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('sentimental-value', 'Sentimental Value', '{}', 2025, 'released', '2025-08-20', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('sinners', 'Sinners', '{}', 2025, 'released', '2025-04-16', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('train-dreams', 'Train Dreams', '{}', 2025, 'released', '2025-11-05', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('blue-moon', 'Blue Moon', '{}', 2025, 'released', '2025-10-17', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('if-i-had-legs-id-kick-you', 'If I Had Legs I''d Kick You', array['If I Had Legs I’d Kick You'], 2025, 'released', '2025-10-10', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('song-sung-blue', 'Song Sung Blue', '{}', 2025, 'released', '2025-12-15', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('weapons', 'Weapons', '{}', 2025, 'released', '2025-08-04', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('it-was-just-an-accident', 'It Was Just an Accident', array['Un simple accident'], 2025, 'released', '2025-10-01', 'https://www.oscars.org/oscars/ceremonies/2026', null)
on conflict (id) do update set
  title = excluded.title,
  alternate_titles = excluded.alternate_titles,
  eligibility_year = excluded.eligibility_year,
  release_status = excluded.release_status,
  release_date = excluded.release_date,
  verification_url = excluded.verification_url,
  notes = excluded.notes;

insert into public.season_films (season_id, film_id)
select 'oscars-2026', id
from public.films
where eligibility_year = 2025
on conflict (season_id, film_id) do nothing;

insert into public.sources (
  id,
  name,
  source_types,
  homepage_url,
  editorial_status,
  technical_status,
  publication_status,
  last_reviewed_on
)
values
  ('academy', 'Academy of Motion Picture Arts and Sciences', array['official'], 'https://www.oscars.org/', 'selected', 'automated', 'publishable', '2026-07-25'),
  ('awardswatch', 'AwardsWatch', array['prediction'], 'https://awardswatch.com/', 'selected', 'automated', 'publishable', '2026-07-25'),
  ('awards-daily', 'Awards Daily', array['prediction'], 'https://www.awardsdaily.com/', 'selected', 'automated', 'publishable', '2026-07-25'),
  ('awards-radar', 'Awards Radar', array['prediction'], 'https://awardsradar.com/', 'selected', 'automated', 'publishable', '2026-07-25'),
  ('next-best-picture', 'Next Best Picture', array['prediction', 'review'], 'https://nextbestpicture.com/', 'selected', 'automated', 'publishable', '2026-07-25'),
  ('midnight-critics', 'Midnight Critics Circle', array['prediction'], 'https://www.midnightcritics.com/', 'selected', 'automated', 'publishable', '2026-07-25'),
  ('the-ringer', 'The Ringer', array['prediction'], 'https://www.theringer.com/', 'selected', 'automated', 'publishable', '2026-07-25'),
  ('kalshi', 'Kalshi', array['market'], 'https://kalshi.com/', 'selected', 'automated', 'publishable', '2026-07-25'),
  ('polymarket', 'Polymarket', array['market'], 'https://polymarket.com/', 'selected', 'automated', 'publishable', '2026-07-25')
on conflict (id) do update set
  name = excluded.name,
  source_types = excluded.source_types,
  homepage_url = excluded.homepage_url,
  editorial_status = excluded.editorial_status,
  technical_status = excluded.technical_status,
  publication_status = excluded.publication_status,
  last_reviewed_on = excluded.last_reviewed_on;

insert into public.source_connectors (
  id,
  source_id,
  name,
  kind,
  endpoint_url,
  extractor_version,
  is_active,
  schedule_cron,
  configuration
)
values
  ('awardswatch-predictions', 'awardswatch', 'AwardsWatch Oscar Predictions HQ', 'html', 'https://awardswatch.com/oscar-predictions-hq/', 'awardswatch-multicategory-v2', true, '17 4 * * *', '{"season_id":"oscars-2027","ceremony_year":2027,"category_ids":["best-picture","directing","actor","actress","supporting-actor","supporting-actress","original-screenplay","adapted-screenplay"]}'::jsonb),
  ('awards-daily-predictions', 'awards-daily', 'Awards Daily Oscar predictions', 'html', 'https://www.awardsdaily.com/2026/05/04/may-predictions-and-temperature-check-on-all-oscar-categories/', 'awards-daily-v1', true, '17 4 * * *', '{"season_id":"oscars-2027"}'::jsonb),
  ('awards-radar-predictions', 'awards-radar', 'Awards Radar Oscar predictions', 'html', 'https://awardsradar.com/2026/04/10/year-in-advance-oscar-predictions-far-out-thoughts-on-what-the-academy-might-be-thinking-in-2027-part-two/', 'awards-radar-v1', true, '17 4 * * *', '{"season_id":"oscars-2027"}'::jsonb),
  ('next-best-picture-predictions', 'next-best-picture', 'Next Best Picture Oscar predictions', 'html', 'https://predictions.nextbestpicture.com/u/655756da85df4c0efaa10bd2/oscars', 'next-best-picture-v1', true, '17 4 * * *', '{"season_id":"oscars-2027"}'::jsonb),
  ('midnight-critics-predictions', 'midnight-critics', 'Midnight Critics Circle consensus', 'html', 'https://www.midnightcritics.com/predictions/2027-oscar-predictions', 'midnight-critics-v1', true, '17 4 * * *', '{"season_id":"oscars-2027"}'::jsonb),
  ('ringer-best-picture', 'the-ringer', 'The Ringer Best Picture selections', 'html', 'https://www.theringer.com/2026/03/20/oscars/oscars-2027-predictions-best-picture-movies-contenders', 'the-ringer-v1', true, '17 4 * * *', '{"season_id":"oscars-2027","category_id":"best-picture"}'::jsonb),
  ('academy-archive-2026', 'academy', 'Archivo oficial Oscars 2026', 'html', 'https://www.oscars.org/oscars/ceremonies/2026', 'academy-archive-v1', false, null, '{"season_id":"oscars-2026","manifest":"web/data/phase-7/oscars-2026.json","command":"npm run results:archive"}'::jsonb)
on conflict (id) do update set
  source_id = excluded.source_id,
  name = excluded.name,
  kind = excluded.kind,
  endpoint_url = excluded.endpoint_url,
  extractor_version = excluded.extractor_version,
  is_active = excluded.is_active,
  schedule_cron = excluded.schedule_cron,
  configuration = excluded.configuration;

update public.source_connectors
set is_active = false, schedule_cron = null
where id = 'awardswatch-best-picture';

insert into public.snapshot_schedules (
  id,
  season_id,
  category_id,
  prediction_intention,
  kind,
  cron_expression,
  time_zone,
  is_active
)
select
  'oscars-2027-' || id || '-nomination-weekly',
  'oscars-2027',
  id,
  'nomination',
  'periodic',
  '47 4 * * 1',
  'UTC',
  true
from public.categories
where is_public = true
on conflict (id) do update set
  season_id = excluded.season_id,
  category_id = excluded.category_id,
  prediction_intention = excluded.prediction_intention,
  kind = excluded.kind,
  cron_expression = excluded.cron_expression,
  time_zone = excluded.time_zone,
  is_active = excluded.is_active;

insert into public.market_connectors (
  id,
  source_id,
  provider,
  endpoint_url,
  extractor_version,
  schedule_cron,
  is_active,
  configuration
)
values
  ('kalshi-oscars', 'kalshi', 'kalshi', 'https://external-api.kalshi.com/trade-api/v2/markets', 'kalshi-v1', '17 * * * *', true, '{"query":"Oscar","season_id":"oscars-2027"}'::jsonb),
  ('polymarket-oscars', 'polymarket', 'polymarket', 'https://gamma-api.polymarket.com/markets', 'polymarket-v1', '17 * * * *', true, '{"query":"Oscars","season_id":"oscars-2027"}'::jsonb)
on conflict (id) do update set
  source_id = excluded.source_id,
  provider = excluded.provider,
  endpoint_url = excluded.endpoint_url,
  extractor_version = excluded.extractor_version,
  schedule_cron = excluded.schedule_cron,
  is_active = excluded.is_active,
  configuration = excluded.configuration;
