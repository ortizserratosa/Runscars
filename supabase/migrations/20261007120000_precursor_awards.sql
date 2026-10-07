-- Official precursor facts are context, never professional observations.
create table public.precursor_organizations (
  id text primary key,
  source_id text not null unique references public.sources (id) on delete restrict,
  name text not null,
  name_en text not null,
  kind text not null check (kind in ('guild', 'critics', 'academy')),
  homepage_url text not null check (homepage_url like 'https://%'),
  notes_es text not null,
  notes_en text not null
);

create table public.precursor_editions (
  id text primary key,
  organization_id text not null references public.precursor_organizations (id) on delete restrict,
  season_id text not null references public.seasons (id) on delete restrict,
  ceremony_year smallint not null check (ceremony_year between 2000 and 2100),
  edition_number smallint check (edition_number > 0),
  unique (organization_id, ceremony_year),
  check (id = organization_id || '-' || ceremony_year::text),
  check (season_id = 'oscars-' || ceremony_year::text)
);

create table public.precursor_sets (
  id text primary key,
  edition_id text not null references public.precursor_editions (id) on delete restrict,
  kind text not null check (kind in ('schedule', 'nominations', 'winners')),
  version integer not null check (version > 0),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  source_url text not null check (source_url like 'https://%'),
  source_title text not null check (nullif(trim(source_title), '') is not null),
  source_author text,
  published_at timestamptz,
  captured_at timestamptz not null,
  ceremony_on date,
  nominations_on date,
  milestones jsonb not null default '[]'::jsonb check (jsonb_typeof(milestones) = 'array'),
  coverage_es text not null,
  coverage_en text not null,
  raw_capture jsonb not null,
  extractor_version text not null,
  corrects_set_id text references public.precursor_sets (id) on delete restrict,
  correction_reason text,
  created_at timestamptz not null default now(),
  unique (edition_id, kind, version),
  unique (edition_id, kind, content_hash),
  unique (id, edition_id, kind),
  check (published_at is null or published_at <= captured_at),
  check (nominations_on is null or ceremony_on is null or nominations_on <= ceremony_on),
  check ((corrects_set_id is null and correction_reason is null) or
    (corrects_set_id is not null and nullif(trim(correction_reason), '') is not null))
);

create table public.precursor_entries (
  id bigint generated always as identity primary key,
  set_id text not null references public.precursor_sets (id) on delete restrict,
  entry_order integer not null check (entry_order > 0),
  original_category text not null check (nullif(trim(original_category), '') is not null),
  original_title text not null check (nullif(trim(original_title), '') is not null),
  original_recipient text,
  category_id text references public.categories (id) on delete restrict,
  category_relation text not null check (category_relation in ('corresponding', 'related', 'none')),
  original_data jsonb not null,
  unique (set_id, entry_order),
  check ((category_relation = 'none') = (category_id is null))
);

create table public.current_precursor_sets (
  edition_id text not null references public.precursor_editions (id) on delete restrict,
  kind text not null,
  set_id text not null,
  updated_at timestamptz not null default now(),
  primary key (edition_id, kind),
  foreign key (set_id, edition_id, kind) references public.precursor_sets (id, edition_id, kind) on delete restrict
);

create table public.precursor_entry_match_history (
  id bigint generated always as identity primary key,
  entry_id bigint not null references public.precursor_entries (id) on delete restrict,
  normalized_title text not null,
  status text not null check (status in ('matched', 'pending_review', 'unmatched')),
  film_id text references public.films (id) on delete restrict,
  candidate_film_ids text[] not null default '{}',
  reason text not null check (nullif(trim(reason), '') is not null),
  actor text not null check (nullif(trim(actor), '') is not null),
  created_at timestamptz not null default now(),
  unique (id, entry_id),
  check ((status = 'matched') = (film_id is not null))
);

create table public.current_precursor_entry_matches (
  entry_id bigint primary key references public.precursor_entries (id) on delete restrict,
  match_history_id bigint not null,
  updated_at timestamptz not null default now(),
  foreign key (match_history_id, entry_id) references public.precursor_entry_match_history (id, entry_id) on delete restrict
);

create index precursor_editions_season_idx on public.precursor_editions (season_id);
create index precursor_entries_category_idx on public.precursor_entries (category_id);
create index precursor_matches_film_idx on public.precursor_entry_match_history (film_id) where film_id is not null;

create trigger precursor_sets_immutable before update or delete on public.precursor_sets
for each row execute function public.prevent_locked_record_mutation();
create trigger precursor_entries_immutable before update or delete on public.precursor_entries
for each row execute function public.prevent_locked_record_mutation();
create trigger precursor_matches_immutable before update or delete on public.precursor_entry_match_history
for each row execute function public.prevent_locked_record_mutation();

alter table public.precursor_organizations enable row level security;
alter table public.precursor_editions enable row level security;
alter table public.precursor_sets enable row level security;
alter table public.precursor_entries enable row level security;
alter table public.current_precursor_sets enable row level security;
alter table public.precursor_entry_match_history enable row level security;
alter table public.current_precursor_entry_matches enable row level security;

grant select on public.precursor_organizations, public.precursor_editions,
  public.precursor_sets, public.precursor_entries, public.current_precursor_sets,
  public.current_precursor_entry_matches to anon, authenticated;
grant select (id, entry_id, status, film_id) on public.precursor_entry_match_history to anon, authenticated;
grant select on public.precursor_organizations, public.precursor_editions,
  public.precursor_sets, public.precursor_entries, public.current_precursor_sets,
  public.precursor_entry_match_history, public.current_precursor_entry_matches to service_role;
grant usage, select on sequence public.precursor_entries_id_seq,
  public.precursor_entry_match_history_id_seq to service_role;

create policy precursor_organizations_read on public.precursor_organizations for select to anon, authenticated
using (exists (select 1 from public.sources where sources.id = source_id and sources.publication_status = 'publishable'));
create policy precursor_editions_read on public.precursor_editions for select to anon, authenticated
using (exists (select 1 from public.precursor_organizations where precursor_organizations.id = organization_id));
create policy precursor_sets_read on public.precursor_sets for select to anon, authenticated
using (exists (select 1 from public.precursor_editions where precursor_editions.id = edition_id));
create policy precursor_entries_read on public.precursor_entries for select to anon, authenticated
using (exists (select 1 from public.precursor_sets where precursor_sets.id = set_id));
create policy current_precursor_sets_read on public.current_precursor_sets for select to anon, authenticated
using (exists (select 1 from public.precursor_editions where precursor_editions.id = edition_id));
create policy precursor_matches_read on public.precursor_entry_match_history for select to anon, authenticated
using (exists (select 1 from public.precursor_entries where precursor_entries.id = entry_id));
create policy current_precursor_matches_read on public.current_precursor_entry_matches for select to anon, authenticated
using (exists (select 1 from public.precursor_entries where precursor_entries.id = entry_id));

insert into public.sources (id, name, source_types, homepage_url, editorial_status,
  technical_status, publication_status, last_reviewed_on, notes)
values
  ('actor-awards', 'Actor Awards — SAG-AFTRA', array['official'], 'https://www.actorawards.org/', 'selected', 'manual', 'publishable', '2026-10-07', 'Calendario y resultados factuales; contexto separado del consenso'),
  ('dga', 'Directors Guild of America', array['official'], 'https://www.dga.org/', 'selected', 'manual', 'publishable', '2026-10-07', 'Calendario y resultados factuales; contexto separado del consenso'),
  ('pga', 'Producers Guild of America', array['official'], 'https://producersguild.org/', 'selected', 'manual', 'publishable', '2026-10-07', 'Calendario y resultados factuales; contexto separado del consenso'),
  ('wga', 'Writers Guild of America', array['official'], 'https://www.wga.org/', 'selected', 'manual', 'publishable', '2026-10-07', 'Calendario y resultados factuales; elegibilidad sindical propia'),
  ('critics-choice', 'Critics Choice Association', array['official'], 'https://www.criticschoice.com/', 'selected', 'manual', 'publishable', '2026-10-07', 'Calendario y resultados de premios; no reseñas ni predicciones'),
  ('bafta', 'British Academy of Film and Television Arts', array['official'], 'https://www.bafta.org/', 'selected', 'manual', 'publishable', '2026-10-07', 'Calendario y resultados factuales; elegibilidad británica propia')
on conflict (id) do nothing;

insert into public.precursor_organizations (id, source_id, name, name_en, kind,
  homepage_url, notes_es, notes_en)
values
  ('actor-awards', 'actor-awards', 'Actor Awards · SAG-AFTRA', 'Actor Awards · SAG-AFTRA', 'guild', 'https://www.actorawards.org/', 'Premia interpretaciones y reparto; el premio de elenco no equivale a Mejor película.', 'Honours performances and casts; the cast award is distinct from Best Picture.'),
  ('dga', 'dga', 'Directors Guild Awards', 'Directors Guild Awards', 'guild', 'https://www.dga.org/', 'Dirección de largometraje; las reglas de elegibilidad y el cuerpo de votantes son propios del sindicato.', 'Feature-film directing; the guild has its own eligibility rules and voting membership.'),
  ('pga', 'pga', 'Producers Guild Awards', 'Producers Guild Awards', 'guild', 'https://producersguild.org/', 'Producción de largometraje; las categorías originales y los equipos de producción se conservan.', 'Feature-film production; original categories and producing teams are preserved.'),
  ('wga', 'wga', 'Writers Guild Awards', 'Writers Guild Awards', 'guild', 'https://www.wga.org/', 'Guion original y adaptado; la elegibilidad sindical es distinta de la de los Oscar.', 'Original and adapted screenplays; guild eligibility differs from Oscar eligibility.'),
  ('critics-choice', 'critics-choice', 'Critics Choice Awards', 'Critics Choice Awards', 'critics', 'https://www.criticschoice.com/', 'Premios votados por la Critics Choice Association; no son listas de predicciones.', 'Awards voted on by the Critics Choice Association; these are not prediction lists.'),
  ('bafta', 'bafta', 'EE BAFTA Film Awards', 'EE BAFTA Film Awards', 'academy', 'https://www.bafta.org/', 'La academia británica tiene categorías y fechas de estreno elegibles propias.', 'The British academy has its own categories and qualifying release dates.');

insert into public.precursor_editions (id, organization_id, season_id, ceremony_year, edition_number)
select organization.id || '-' || year.year::text, organization.id,
  'oscars-' || year.year::text, year.year,
  case organization.id when 'actor-awards' then 33 when 'dga' then 79 when 'pga' then 38
    when 'wga' then 79 when 'critics-choice' then 32 when 'bafta' then 80 end - (2027 - year.year)
from public.precursor_organizations as organization cross join (values (2026), (2027)) as year(year);

create function public.persist_precursor_set(payload jsonb, matching_actor text default 'automatic-exact-season-title')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  edition public.precursor_editions;
  kind_value text := payload ->> 'kind';
  hash_value text := payload ->> 'contentHash';
  set_id_value text;
  version_value integer;
  entry_value jsonb;
  entry_id_value bigint;
  history_id_value bigint;
  source_host text;
begin
  if nullif(trim(matching_actor), '') is null then raise exception 'matching_actor es obligatorio'; end if;
  select * into edition from public.precursor_editions where id = payload ->> 'editionId' for update;
  if not found then raise exception 'Edición precursora desconocida'; end if;
  if edition.organization_id <> payload ->> 'organizationId'
    or edition.season_id <> payload ->> 'seasonId'
    or edition.ceremony_year <> (payload ->> 'ceremonyYear')::integer then
    raise exception 'Edición, ceremonia y temporada no coinciden';
  end if;
  if kind_value not in ('schedule', 'nominations', 'winners') then raise exception 'Tipo de conjunto inválido'; end if;
  if jsonb_typeof(payload -> 'entries') is distinct from 'array' then raise exception 'entries debe ser una lista'; end if;
  if (kind_value = 'schedule') <> (jsonb_array_length(payload -> 'entries') = 0) then
    raise exception 'Un calendario no tiene resultados y un resultado no puede estar vacío';
  end if;
  if kind_value = 'winners' and nullif(payload #>> '{schedule,ceremonyOn}', '') is null then
    raise exception 'Los ganadores requieren una fecha oficial de ceremonia';
  end if;
  if kind_value = 'nominations' and nullif(payload #>> '{schedule,nominationsOn}', '') is null
    and nullif(payload #>> '{source,publishedAt}', '') is null then
    raise exception 'Las nominaciones requieren una fecha oficial de anuncio o publicación';
  end if;
  if nullif(payload #>> '{schedule,ceremonyOn}', '') is not null and
    extract(year from (payload #>> '{schedule,ceremonyOn}')::date) <> edition.ceremony_year then
    raise exception 'La ceremonia pertenece a otra edición';
  end if;
  if kind_value = 'winners' and (payload #>> '{schedule,ceremonyOn}')::date > ((payload ->> 'capturedAt')::timestamptz at time zone 'UTC')::date then
    raise exception 'No se pueden registrar ganadores antes de su ceremonia';
  end if;
  if kind_value = 'nominations' and (payload #>> '{schedule,nominationsOn}')::date > ((payload ->> 'capturedAt')::timestamptz at time zone 'UTC')::date then
    raise exception 'No se pueden registrar nominaciones antes de su anuncio';
  end if;
  source_host := lower(split_part(split_part(payload #>> '{source,url}', '://', 2), '/', 1));
  if payload #>> '{source,url}' not like 'https://%' or not (
    (edition.organization_id = 'actor-awards' and source_host in ('actorawards.org', 'www.actorawards.org', 'sagaftra.org', 'www.sagaftra.org')) or
    (edition.organization_id = 'dga' and source_host in ('dga.org', 'www.dga.org')) or
    (edition.organization_id = 'pga' and source_host in ('producersguild.org', 'www.producersguild.org')) or
    (edition.organization_id = 'wga' and source_host in ('wga.org', 'www.wga.org', 'awards.wga.org', 'wgaeast.org', 'www.wgaeast.org')) or
    (edition.organization_id = 'critics-choice' and source_host in ('criticschoice.com', 'www.criticschoice.com')) or
    (edition.organization_id = 'bafta' and source_host in ('bafta.org', 'www.bafta.org', 'awards.bafta.org'))
  ) then raise exception 'El recibo debe proceder de la fuente oficial'; end if;
  if nullif(payload ->> 'correctsSetId', '') is not null and not exists (
    select 1 from public.precursor_sets where id = payload ->> 'correctsSetId' and edition_id = edition.id and kind = kind_value
  ) then raise exception 'La corrección debe enlazar un conjunto del mismo alcance'; end if;

  select id, version into set_id_value, version_value from public.precursor_sets
  where edition_id = edition.id and kind = kind_value and content_hash = hash_value;
  if set_id_value is not null then
    return jsonb_build_object('status', 'duplicate', 'setId', set_id_value, 'version', version_value, 'entriesInserted', 0);
  end if;
  select coalesce(max(version), 0) + 1 into version_value from public.precursor_sets where edition_id = edition.id and kind = kind_value;
  set_id_value := edition.id || '-' || kind_value || '-' || left(hash_value, 12);
  insert into public.precursor_sets (id, edition_id, kind, version, content_hash,
    source_url, source_title, source_author, published_at, captured_at, ceremony_on,
    nominations_on, milestones, coverage_es, coverage_en, raw_capture, extractor_version,
    corrects_set_id, correction_reason)
  values (set_id_value, edition.id, kind_value, version_value, hash_value,
    payload #>> '{source,url}', payload #>> '{source,title}', payload #>> '{source,author}',
    nullif(payload #>> '{source,publishedAt}', '')::timestamptz, (payload ->> 'capturedAt')::timestamptz,
    nullif(payload #>> '{schedule,ceremonyOn}', '')::date, nullif(payload #>> '{schedule,nominationsOn}', '')::date,
    coalesce(payload #> '{schedule,milestones}', '[]'::jsonb), payload #>> '{coverage,es}',
    payload #>> '{coverage,en}', payload -> 'rawCapture', payload ->> 'extractorVersion',
    nullif(payload ->> 'correctsSetId', ''), nullif(payload ->> 'correctionReason', ''));

  for entry_value in select value from jsonb_array_elements(payload -> 'entries') order by (value ->> 'entryOrder')::integer loop
    if nullif(entry_value ->> 'filmId', '') is not null and not exists (
      select 1 from public.season_films where season_id = edition.season_id and film_id = entry_value ->> 'filmId'
    ) then raise exception 'La película emparejada no pertenece a la temporada'; end if;
    insert into public.precursor_entries (set_id, entry_order, original_category,
      original_title, original_recipient, category_id, category_relation, original_data)
    values (set_id_value, (entry_value ->> 'entryOrder')::integer, entry_value ->> 'originalCategory',
      entry_value ->> 'originalTitle', entry_value ->> 'originalRecipient',
      entry_value ->> 'categoryId', entry_value ->> 'categoryRelation', entry_value -> 'originalData') returning id into entry_id_value;
    insert into public.precursor_entry_match_history (entry_id, normalized_title, status,
      film_id, candidate_film_ids, reason, actor)
    values (entry_id_value, entry_value ->> 'normalizedTitle', entry_value ->> 'status',
      nullif(entry_value ->> 'filmId', ''),
      coalesce(array(select jsonb_array_elements_text(entry_value -> 'candidateFilmIds')), '{}'),
      entry_value ->> 'reason', matching_actor) returning id into history_id_value;
    insert into public.current_precursor_entry_matches (entry_id, match_history_id) values (entry_id_value, history_id_value);
  end loop;
  insert into public.current_precursor_sets (edition_id, kind, set_id) values (edition.id, kind_value, set_id_value)
  on conflict (edition_id, kind) do update set set_id = excluded.set_id, updated_at = now();
  return jsonb_build_object('status', 'inserted', 'setId', set_id_value, 'version', version_value, 'entriesInserted', jsonb_array_length(payload -> 'entries'));
end;
$$;
revoke all on function public.persist_precursor_set(jsonb, text) from public;
grant execute on function public.persist_precursor_set(jsonb, text) to service_role;

create function public.match_precursor_entry(target_entry_id bigint, target_film_id text, correction_reason text, correction_actor text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  season_id_value text;
  normalized_title_value text;
  history_id_value bigint;
begin
  if nullif(trim(correction_reason), '') is null or nullif(trim(correction_actor), '') is null then raise exception 'Motivo y actor son obligatorios'; end if;
  select edition.season_id, history.normalized_title into season_id_value, normalized_title_value
  from public.current_precursor_entry_matches as pointer
  join public.precursor_entry_match_history as history on history.id = pointer.match_history_id
  join public.precursor_entries as entry on entry.id = pointer.entry_id
  join public.precursor_sets as receipt on receipt.id = entry.set_id
  join public.precursor_editions as edition on edition.id = receipt.edition_id
  where pointer.entry_id = target_entry_id for update of pointer;
  if not found then raise exception 'Entrada precursora desconocida'; end if;
  if not exists (select 1 from public.season_films where season_id = season_id_value and film_id = target_film_id) then
    raise exception 'La película debe pertenecer a la misma temporada';
  end if;
  insert into public.precursor_entry_match_history (entry_id, normalized_title, status, film_id, candidate_film_ids, reason, actor)
  values (target_entry_id, normalized_title_value, 'matched', target_film_id, array[target_film_id], trim(correction_reason), trim(correction_actor))
  returning id into history_id_value;
  update public.current_precursor_entry_matches set match_history_id = history_id_value, updated_at = now() where entry_id = target_entry_id;
  return history_id_value;
end;
$$;
revoke all on function public.match_precursor_entry(bigint, text, text, text) from public;
grant execute on function public.match_precursor_entry(bigint, text, text, text) to service_role;

comment on table public.precursor_sets is 'Calendarios y resultados oficiales inmutables; nunca aportan puntos ni cobertura al consenso.';
comment on table public.precursor_entries is 'Categoría, título y destinatario originales; relación contextual con categorías Oscar, sin declarar elegibilidad equivalente.';
