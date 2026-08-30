alter table public.season_categories
add column nominee_slots smallint not null default 5,
add constraint season_categories_nominee_slots_range
  check (nominee_slots between 1 and 20);

update public.season_categories
set nominee_slots = 10
where category_id = 'best-picture';

alter table public.user_ranking_entries
drop constraint user_ranking_entries_pkey;

alter table public.user_ranking_entries
alter column category_candidate_id drop not null,
add column id uuid not null default gen_random_uuid(),
add column custom_label text,
add constraint user_ranking_entries_pkey primary key (id),
add constraint user_ranking_entries_source_check check (
  (
    category_candidate_id is not null
    and custom_label is null
  )
  or (
    category_candidate_id is null
    and custom_label is not null
    and custom_label = trim(custom_label)
    and char_length(custom_label) between 2 and 120
  )
);

create unique index user_ranking_entries_tracked_unique
on public.user_ranking_entries (ranking_id, category_candidate_id)
where category_candidate_id is not null;

create unique index user_ranking_entries_one_custom
on public.user_ranking_entries (ranking_id)
where custom_label is not null;

create function public.validate_user_ranking_entry_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  entry_limit smallint;
begin
  if new.custom_label is not null then
    new.custom_label := trim(new.custom_label);
  end if;

  select season_category.nominee_slots + 1
  into entry_limit
  from public.season_categories as season_category
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

  return new;
end;
$$;

create trigger user_ranking_entries_validate_limit
before insert or update of ranking_id, season_id, category_id, position, custom_label
on public.user_ranking_entries
for each row execute function public.validate_user_ranking_entry_limit();

create function public.save_my_ranking(
  ranking_season_id text,
  ranking_category_id text,
  ranking_candidate_ids text[],
  ranking_custom_labels text[],
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
    from unnest(ranking_candidate_ids, ranking_custom_labels)
      as entry(candidate_id, custom_label)
    where
      (
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
    position
  )
  select
    saved_ranking_id,
    ranking_user_id,
    ranking_season_id,
    ranking_category_id,
    nullif(trim(entry.candidate_id), ''),
    nullif(trim(entry.custom_label), ''),
    entry.ordinality::smallint
  from unnest(ranking_candidate_ids, ranking_custom_labels)
    with ordinality as entry(candidate_id, custom_label, ordinality);

  return saved_ranking_id;
end;
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

create or replace function public.save_my_ranking(
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
    ranking_is_public
  )
$$;

comment on column public.season_categories.nominee_slots is
  'Número de plazas oficiales de nominación; el ranking personal permite además una alternativa.';
comment on column public.user_ranking_entries.custom_label is
  'Entrada manual del usuario no enlazada ni agregada a las fuentes de Runscars.';
comment on function public.save_my_ranking(text, text, text[], text[], boolean) is
  'Reemplaza atómicamente el ranking propio con el límite de nominaciones más una alternativa y como máximo una entrada manual.';
comment on function public.save_my_ranking(text, text, text[], boolean) is
  'Compatibilidad temporal para clientes anteriores; aplica el límite nuevo sin entradas manuales.';
