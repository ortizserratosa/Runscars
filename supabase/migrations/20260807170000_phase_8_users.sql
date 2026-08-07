create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  is_public boolean not null default false,
  watched_is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_slug_format check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(slug) between 3 and 48
  ),
  constraint user_profiles_display_name_present check (
    char_length(trim(display_name)) between 2 and 60
  ),
  constraint user_profiles_watched_visibility check (
    not watched_is_public or is_public
  )
);

create table public.user_rankings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (user_id)
    on delete cascade,
  season_id text not null,
  category_id text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_rankings_season_category_fkey
    foreign key (season_id, category_id)
    references public.season_categories (season_id, category_id)
    on delete cascade,
  constraint user_rankings_one_active_per_category
    unique (user_id, season_id, category_id),
  constraint user_rankings_entry_scope
    unique (id, user_id, season_id, category_id)
);

alter table public.category_candidates
add constraint category_candidates_entry_scope
unique (id, season_id, category_id);

create table public.user_ranking_entries (
  ranking_id uuid not null,
  user_id uuid not null,
  season_id text not null,
  category_id text not null,
  category_candidate_id text not null,
  position smallint not null,
  created_at timestamptz not null default now(),
  primary key (ranking_id, category_candidate_id),
  constraint user_ranking_entries_position_range check (
    position between 1 and 50
  ),
  constraint user_ranking_entries_position_unique
    unique (ranking_id, position),
  constraint user_ranking_entries_ranking_scope_fkey
    foreign key (ranking_id, user_id, season_id, category_id)
    references public.user_rankings (id, user_id, season_id, category_id)
    on delete cascade,
  constraint user_ranking_entries_candidate_scope_fkey
    foreign key (category_candidate_id, season_id, category_id)
    references public.category_candidates (id, season_id, category_id)
    on delete cascade
);

create table public.user_film_states (
  user_id uuid not null references public.user_profiles (user_id)
    on delete cascade,
  film_id text not null references public.films (id) on delete cascade,
  watched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, film_id)
);

create index user_rankings_user_id_idx
on public.user_rankings (user_id);

create index user_rankings_public_category_idx
on public.user_rankings (season_id, category_id, updated_at desc)
where is_public;

create index user_ranking_entries_user_id_idx
on public.user_ranking_entries (user_id);

create index user_film_states_user_id_idx
on public.user_film_states (user_id);

create function public.handle_new_runscars_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');

  insert into public.user_profiles (
    user_id,
    slug,
    display_name
  )
  values (
    new.id,
    'usuario-' || replace(new.id::text, '-', ''),
    coalesce(left(requested_name, 60), 'Usuario Runscars')
  );

  return new;
end;
$$;

revoke all on function public.handle_new_runscars_user() from public;
revoke all on function public.handle_new_runscars_user() from anon, authenticated;

create trigger on_auth_user_created_create_runscars_profile
after insert on auth.users
for each row execute function public.handle_new_runscars_user();

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger user_rankings_set_updated_at
before update on public.user_rankings
for each row execute function public.set_updated_at();

create trigger user_film_states_set_updated_at
before update on public.user_film_states
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.user_rankings enable row level security;
alter table public.user_ranking_entries enable row level security;
alter table public.user_film_states enable row level security;

grant select on table
  public.user_profiles,
  public.user_rankings,
  public.user_ranking_entries,
  public.user_film_states
to anon;

grant select, update on table
  public.user_profiles
to authenticated;

grant select, insert, update, delete on table
  public.user_rankings,
  public.user_ranking_entries,
  public.user_film_states
to authenticated;

create policy user_profiles_read
on public.user_profiles for select
to anon, authenticated
using (
  is_public
  or (select auth.uid()) = user_id
);

create policy user_profiles_update_own
on public.user_profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_rankings_read
on public.user_rankings for select
to anon, authenticated
using (
  (select auth.uid()) = user_id
  or (
    is_public
    and exists (
      select 1
      from public.user_profiles as profile
      where profile.user_id = user_rankings.user_id
        and profile.is_public
    )
  )
);

create policy user_rankings_insert_own
on public.user_rankings for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy user_rankings_update_own
on public.user_rankings for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_rankings_delete_own
on public.user_rankings for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy user_ranking_entries_read
on public.user_ranking_entries for select
to anon, authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.user_rankings as ranking
    join public.user_profiles as profile
      on profile.user_id = ranking.user_id
    where ranking.id = user_ranking_entries.ranking_id
      and ranking.is_public
      and profile.is_public
  )
);

create policy user_ranking_entries_insert_own
on public.user_ranking_entries for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy user_ranking_entries_update_own
on public.user_ranking_entries for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_ranking_entries_delete_own
on public.user_ranking_entries for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy user_film_states_read
on public.user_film_states for select
to anon, authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.user_profiles as profile
    where profile.user_id = user_film_states.user_id
      and profile.is_public
      and profile.watched_is_public
  )
);

create policy user_film_states_insert_own
on public.user_film_states for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy user_film_states_update_own
on public.user_film_states for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_film_states_delete_own
on public.user_film_states for delete
to authenticated
using ((select auth.uid()) = user_id);

create function public.save_my_ranking(
  ranking_season_id text,
  ranking_category_id text,
  ranking_candidate_ids text[],
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
begin
  if ranking_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  candidate_count := cardinality(ranking_candidate_ids);
  if candidate_count is null or candidate_count < 1 or candidate_count > 50 then
    raise exception 'ranking must contain between 1 and 50 candidates'
      using errcode = '22023';
  end if;

  if (
    select count(distinct candidate_id) <> candidate_count
    from unnest(ranking_candidate_ids) as candidate_id
  ) then
    raise exception 'ranking candidates must be unique'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.season_categories
    where season_id = ranking_season_id
      and category_id = ranking_category_id
      and is_enabled
  ) then
    raise exception 'ranking category is not enabled'
      using errcode = '23503';
  end if;

  if (
    select count(*) <> candidate_count
    from public.category_candidates
    where id = any(ranking_candidate_ids)
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
    position
  )
  select
    saved_ranking_id,
    ranking_user_id,
    ranking_season_id,
    ranking_category_id,
    candidate_id,
    ordinality::smallint
  from unnest(ranking_candidate_ids)
    with ordinality as candidates(candidate_id, ordinality);

  return saved_ranking_id;
end;
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

comment on table public.user_profiles is
  'Perfil mínimo separado de auth.users; privado por defecto y sin correo duplicado.';
comment on table public.user_rankings is
  'Una versión activa de ranking de usuario por temporada y categoría.';
comment on table public.user_ranking_entries is
  'Posiciones explícitas de rankings parciales; nunca infiere candidaturas ausentes.';
comment on table public.user_film_states is
  'Películas marcadas como vistas por el usuario; la ausencia significa no indicado.';
comment on function public.save_my_ranking(text, text, text[], boolean) is
  'Reemplaza atómicamente el ranking propio validando temporada, categoría y candidatura.';
