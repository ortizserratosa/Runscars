drop function if exists public.save_my_ranking(text, text, text[], text[], boolean);
drop function if exists public.save_my_ranking(text, text, text[], boolean);

alter table public.user_ranking_entries
add column custom_kind text,
add column tmdb_movie_id bigint,
add column tmdb_person_id bigint,
add column qualifying_movie_tmdb_id bigint,
add column tmdb_url text,
add column qualifying_movie_tmdb_url text,
add column us_theatrical_release_date date,
add column tmdb_release_data jsonb,
add column tmdb_verified_at timestamptz,
add constraint user_ranking_entries_tmdb_ids_positive check (
  (tmdb_movie_id is null or tmdb_movie_id > 0)
  and (tmdb_person_id is null or tmdb_person_id > 0)
  and (qualifying_movie_tmdb_id is null or qualifying_movie_tmdb_id > 0)
),
add constraint user_ranking_entries_manual_tmdb_check check (
  (
    custom_label is null
    and custom_kind is null
    and tmdb_movie_id is null
    and tmdb_person_id is null
    and qualifying_movie_tmdb_id is null
    and tmdb_url is null
    and qualifying_movie_tmdb_url is null
    and us_theatrical_release_date is null
    and tmdb_release_data is null
    and tmdb_verified_at is null
  )
  or (
    custom_label is not null
    and custom_kind in ('movie', 'person')
    and us_theatrical_release_date is not null
    and tmdb_release_data is not null
    and jsonb_typeof(tmdb_release_data) = 'object'
    and tmdb_verified_at is not null
    and (
      (
        custom_kind = 'movie'
        and tmdb_movie_id is not null
        and tmdb_person_id is null
        and qualifying_movie_tmdb_id is null
        and tmdb_url ~ '^https://www\.themoviedb\.org/movie/[1-9][0-9]*$'
        and qualifying_movie_tmdb_url is null
      )
      or (
        custom_kind = 'person'
        and tmdb_movie_id is null
        and tmdb_person_id is not null
        and qualifying_movie_tmdb_id is not null
        and tmdb_url ~ '^https://www\.themoviedb\.org/person/[1-9][0-9]*$'
        and qualifying_movie_tmdb_url ~ '^https://www\.themoviedb\.org/movie/[1-9][0-9]*$'
      )
    )
  )
);

create or replace function public.validate_user_ranking_entry_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  entry_limit smallint;
  eligibility_year smallint;
begin
  if new.custom_label is not null then
    new.custom_label := trim(new.custom_label);
  end if;

  select
    season_category.nominee_slots + 1,
    season.eligibility_year
  into entry_limit, eligibility_year
  from public.season_categories as season_category
  join public.seasons as season on season.id = season_category.season_id
  where season_category.season_id = new.season_id
    and season_category.category_id = new.category_id
    and season_category.is_enabled;

  if entry_limit is null then
    raise exception 'ranking category is not enabled'
      using errcode = '23503';
  end if;

  if new.position < 1 or new.position > entry_limit then
    raise exception 'ranking position exceeds the category limit'
      using errcode = '22023';
  end if;

  if new.custom_label is not null
    and eligibility_year is not null
    and extract(year from new.us_theatrical_release_date) <> eligibility_year then
    raise exception 'manual entry release is outside the season eligibility year'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists user_ranking_entries_validate_limit
on public.user_ranking_entries;

create trigger user_ranking_entries_validate_limit
before insert or update of
  ranking_id,
  season_id,
  category_id,
  position,
  custom_label,
  custom_kind,
  tmdb_movie_id,
  tmdb_person_id,
  qualifying_movie_tmdb_id,
  tmdb_url,
  qualifying_movie_tmdb_url,
  us_theatrical_release_date,
  tmdb_release_data,
  tmdb_verified_at
on public.user_ranking_entries
for each row execute function public.validate_user_ranking_entry_limit();

create function public.save_my_ranking(
  ranking_season_id text,
  ranking_category_id text,
  ranking_candidate_ids text[],
  ranking_custom_labels text[],
  ranking_custom_metadata jsonb[],
  ranking_is_public boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ranking_user_id uuid := auth.uid();
  saved_ranking_id uuid;
  candidate_count integer;
  custom_count integer;
  entry_limit smallint;
  tracked_count integer;
begin
  if ranking_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  candidate_count := cardinality(ranking_candidate_ids);
  if (
    candidate_count is null
    or cardinality(ranking_custom_labels) is distinct from candidate_count
    or cardinality(ranking_custom_metadata) is distinct from candidate_count
  ) then
    raise exception 'ranking entry arrays must have the same length'
      using errcode = '22023';
  end if;

  select season_category.nominee_slots + 1
  into entry_limit
  from public.season_categories as season_category
  where season_category.season_id = ranking_season_id
    and season_category.category_id = ranking_category_id
    and season_category.is_enabled;

  if entry_limit is null then
    raise exception 'ranking category is not enabled'
      using errcode = '23503';
  end if;

  if candidate_count < 1 or candidate_count > entry_limit then
    raise exception 'ranking exceeds the category limit'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(
      ranking_candidate_ids,
      ranking_custom_labels,
      ranking_custom_metadata
    ) as entry(candidate_id, custom_label, metadata)
    where (
      nullif(trim(entry.candidate_id), '') is null
    ) = (
      nullif(trim(entry.custom_label), '') is null
    )
  ) then
    raise exception 'ranking entry must be tracked or custom, but not both'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(
      ranking_candidate_ids,
      ranking_custom_labels,
      ranking_custom_metadata
    ) as entry(candidate_id, custom_label, metadata)
    where nullif(trim(entry.candidate_id), '') is not null
      and coalesce(entry.metadata, '{}'::jsonb) <> '{}'::jsonb
  ) then
    raise exception 'tracked ranking entries cannot contain manual metadata'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(
      ranking_candidate_ids,
      ranking_custom_labels,
      ranking_custom_metadata
    ) as entry(candidate_id, custom_label, metadata)
    where nullif(trim(entry.custom_label), '') is not null
      and (
        jsonb_typeof(entry.metadata) <> 'object'
        or nullif(trim(entry.metadata ->> 'label'), '') is null
        or trim(entry.metadata ->> 'label') <> trim(entry.custom_label)
        or nullif(trim(entry.metadata ->> 'tmdbKind'), '') not in ('movie', 'person')
        or nullif(trim(entry.metadata ->> 'tmdbUrl'), '') is null
        or nullif(trim(entry.metadata ->> 'usTheatricalReleaseDate'), '') is null
        or nullif(trim(entry.metadata ->> 'tmdbVerifiedAt'), '') is null
        or entry.metadata -> 'tmdbReleaseData' is null
      )
  ) then
    raise exception 'manual ranking entries need verified TMDB metadata'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(ranking_custom_labels) as custom_label
    where nullif(trim(custom_label), '') is not null
      and char_length(trim(custom_label)) not between 2 and 120
  ) then
    raise exception 'custom ranking labels must contain between 2 and 120 characters'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into custom_count
  from unnest(ranking_custom_labels) as custom_label
  where nullif(trim(custom_label), '') is not null;

  if custom_count > 1 then
    raise exception 'ranking can contain only one custom entry'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into tracked_count
  from unnest(ranking_candidate_ids) as candidate_id
  where nullif(trim(candidate_id), '') is not null;

  if (
    select count(distinct trim(candidate_id)) <> tracked_count
    from unnest(ranking_candidate_ids) as candidate_id
    where nullif(trim(candidate_id), '') is not null
  ) then
    raise exception 'ranking candidates must be unique'
      using errcode = '22023';
  end if;

  if (
    select count(*) <> tracked_count
    from public.category_candidates
    where id in (
      select trim(candidate_id)
      from unnest(ranking_candidate_ids) as candidate_id
      where nullif(trim(candidate_id), '') is not null
    )
      and season_id = ranking_season_id
      and category_id = ranking_category_id
  ) then
    raise exception 'ranking contains a candidate from another category'
      using errcode = '23503';
  end if;

  insert into public.user_rankings (
    user_id,
    season_id,
    category_id,
    is_public
  )
  values (
    ranking_user_id,
    ranking_season_id,
    ranking_category_id,
    ranking_is_public
  )
  on conflict (user_id, season_id, category_id)
  do update set is_public = excluded.is_public
  returning id into saved_ranking_id;

  delete from public.user_ranking_entries
  where ranking_id = saved_ranking_id
    and user_id = ranking_user_id;

  insert into public.user_ranking_entries (
    ranking_id,
    user_id,
    season_id,
    category_id,
    category_candidate_id,
    custom_label,
    position,
    custom_kind,
    tmdb_movie_id,
    tmdb_person_id,
    qualifying_movie_tmdb_id,
    tmdb_url,
    qualifying_movie_tmdb_url,
    us_theatrical_release_date,
    tmdb_release_data,
    tmdb_verified_at
  )
  select
    saved_ranking_id,
    ranking_user_id,
    ranking_season_id,
    ranking_category_id,
    nullif(trim(entry.candidate_id), ''),
    nullif(trim(entry.custom_label), ''),
    entry.ordinality::smallint,
    nullif(trim(entry.metadata ->> 'tmdbKind'), ''),
    nullif(trim(entry.metadata ->> 'tmdbMovieId'), '')::bigint,
    nullif(trim(entry.metadata ->> 'tmdbPersonId'), '')::bigint,
    nullif(trim(entry.metadata ->> 'qualifyingMovieTmdbId'), '')::bigint,
    nullif(trim(entry.metadata ->> 'tmdbUrl'), ''),
    nullif(trim(entry.metadata ->> 'qualifyingMovieTmdbUrl'), ''),
    nullif(trim(entry.metadata ->> 'usTheatricalReleaseDate'), '')::date,
    entry.metadata -> 'tmdbReleaseData',
    nullif(trim(entry.metadata ->> 'tmdbVerifiedAt'), '')::timestamptz
  from unnest(
    ranking_candidate_ids,
    ranking_custom_labels,
    ranking_custom_metadata
  ) with ordinality as entry(candidate_id, custom_label, metadata, ordinality);

  return saved_ranking_id;
end;
$$;

revoke all on function public.save_my_ranking(
  text,
  text,
  text[],
  text[],
  jsonb[],
  boolean
) from public, anon;

grant execute on function public.save_my_ranking(
  text,
  text,
  text[],
  text[],
  jsonb[],
  boolean
) to authenticated;

create function public.save_my_ranking(
  ranking_season_id text,
  ranking_category_id text,
  ranking_candidate_ids text[],
  ranking_custom_labels text[],
  ranking_is_public boolean
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select public.save_my_ranking(
    ranking_season_id,
    ranking_category_id,
    ranking_candidate_ids,
    ranking_custom_labels,
    array_fill(
      '{}'::jsonb,
      array[coalesce(cardinality(ranking_candidate_ids), 0)]
    ),
    ranking_is_public
  )
$$;

revoke all on function public.save_my_ranking(
  text,
  text,
  text[],
  text[],
  boolean
) from public, anon;

grant execute on function public.save_my_ranking(
  text,
  text,
  text[],
  text[],
  boolean
) to authenticated;

create function public.save_my_ranking(
  ranking_season_id text,
  ranking_category_id text,
  ranking_candidate_ids text[],
  ranking_is_public boolean
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select public.save_my_ranking(
    ranking_season_id,
    ranking_category_id,
    ranking_candidate_ids,
    array_fill(
      ''::text,
      array[coalesce(cardinality(ranking_candidate_ids), 0)]
    ),
    array_fill(
      '{}'::jsonb,
      array[coalesce(cardinality(ranking_candidate_ids), 0)]
    ),
    ranking_is_public
  )
$$;

revoke all on function public.save_my_ranking(
  text,
  text,
  text[],
  boolean
) from public, anon;

grant execute on function public.save_my_ranking(
  text,
  text,
  text[],
  boolean
) to authenticated;

comment on column public.user_ranking_entries.custom_label is
  'Etiqueta canónica de una entrada manual verificada en TMDB.';
comment on column public.user_ranking_entries.tmdb_release_data is
  'Valor original de la fecha teatral estadounidense seleccionada de TMDB.';
comment on function public.save_my_ranking(text, text, text[], text[], jsonb[], boolean) is
  'Reemplaza atómicamente el ranking propio con entradas manuales verificadas por TMDB y estreno teatral estadounidense dentro del año de elegibilidad.';
