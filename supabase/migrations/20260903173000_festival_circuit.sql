-- Circuito internacional 2026. Señal contextual separada del consenso Oscar.

create type public.festival_edition_status as enum (
  'scheduled',
  'ongoing',
  'completed'
);

create type public.festival_awards_status as enum (
  'pending',
  'published',
  'not_applicable'
);

create type public.festival_set_kind as enum ('selection', 'awards');

create type public.festival_match_status as enum (
  'matched',
  'pending_review',
  'unmatched'
);

create table public.festivals (
  id text primary key,
  name text not null unique,
  name_en text not null,
  short_name text not null,
  homepage_url text not null,
  is_competitive boolean not null default true,
  display_order smallint not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint festivals_id_format check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint festivals_names_present check (
    nullif(trim(name), '') is not null
    and nullif(trim(name_en), '') is not null
    and nullif(trim(short_name), '') is not null
  ),
  constraint festivals_homepage_https check (homepage_url ~ '^https://')
);

create table public.festival_editions (
  id text primary key,
  festival_id text not null references public.festivals (id)
    on delete restrict,
  season_id text not null references public.seasons (id) on delete restrict,
  edition_year smallint not null,
  edition_number smallint,
  starts_on date not null,
  ends_on date not null,
  status public.festival_edition_status not null,
  awards_status public.festival_awards_status not null,
  official_url text not null,
  selection_url text not null,
  awards_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint festival_editions_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint festival_editions_year_range check (
    edition_year between 1927 and 2200
  ),
  constraint festival_editions_date_order check (starts_on <= ends_on),
  constraint festival_editions_urls_https check (
    official_url ~ '^https://'
    and selection_url ~ '^https://'
    and (awards_url is null or awards_url ~ '^https://')
  ),
  constraint festival_editions_awards_state check (
    (awards_status <> 'not_applicable')
    or awards_url is null
  ),
  unique (festival_id, edition_year)
);

create table public.festival_connectors (
  id text primary key,
  festival_id text not null references public.festivals (id)
    on delete restrict,
  source_id text not null references public.sources (id) on delete restrict,
  name text not null,
  kind public.connector_kind not null,
  endpoint_url text not null,
  extractor_version text not null,
  schedule_cron text not null default '17 5 * * *',
  is_active boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint festival_connectors_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint festival_connectors_url_https check (endpoint_url ~ '^https://'),
  constraint festival_connectors_version_present check (
    nullif(trim(extractor_version), '') is not null
  ),
  constraint festival_connectors_schedule_present check (
    nullif(trim(schedule_cron), '') is not null
  ),
  constraint festival_connectors_configuration_object check (
    jsonb_typeof(configuration) = 'object'
  )
);

create table public.festival_capture_runs (
  id bigint generated always as identity primary key,
  connector_id text not null references public.festival_connectors (id)
    on delete restrict,
  run_key text not null unique,
  trigger public.ingestion_trigger not null,
  status public.ingestion_run_status not null default 'running',
  started_at timestamptz not null,
  finished_at timestamptz,
  editions_seen integer not null default 0,
  sets_inserted integer not null default 0,
  sets_duplicate integer not null default 0,
  review_items_created integer not null default 0,
  error_summary text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint festival_capture_runs_counts_nonnegative check (
    editions_seen >= 0
    and sets_inserted >= 0
    and sets_duplicate >= 0
    and review_items_created >= 0
  ),
  constraint festival_capture_runs_details_object check (
    jsonb_typeof(details) = 'object'
  )
);

create table public.festival_sets (
  id text primary key,
  edition_id text not null references public.festival_editions (id)
    on delete restrict,
  kind public.festival_set_kind not null,
  version integer not null,
  content_hash text not null,
  source_url text not null,
  source_title text not null,
  published_at timestamptz,
  captured_at timestamptz not null,
  raw_capture jsonb not null,
  extractor_version text not null,
  corrects_set_id text references public.festival_sets (id)
    on delete restrict,
  correction_reason text,
  created_at timestamptz not null default now(),
  constraint festival_sets_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint festival_sets_version_positive check (version > 0),
  constraint festival_sets_hash_format check (content_hash ~ '^[a-f0-9]{64}$'),
  constraint festival_sets_source_https check (source_url ~ '^https://'),
  constraint festival_sets_source_title_present check (
    nullif(trim(source_title), '') is not null
  ),
  constraint festival_sets_raw_object check (jsonb_typeof(raw_capture) = 'object'),
  constraint festival_sets_extractor_present check (
    nullif(trim(extractor_version), '') is not null
  ),
  constraint festival_sets_correction_pair check (
    (corrects_set_id is null and correction_reason is null)
    or (
      corrects_set_id is not null
      and nullif(trim(correction_reason), '') is not null
    )
  ),
  constraint festival_sets_not_self_correction check (
    corrects_set_id is null or corrects_set_id <> id
  ),
  unique (edition_id, kind, version),
  unique (edition_id, kind, content_hash)
);

create table public.festival_entries (
  id bigint generated always as identity primary key,
  set_id text not null references public.festival_sets (id)
    on delete restrict,
  entry_order smallint not null,
  section text not null,
  original_title text not null,
  original_recipient text,
  award_type text,
  is_feature boolean not null default true,
  film_id text references public.films (id) on delete restrict,
  match_status public.festival_match_status not null default 'unmatched',
  original_data jsonb not null,
  created_at timestamptz not null default now(),
  constraint festival_entries_order_positive check (entry_order > 0),
  constraint festival_entries_section_present check (
    nullif(trim(section), '') is not null
  ),
  constraint festival_entries_title_present check (
    nullif(trim(original_title), '') is not null
  ),
  constraint festival_entries_award_shape check (
    award_type is null or nullif(trim(award_type), '') is not null
  ),
  constraint festival_entries_match_shape check (
    (match_status = 'matched' and film_id is not null)
    or (match_status <> 'matched' and film_id is null)
  ),
  constraint festival_entries_original_object check (
    jsonb_typeof(original_data) = 'object'
  ),
  unique (set_id, entry_order)
);

create table public.current_festival_sets (
  edition_id text not null references public.festival_editions (id)
    on delete cascade,
  kind public.festival_set_kind not null,
  set_id text not null unique references public.festival_sets (id)
    on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (edition_id, kind)
);

create table public.festival_entry_match_history (
  id bigint generated always as identity primary key,
  entry_id bigint not null references public.festival_entries (id)
    on delete restrict,
  normalized_title text not null,
  status public.festival_match_status not null,
  film_id text references public.films (id) on delete restrict,
  candidate_film_ids text[] not null default '{}',
  reason text not null,
  actor text not null,
  created_at timestamptz not null default now(),
  constraint festival_match_history_title_present check (
    nullif(trim(normalized_title), '') is not null
  ),
  constraint festival_match_history_shape check (
    (status = 'matched' and film_id is not null)
    or (status <> 'matched' and film_id is null)
  ),
  constraint festival_match_history_reason_present check (
    nullif(trim(reason), '') is not null
  ),
  constraint festival_match_history_actor_present check (
    nullif(trim(actor), '') is not null
  )
);

create table public.current_festival_entry_matches (
  entry_id bigint primary key references public.festival_entries (id)
    on delete cascade,
  match_history_id bigint not null unique
    references public.festival_entry_match_history (id) on delete restrict,
  updated_at timestamptz not null default now()
);

create index festival_editions_season_status_idx
on public.festival_editions (season_id, status, starts_on);
create index festival_entries_film_idx
on public.festival_entries (film_id) where film_id is not null;
create index festival_entries_review_idx
on public.festival_entries (match_status, created_at)
where match_status <> 'matched';
create index festival_runs_connector_started_idx
on public.festival_capture_runs (connector_id, started_at desc);

create trigger festivals_set_updated_at
before update on public.festivals
for each row execute function public.set_updated_at();
create trigger festival_editions_set_updated_at
before update on public.festival_editions
for each row execute function public.set_updated_at();
create trigger festival_connectors_set_updated_at
before update on public.festival_connectors
for each row execute function public.set_updated_at();
create trigger festival_sets_immutable
before update or delete on public.festival_sets
for each row execute function public.prevent_locked_record_mutation();
create trigger festival_entries_immutable
before update or delete on public.festival_entries
for each row execute function public.prevent_locked_record_mutation();
create trigger festival_match_history_immutable
before update or delete on public.festival_entry_match_history
for each row execute function public.prevent_locked_record_mutation();

alter table public.festivals enable row level security;
alter table public.festival_editions enable row level security;
alter table public.festival_connectors enable row level security;
alter table public.festival_capture_runs enable row level security;
alter table public.festival_sets enable row level security;
alter table public.festival_entries enable row level security;
alter table public.current_festival_sets enable row level security;
alter table public.festival_entry_match_history enable row level security;
alter table public.current_festival_entry_matches enable row level security;

grant select on table
  public.festivals,
  public.festival_editions,
  public.festival_sets,
  public.festival_entries,
  public.current_festival_sets,
  public.festival_entry_match_history,
  public.current_festival_entry_matches
to anon, authenticated;

grant select on table public.festival_connectors to authenticated;
grant select, insert, update on table
  public.festivals,
  public.festival_editions,
  public.festival_connectors,
  public.festival_capture_runs,
  public.current_festival_sets,
  public.current_festival_entry_matches
to service_role;
grant select, insert on table
  public.festival_sets,
  public.festival_entries,
  public.festival_entry_match_history
to service_role;
grant usage, select on all sequences in schema public to service_role;

create policy festivals_public_read on public.festivals for select
to anon, authenticated using (true);
create policy festival_editions_public_read on public.festival_editions for select
to anon, authenticated using (true);
create policy festival_sets_public_read on public.festival_sets for select
to anon, authenticated using (true);
create policy festival_entries_public_read on public.festival_entries for select
to anon, authenticated using (is_feature = true);
create policy current_festival_sets_public_read
on public.current_festival_sets for select
to anon, authenticated using (true);
create policy festival_match_history_public_read
on public.festival_entry_match_history for select
to anon, authenticated using (true);
create policy current_festival_entry_matches_public_read
on public.current_festival_entry_matches for select
to anon, authenticated using (true);

insert into public.sources (
  id,
  name,
  source_types,
  homepage_url,
  editorial_status,
  technical_status,
  publication_status,
  last_reviewed_on,
  notes
)
values
  ('sundance', 'Sundance Film Festival', array['festival'], 'https://www.sundance.org/festivals/sundance-film-festival/', 'selected', 'automated', 'publishable', '2026-09-03', 'Selección y palmarés oficiales; señal contextual separada'),
  ('berlinale', 'Berlin International Film Festival', array['festival'], 'https://www.berlinale.de/en/home.html', 'selected', 'automated', 'publishable', '2026-09-03', 'Selección y premios oficiales de la Berlinale'),
  ('cannes', 'Festival de Cannes', array['festival'], 'https://www.festival-cannes.com/en/', 'selected', 'automated', 'publishable', '2026-09-03', 'Selección oficial y palmarés; excluye secciones paralelas'),
  ('locarno', 'Locarno Film Festival', array['festival'], 'https://www.locarnofestival.ch/', 'selected', 'automated', 'publishable', '2026-09-03', 'Selección y palmarés oficiales de largometrajes'),
  ('venice', 'La Biennale di Venezia — Cinema', array['festival'], 'https://www.labiennale.org/en/cinema', 'selected', 'automated', 'publishable', '2026-09-03', 'Edición en curso; premios pendientes hasta el cierre'),
  ('tiff', 'Toronto International Film Festival', array['festival'], 'https://tiff.net/', 'selected', 'automated', 'publishable', '2026-09-03', 'Selecciones y premios oficiales del TIFF'),
  ('san-sebastian', 'Festival de San Sebastián', array['festival'], 'https://www.sansebastianfestival.com/', 'selected', 'automated', 'publishable', '2026-09-03', 'Selección y palmarés oficiales'),
  ('telluride', 'Telluride Film Festival', array['festival'], 'https://www.telluridefilmfestival.org/', 'selected', 'automated', 'publishable', '2026-09-03', 'Selección no competitiva; palmarés no aplicable'),
  ('nyff', 'New York Film Festival', array['festival'], 'https://www.filmlinc.org/nyff/', 'selected', 'automated', 'publishable', '2026-09-03', 'Selección no competitiva; palmarés no aplicable')
on conflict (id) do update set
  name = excluded.name,
  source_types = excluded.source_types,
  homepage_url = excluded.homepage_url,
  editorial_status = excluded.editorial_status,
  technical_status = excluded.technical_status,
  publication_status = excluded.publication_status,
  last_reviewed_on = excluded.last_reviewed_on,
  notes = excluded.notes;

insert into public.festivals (
  id, name, name_en, short_name, homepage_url, is_competitive, display_order
)
values
  ('sundance', 'Festival de Sundance', 'Sundance Film Festival', 'Sundance', 'https://www.sundance.org/festivals/sundance-film-festival/', true, 1),
  ('berlinale', 'Festival Internacional de Cine de Berlín', 'Berlin International Film Festival', 'Berlinale', 'https://www.berlinale.de/en/home.html', true, 2),
  ('cannes', 'Festival de Cannes', 'Festival de Cannes', 'Cannes', 'https://www.festival-cannes.com/en/', true, 3),
  ('locarno', 'Festival de Locarno', 'Locarno Film Festival', 'Locarno', 'https://www.locarnofestival.ch/', true, 4),
  ('venice', 'Festival de Venecia', 'Venice International Film Festival', 'Venecia', 'https://www.labiennale.org/en/cinema', true, 5),
  ('tiff', 'Festival Internacional de Cine de Toronto', 'Toronto International Film Festival', 'TIFF', 'https://tiff.net/', true, 6),
  ('san-sebastian', 'Festival de San Sebastián', 'San Sebastián International Film Festival', 'San Sebastián', 'https://www.sansebastianfestival.com/', true, 7),
  ('telluride', 'Festival de Telluride', 'Telluride Film Festival', 'Telluride', 'https://www.telluridefilmfestival.org/', false, 8),
  ('nyff', 'Festival de Cine de Nueva York', 'New York Film Festival', 'NYFF', 'https://www.filmlinc.org/nyff/', false, 9)
on conflict (id) do update set
  name = excluded.name,
  name_en = excluded.name_en,
  short_name = excluded.short_name,
  homepage_url = excluded.homepage_url,
  is_competitive = excluded.is_competitive,
  display_order = excluded.display_order;

insert into public.festival_editions (
  id,
  festival_id,
  season_id,
  edition_year,
  edition_number,
  starts_on,
  ends_on,
  status,
  awards_status,
  official_url,
  selection_url,
  awards_url,
  last_verified_at
)
values
  ('sundance-2026', 'sundance', 'oscars-2027', 2026, null, '2026-01-22', '2026-02-01', 'completed', 'published', 'https://festival.sundance.org/', 'https://www.sundance.org/blogs/2026-sundance-film-festival-unveils-97-projects-selected-for-the-feature-film-and-episodic-program/', 'https://www.sundance.org/blogs/the-complete-list-of-2026-sundance-film-festival-award-winners/', '2026-09-03T00:00:00Z'),
  ('berlinale-2026', 'berlinale', 'oscars-2027', 2026, 76, '2026-02-12', '2026-02-22', 'completed', 'published', 'https://www.berlinale.de/en/2026.html', 'https://www.berlinale.de/en/2026/programme/filmprogramme.html', 'https://www.berlinale.de/en/archive/awards-juries/awards.html', '2026-09-03T00:00:00Z'),
  ('cannes-2026', 'cannes', 'oscars-2027', 2026, 79, '2026-05-12', '2026-05-23', 'completed', 'published', 'https://www.festival-cannes.com/en/2026/', 'https://www.festival-cannes.com/en/press/press-releases/the-films-of-the-official-selection-2026/', 'https://www.festival-cannes.com/en/press/press-releases/the-79th-festival-de-cannes-winners-list/', '2026-09-03T00:00:00Z'),
  ('locarno-2026', 'locarno', 'oscars-2027', 2026, 79, '2026-08-05', '2026-08-15', 'completed', 'published', 'https://www.locarnofestival.ch/', 'https://www.locarnofestival.ch/en/festival/program.html', 'https://www.locarnofestival.ch/en/festival/palmares.html', '2026-09-03T00:00:00Z'),
  ('venice-2026', 'venice', 'oscars-2027', 2026, 83, '2026-09-02', '2026-09-12', 'ongoing', 'pending', 'https://www.labiennale.org/en/cinema/2026/83rd-festival', 'https://www.labiennale.org/en/cinema/2026/lineup', 'https://www.labiennale.org/en/cinema/2026/awards', '2026-09-03T00:00:00Z'),
  ('tiff-2026', 'tiff', 'oscars-2027', 2026, 51, '2026-09-10', '2026-09-20', 'scheduled', 'pending', 'https://tiff.net/films', 'https://tiff.net/press/news', 'https://tiff.net/press/news', '2026-09-03T00:00:00Z'),
  ('san-sebastian-2026', 'san-sebastian', 'oscars-2027', 2026, 74, '2026-09-18', '2026-09-26', 'scheduled', 'pending', 'https://www.sansebastianfestival.com/2026/', 'https://www.sansebastianfestival.com/2026/sections_and_films/', 'https://www.sansebastianfestival.com/2026/awards_and_jury_members/1/23162/in', '2026-09-03T00:00:00Z'),
  ('telluride-2026', 'telluride', 'oscars-2027', 2026, 53, '2026-09-04', '2026-09-07', 'scheduled', 'not_applicable', 'https://www.telluridefilmfestival.org/', 'https://www.telluridefilmfestival.org/show', null, '2026-09-03T00:00:00Z'),
  ('nyff-2026', 'nyff', 'oscars-2027', 2026, 64, '2026-09-25', '2026-10-12', 'scheduled', 'not_applicable', 'https://www.filmlinc.org/nyff/', 'https://www.filmlinc.org/nyff/nyff64-lineup/', null, '2026-09-03T00:00:00Z')
on conflict (id) do update set
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  status = excluded.status,
  awards_status = excluded.awards_status,
  official_url = excluded.official_url,
  selection_url = excluded.selection_url,
  awards_url = excluded.awards_url,
  last_verified_at = excluded.last_verified_at;

insert into public.festival_connectors (
  id,
  festival_id,
  source_id,
  name,
  kind,
  endpoint_url,
  extractor_version,
  schedule_cron,
  configuration
)
select
  'festival-' || edition.festival_id,
  edition.festival_id,
  edition.festival_id,
  festival.short_name || ' 2026 official data',
  'html',
  edition.selection_url,
  'festival-manifest-v1',
  '17 5 * * *',
  jsonb_build_object(
    'edition_id', edition.id,
    'selection_url', edition.selection_url,
    'awards_url', edition.awards_url,
    'ends_on', edition.ends_on,
    'awards_status', edition.awards_status
  )
from public.festival_editions as edition
join public.festivals as festival on festival.id = edition.festival_id
on conflict (id) do update set
  endpoint_url = excluded.endpoint_url,
  extractor_version = excluded.extractor_version,
  schedule_cron = excluded.schedule_cron,
  configuration = excluded.configuration;

create function public.persist_festival_set(
  payload jsonb,
  matching_actor text default 'automatic-exact-title'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  edition_id_value text := payload ->> 'editionId';
  kind_value public.festival_set_kind := (payload ->> 'kind')::public.festival_set_kind;
  hash_value text := payload ->> 'contentHash';
  set_id_value text;
  version_value integer;
  entry_value jsonb;
  entry_id_value bigint;
  history_id_value bigint;
begin
  if coalesce(nullif(trim(matching_actor), ''), '') = '' then
    raise exception 'matching_actor es obligatorio';
  end if;

  perform 1
  from public.festival_editions
  where id = edition_id_value
  for update;
  if not found then
    raise exception 'Edición festivalera desconocida: %', edition_id_value;
  end if;

  -- El bloqueo por edición serializa imports concurrentes. La comprobación de
  -- hash debe ocurrir después para que dos procesos idénticos sean idempotentes.
  select id, version into set_id_value, version_value
  from public.festival_sets
  where edition_id = edition_id_value
    and kind = kind_value
    and content_hash = hash_value;

  if set_id_value is not null then
    return jsonb_build_object(
      'status', 'duplicate',
      'setId', set_id_value,
      'version', version_value,
      'entriesInserted', 0
    );
  end if;

  select coalesce(max(version), 0) + 1 into version_value
  from public.festival_sets
  where edition_id = edition_id_value and kind = kind_value;

  set_id_value := edition_id_value || '-' || kind_value::text || '-' || left(hash_value, 12);
  insert into public.festival_sets (
    id,
    edition_id,
    kind,
    version,
    content_hash,
    source_url,
    source_title,
    published_at,
    captured_at,
    raw_capture,
    extractor_version,
    corrects_set_id,
    correction_reason
  ) values (
    set_id_value,
    edition_id_value,
    kind_value,
    version_value,
    hash_value,
    payload #>> '{source,url}',
    payload #>> '{source,title}',
    nullif(payload #>> '{source,publishedAt}', '')::timestamptz,
    (payload ->> 'capturedAt')::timestamptz,
    payload -> 'rawCapture',
    payload ->> 'extractorVersion',
    nullif(payload ->> 'correctsSetId', ''),
    nullif(payload ->> 'correctionReason', '')
  );

  for entry_value in
    select value
    from jsonb_array_elements(payload -> 'entries')
    order by (value ->> 'entryOrder')::integer
  loop
    insert into public.festival_entries (
      set_id,
      entry_order,
      section,
      original_title,
      original_recipient,
      award_type,
      is_feature,
      film_id,
      match_status,
      original_data
    ) values (
      set_id_value,
      (entry_value ->> 'entryOrder')::smallint,
      entry_value ->> 'section',
      entry_value ->> 'originalTitle',
      nullif(entry_value ->> 'originalRecipient', ''),
      nullif(entry_value ->> 'awardType', ''),
      coalesce((entry_value ->> 'isFeature')::boolean, true),
      nullif(entry_value ->> 'filmId', ''),
      (entry_value ->> 'status')::public.festival_match_status,
      entry_value -> 'originalData'
    ) returning id into entry_id_value;

    insert into public.festival_entry_match_history (
      entry_id,
      normalized_title,
      status,
      film_id,
      candidate_film_ids,
      reason,
      actor
    ) values (
      entry_id_value,
      entry_value ->> 'normalizedTitle',
      (entry_value ->> 'status')::public.festival_match_status,
      nullif(entry_value ->> 'filmId', ''),
      coalesce(
        array(select jsonb_array_elements_text(entry_value -> 'candidateFilmIds')),
        '{}'
      ),
      entry_value ->> 'reason',
      matching_actor
    ) returning id into history_id_value;

    insert into public.current_festival_entry_matches (
      entry_id,
      match_history_id
    ) values (entry_id_value, history_id_value);
  end loop;

  insert into public.current_festival_sets (edition_id, kind, set_id)
  values (edition_id_value, kind_value, set_id_value)
  on conflict (edition_id, kind) do update set
    set_id = excluded.set_id,
    updated_at = now();

  return jsonb_build_object(
    'status', 'inserted',
    'setId', set_id_value,
    'version', version_value,
    'entriesInserted', jsonb_array_length(payload -> 'entries')
  );
end;
$$;

revoke all on function public.persist_festival_set(jsonb, text) from public;
grant execute on function public.persist_festival_set(jsonb, text) to service_role;

create function public.match_festival_entry(
  target_entry_id bigint,
  target_film_id text,
  correction_reason text,
  correction_actor text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_title_value text;
  history_id_value bigint;
begin
  if nullif(trim(target_film_id), '') is null then
    raise exception 'target_film_id es obligatorio' using errcode = '22023';
  end if;
  if nullif(trim(correction_reason), '') is null then
    raise exception 'correction_reason es obligatorio' using errcode = '22023';
  end if;
  if nullif(trim(correction_actor), '') is null then
    raise exception 'correction_actor es obligatorio' using errcode = '22023';
  end if;

  perform 1 from public.films where id = target_film_id;
  if not found then
    raise exception 'Película festivalera desconocida: %', target_film_id
      using errcode = '23503';
  end if;

  select history.normalized_title into normalized_title_value
  from public.current_festival_entry_matches as current_match
  join public.festival_entry_match_history as history
    on history.id = current_match.match_history_id
  where current_match.entry_id = target_entry_id
  for update of current_match;

  if normalized_title_value is null then
    raise exception 'Entrada festivalera desconocida: %', target_entry_id
      using errcode = '23503';
  end if;

  insert into public.festival_entry_match_history (
    entry_id,
    normalized_title,
    status,
    film_id,
    candidate_film_ids,
    reason,
    actor
  ) values (
    target_entry_id,
    normalized_title_value,
    'matched',
    target_film_id,
    array[target_film_id],
    trim(correction_reason),
    trim(correction_actor)
  ) returning id into history_id_value;

  update public.current_festival_entry_matches
  set match_history_id = history_id_value, updated_at = now()
  where entry_id = target_entry_id;

  return history_id_value;
end;
$$;

revoke all on function public.match_festival_entry(bigint, text, text, text)
from public;
grant execute on function public.match_festival_entry(bigint, text, text, text)
to service_role;

comment on table public.festival_sets is
  'Versiones bloqueadas e inmutables de selección o palmarés oficial.';
comment on table public.festival_entries is
  'Títulos y destinatarios originales; el matching nunca reemplaza esos valores.';
comment on table public.current_festival_sets is
  'Puntero publicable a la versión vigente sin mutar conjuntos anteriores.';
comment on function public.match_festival_entry(bigint, text, text, text) is
  'Añade una corrección editorial de matching y mueve solo el puntero vigente.';
