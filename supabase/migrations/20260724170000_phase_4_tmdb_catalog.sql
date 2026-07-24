create type public.tmdb_match_method as enum (
  'search_exact',
  'manual',
  'correction'
);

create type public.film_credit_kind as enum ('cast', 'crew');

create table public.tmdb_movies (
  tmdb_id bigint primary key,
  last_checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tmdb_movies_id_positive check (tmdb_id > 0)
);

create table public.tmdb_movie_snapshots (
  id bigint generated always as identity primary key,
  tmdb_id bigint not null references public.tmdb_movies (tmdb_id)
    on delete cascade,
  locale text not null,
  content_hash text not null,
  title text not null,
  original_title text not null,
  original_language text,
  overview text,
  release_date date,
  runtime smallint,
  status text,
  tagline text,
  imdb_id text,
  poster_path text,
  backdrop_path text,
  genres jsonb not null default '[]'::jsonb,
  original_data jsonb not null,
  source_url text not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint tmdb_movie_snapshots_locale_present check (
    nullif(trim(locale), '') is not null
  ),
  constraint tmdb_movie_snapshots_hash_format check (
    content_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint tmdb_movie_snapshots_title_present check (
    nullif(trim(title), '') is not null
    and nullif(trim(original_title), '') is not null
  ),
  constraint tmdb_movie_snapshots_runtime_valid check (
    runtime is null or runtime between 0 and 2000
  ),
  constraint tmdb_movie_snapshots_paths_valid check (
    (poster_path is null or poster_path ~ '^/[A-Za-z0-9._-]+$')
    and (
      backdrop_path is null
      or backdrop_path ~ '^/[A-Za-z0-9._-]+$'
    )
  ),
  constraint tmdb_movie_snapshots_genres_array check (
    jsonb_typeof(genres) = 'array'
  ),
  constraint tmdb_movie_snapshots_original_object check (
    jsonb_typeof(original_data) = 'object'
  ),
  constraint tmdb_movie_snapshots_cache_window check (
    expires_at > fetched_at
    and expires_at <= fetched_at + interval '6 months'
  ),
  unique (tmdb_id, locale, content_hash)
);

create table public.tmdb_people (
  tmdb_id bigint primary key,
  last_checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tmdb_people_id_positive check (tmdb_id > 0)
);

create table public.people (
  id text primary key,
  name text not null,
  tmdb_id bigint not null unique references public.tmdb_people (tmdb_id)
    on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint people_name_present check (nullif(trim(name), '') is not null)
);

create table public.tmdb_person_snapshots (
  id bigint generated always as identity primary key,
  tmdb_id bigint not null references public.tmdb_people (tmdb_id)
    on delete cascade,
  locale text not null,
  content_hash text not null,
  name text not null,
  original_name text,
  known_for_department text,
  biography text,
  birthday date,
  deathday date,
  place_of_birth text,
  homepage_url text,
  imdb_id text,
  profile_path text,
  original_data jsonb not null,
  source_url text not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint tmdb_person_snapshots_locale_present check (
    nullif(trim(locale), '') is not null
  ),
  constraint tmdb_person_snapshots_hash_format check (
    content_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint tmdb_person_snapshots_name_present check (
    nullif(trim(name), '') is not null
  ),
  constraint tmdb_person_snapshots_profile_path_valid check (
    profile_path is null or profile_path ~ '^/[A-Za-z0-9._-]+$'
  ),
  constraint tmdb_person_snapshots_original_object check (
    jsonb_typeof(original_data) = 'object'
  ),
  constraint tmdb_person_snapshots_date_order check (
    birthday is null or deathday is null or birthday <= deathday
  ),
  constraint tmdb_person_snapshots_cache_window check (
    expires_at > fetched_at
    and expires_at <= fetched_at + interval '6 months'
  ),
  unique (tmdb_id, locale, content_hash)
);

create table public.film_credits (
  film_id text not null references public.films (id) on delete cascade,
  person_id text not null references public.people (id) on delete restrict,
  tmdb_credit_id text not null,
  credit_kind public.film_credit_kind not null,
  role text not null,
  department text,
  billing_order smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (film_id, tmdb_credit_id),
  constraint film_credits_credit_id_present check (
    nullif(trim(tmdb_credit_id), '') is not null
  ),
  constraint film_credits_role_present check (
    nullif(trim(role), '') is not null
  ),
  constraint film_credits_order_valid check (
    billing_order is null or billing_order >= 0
  )
);

alter table public.films
add constraint films_tmdb_id_fkey
foreign key (tmdb_id)
references public.tmdb_movies (tmdb_id)
on delete restrict;

create table public.film_tmdb_match_history (
  id bigint generated always as identity primary key,
  film_id text not null references public.films (id) on delete cascade,
  previous_tmdb_id bigint references public.tmdb_movies (tmdb_id)
    on delete restrict,
  tmdb_id bigint not null references public.tmdb_movies (tmdb_id)
    on delete restrict,
  method public.tmdb_match_method not null,
  query text,
  reason text not null,
  actor text not null,
  created_at timestamptz not null default now(),
  constraint film_tmdb_match_history_changed check (
    previous_tmdb_id is distinct from tmdb_id
  ),
  constraint film_tmdb_match_history_reason_present check (
    nullif(trim(reason), '') is not null
  ),
  constraint film_tmdb_match_history_actor_present check (
    nullif(trim(actor), '') is not null
  )
);

create function public.record_film_tmdb_match(
  target_film_id text,
  target_tmdb_id bigint,
  match_method public.tmdb_match_method,
  match_query text,
  match_reason text,
  match_actor text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_tmdb_id bigint;
begin
  select tmdb_id
  into current_tmdb_id
  from public.films
  where id = target_film_id
  for update;

  if not found then
    raise exception 'Unknown Runscars film: %', target_film_id;
  end if;

  if not exists (
    select 1
    from public.tmdb_movies
    where tmdb_id = target_tmdb_id
  ) then
    raise exception 'TMDB movie % is not cached', target_tmdb_id;
  end if;

  if current_tmdb_id is not distinct from target_tmdb_id then
    return false;
  end if;

  if current_tmdb_id is not null and match_method <> 'correction' then
    raise exception
      'Film % already has TMDB match %; use correction',
      target_film_id,
      current_tmdb_id;
  end if;

  if nullif(trim(match_reason), '') is null then
    raise exception 'A matching reason is required';
  end if;

  if nullif(trim(match_actor), '') is null then
    raise exception 'A matching actor is required';
  end if;

  update public.films
  set tmdb_id = target_tmdb_id
  where id = target_film_id;

  insert into public.film_tmdb_match_history (
    film_id,
    previous_tmdb_id,
    tmdb_id,
    method,
    query,
    reason,
    actor
  )
  values (
    target_film_id,
    current_tmdb_id,
    target_tmdb_id,
    match_method,
    match_query,
    match_reason,
    match_actor
  );

  return true;
end;
$$;

create index tmdb_movie_snapshots_latest_idx
  on public.tmdb_movie_snapshots (tmdb_id, locale, fetched_at desc);
create index tmdb_person_snapshots_latest_idx
  on public.tmdb_person_snapshots (tmdb_id, locale, fetched_at desc);
create index film_credits_person_id_idx
  on public.film_credits (person_id);
create index film_tmdb_match_history_film_id_idx
  on public.film_tmdb_match_history (film_id, created_at desc);

create trigger tmdb_movies_set_updated_at
before update on public.tmdb_movies
for each row execute function public.set_updated_at();

create trigger tmdb_people_set_updated_at
before update on public.tmdb_people
for each row execute function public.set_updated_at();

create trigger people_set_updated_at
before update on public.people
for each row execute function public.set_updated_at();

create trigger film_credits_set_updated_at
before update on public.film_credits
for each row execute function public.set_updated_at();

alter table public.tmdb_movies enable row level security;
alter table public.tmdb_movie_snapshots enable row level security;
alter table public.tmdb_people enable row level security;
alter table public.people enable row level security;
alter table public.tmdb_person_snapshots enable row level security;
alter table public.film_credits enable row level security;
alter table public.film_tmdb_match_history enable row level security;

grant select on table
  public.tmdb_movies,
  public.tmdb_movie_snapshots,
  public.tmdb_people,
  public.people,
  public.tmdb_person_snapshots,
  public.film_credits
to anon, authenticated;

grant select, insert, update, delete on table
  public.tmdb_movies,
  public.tmdb_movie_snapshots,
  public.tmdb_people,
  public.people,
  public.tmdb_person_snapshots,
  public.film_credits
to service_role;

grant select, insert on table
  public.film_tmdb_match_history
to service_role;

grant usage, select on all sequences in schema public to service_role;

create policy tmdb_movies_public_read
on public.tmdb_movies for select
to anon, authenticated
using (true);

create policy tmdb_movie_snapshots_public_read
on public.tmdb_movie_snapshots for select
to anon, authenticated
using (true);

create policy tmdb_people_public_read
on public.tmdb_people for select
to anon, authenticated
using (true);

create policy people_public_read
on public.people for select
to anon, authenticated
using (true);

create policy tmdb_person_snapshots_public_read
on public.tmdb_person_snapshots for select
to anon, authenticated
using (true);

create policy film_credits_public_read
on public.film_credits for select
to anon, authenticated
using (true);

revoke all on function public.record_film_tmdb_match(
  text,
  bigint,
  public.tmdb_match_method,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.record_film_tmdb_match(
  text,
  bigint,
  public.tmdb_match_method,
  text,
  text,
  text
) to service_role;

comment on table public.tmdb_movie_snapshots is
  'Caché TMDB versionada e idempotente; conserva campos originales necesarios.';
comment on table public.tmdb_person_snapshots is
  'Caché TMDB de personas versionada con una caducidad máxima de seis meses.';
comment on table public.film_tmdb_match_history is
  'Historial append-only de emparejamientos y correcciones editoriales.';
comment on function public.record_film_tmdb_match is
  'Cambia el match activo de forma transaccional y conserva la decisión previa.';
