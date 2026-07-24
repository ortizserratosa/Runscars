create type public.season_status as enum (
  'preparation',
  'active',
  'nominations_announced',
  'closed'
);

create type public.category_subject as enum ('film', 'person');

create type public.film_release_status as enum (
  'announced',
  'upcoming',
  'released'
);

create type public.source_editorial_status as enum (
  'candidate',
  'sampled',
  'selected',
  'paused',
  'rejected'
);

create type public.source_technical_status as enum (
  'manual',
  'prototype',
  'automated',
  'failing',
  'retired'
);

create type public.source_publication_status as enum (
  'not-reviewed',
  'review-before-publish',
  'publishable',
  'replace-before-publish'
);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.seasons (
  id text primary key,
  ceremony_year smallint not null unique,
  eligibility_year smallint,
  eligibility_period text,
  opens_on date,
  closes_on date,
  nominations_announced_on date,
  ceremony_on date,
  status public.season_status not null default 'preparation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint seasons_year_range check (
    ceremony_year between 1929 and 2200
    and (
      eligibility_year is null
      or eligibility_year between 1927 and 2200
    )
  ),
  constraint seasons_eligibility_label check (
    eligibility_year is not null
    or nullif(trim(eligibility_period), '') is not null
  ),
  constraint seasons_date_order check (
    (opens_on is null or closes_on is null or opens_on <= closes_on)
    and (
      nominations_announced_on is null
      or ceremony_on is null
      or nominations_announced_on <= ceremony_on
    )
  )
);

create table public.categories (
  id text primary key,
  name text not null unique,
  subject public.category_subject not null,
  display_order smallint not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint categories_display_order_positive check (display_order > 0)
);

create table public.season_categories (
  season_id text not null references public.seasons (id) on delete cascade,
  category_id text not null references public.categories (id) on delete restrict,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (season_id, category_id)
);

create table public.films (
  id text primary key,
  title text not null,
  alternate_titles text[] not null default '{}',
  eligibility_year smallint,
  release_status public.film_release_status not null default 'announced',
  release_date date,
  verification_url text,
  notes text,
  tmdb_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint films_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint films_title_present check (nullif(trim(title), '') is not null),
  constraint films_eligibility_year_range check (
    eligibility_year is null or eligibility_year between 1927 and 2200
  ),
  constraint films_tmdb_id_positive check (tmdb_id is null or tmdb_id > 0)
);

create table public.season_films (
  season_id text not null references public.seasons (id) on delete cascade,
  film_id text not null references public.films (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (season_id, film_id)
);

create table public.sources (
  id text primary key,
  name text not null unique,
  source_types text[] not null,
  homepage_url text not null,
  editorial_status public.source_editorial_status not null,
  technical_status public.source_technical_status not null,
  publication_status public.source_publication_status not null,
  last_reviewed_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sources_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint sources_types_present check (cardinality(source_types) > 0),
  constraint sources_types_valid check (
    source_types <@ array[
      'metadata',
      'official',
      'score',
      'prediction',
      'review',
      'festival'
    ]::text[]
  )
);

create index season_films_film_id_idx on public.season_films (film_id);
create index season_categories_category_id_idx
  on public.season_categories (category_id);
create index sources_editorial_status_idx
  on public.sources (editorial_status);

create trigger seasons_set_updated_at
before update on public.seasons
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger films_set_updated_at
before update on public.films
for each row execute function public.set_updated_at();

create trigger sources_set_updated_at
before update on public.sources
for each row execute function public.set_updated_at();

alter table public.seasons enable row level security;
alter table public.categories enable row level security;
alter table public.season_categories enable row level security;
alter table public.films enable row level security;
alter table public.season_films enable row level security;
alter table public.sources enable row level security;

grant usage on schema public to anon, authenticated;
grant select on table
  public.seasons,
  public.categories,
  public.season_categories,
  public.films,
  public.season_films,
  public.sources
to anon, authenticated;

create policy seasons_public_read
on public.seasons for select
to anon, authenticated
using (true);

create policy categories_public_read
on public.categories for select
to anon, authenticated
using (true);

create policy season_categories_public_read
on public.season_categories for select
to anon, authenticated
using (true);

create policy films_public_read
on public.films for select
to anon, authenticated
using (true);

create policy season_films_public_read
on public.season_films for select
to anon, authenticated
using (true);

create policy sources_public_read
on public.sources for select
to anon, authenticated
using (true);

comment on table public.seasons is
  'Temporadas Oscar con año de ceremonia y elegibilidad separados.';
comment on table public.categories is
  'Categorías configurables del producto; no son columnas fijas.';
comment on table public.films is
  'Identidades cinematográficas mínimas previas al catálogo TMDB de fase 4.';
comment on table public.sources is
  'Catálogo editorial; selección no implica activación ni participación.';
