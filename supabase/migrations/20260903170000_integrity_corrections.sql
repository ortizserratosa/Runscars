-- Integridad de candidaturas, plazas oficiales y mercados para Oscar 2027.

alter table public.season_categories
add column nominee_slots_source_url text,
add column nominee_slots_verified_on date,
add constraint season_categories_nominee_slots_source_https check (
  nominee_slots_source_url is null or nominee_slots_source_url ~ '^https://'
),
add constraint season_categories_nominee_slots_provenance_pair check (
  (nominee_slots_source_url is null) = (nominee_slots_verified_on is null)
);

update public.season_categories
set
  nominee_slots = case when category_id = 'best-picture' then 10 else 5 end,
  nominee_slots_source_url =
    'https://www.oscars.org/sites/oscars/files/2026-05/99th_oscars_complete_rules.pdf',
  nominee_slots_verified_on = '2026-09-03'
where season_id = 'oscars-2027'
  and category_id in (
    'best-picture',
    'directing',
    'actor',
    'actress',
    'supporting-actor',
    'supporting-actress',
    'original-screenplay',
    'adapted-screenplay'
  );

update public.categories
set candidate_kind = 'film'
where id in ('original-screenplay', 'adapted-screenplay');

alter table public.category_candidates
add column superseded_by_id text references public.category_candidates (id)
  on delete restrict,
add constraint category_candidates_not_self_superseded check (
  superseded_by_id is null or superseded_by_id <> id
);

create table public.category_candidate_aliases (
  old_candidate_id text primary key
    references public.category_candidates (id) on delete restrict,
  canonical_candidate_id text not null
    references public.category_candidates (id) on delete restrict,
  reason text not null,
  actor text not null,
  created_at timestamptz not null default now(),
  constraint category_candidate_aliases_distinct check (
    old_candidate_id <> canonical_candidate_id
  ),
  constraint category_candidate_aliases_reason_present check (
    nullif(trim(reason), '') is not null
  ),
  constraint category_candidate_aliases_actor_present check (
    nullif(trim(actor), '') is not null
  )
);

create table public.user_ranking_correction_history (
  id bigint generated always as identity primary key,
  ranking_id uuid not null references public.user_rankings (id)
    on delete cascade,
  reason text not null,
  previous_entries jsonb not null,
  corrected_at timestamptz not null default now(),
  actor text not null,
  constraint user_ranking_correction_entries_array check (
    jsonb_typeof(previous_entries) = 'array'
  ),
  constraint user_ranking_correction_reason_present check (
    nullif(trim(reason), '') is not null
  )
);

create or replace function public.canonicalize_screenplay_candidates(
  correction_actor text default 'migration:20260903170000'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  corrected_count integer := 0;
begin
  if nullif(trim(correction_actor), '') is null then
    raise exception 'correction actor is required' using errcode = '22023';
  end if;

  drop table if exists pg_temp.screenplay_candidate_map;
  create temporary table screenplay_candidate_map on commit drop as
  with ranked as (
    select
      candidate.id as old_candidate_id,
      first_value(candidate.id) over (
        partition by candidate.season_id, candidate.category_id, candidate.film_id
        order by
          (candidate.display_label = film.title) desc,
          candidate.created_at,
          candidate.id
      ) as canonical_candidate_id
    from public.category_candidates as candidate
    join public.films as film on film.id = candidate.film_id
    where candidate.category_id in (
      'original-screenplay',
      'adapted-screenplay'
    )
      and candidate.film_id is not null
      and candidate.superseded_by_id is null
  )
  select old_candidate_id, canonical_candidate_id
  from ranked
  where old_candidate_id <> canonical_candidate_id;

  select count(*)::integer into corrected_count
  from screenplay_candidate_map;

  if corrected_count = 0 then
    return 0;
  end if;

  insert into public.category_candidate_aliases (
    old_candidate_id,
    canonical_candidate_id,
    reason,
    actor
  )
  select
    old_candidate_id,
    canonical_candidate_id,
    'Identidad de guion consolidada por temporada, categoría y película',
    correction_actor
  from screenplay_candidate_map
  on conflict (old_candidate_id) do nothing;

  drop table if exists pg_temp.affected_rankings;
  create temporary table affected_rankings on commit drop as
  select distinct entry.ranking_id
  from public.user_ranking_entries as entry
  join screenplay_candidate_map as mapping
    on mapping.old_candidate_id = entry.category_candidate_id;

  insert into public.user_ranking_correction_history (
    ranking_id,
    reason,
    previous_entries,
    actor
  )
  select
    ranking.id,
    'Consolidación de candidaturas duplicadas de guion',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'entryId', entry.id,
          'candidateId', entry.category_candidate_id,
          'customLabel', entry.custom_label,
          'position', entry.position
        ) order by entry.position
      ),
      '[]'::jsonb
    ),
    correction_actor
  from public.user_rankings as ranking
  join affected_rankings as affected on affected.ranking_id = ranking.id
  left join public.user_ranking_entries as entry on entry.ranking_id = ranking.id
  group by ranking.id;

  delete from public.user_ranking_entries as entry
  using (
    select id
    from (
      select
        candidate_entry.id,
        row_number() over (
          partition by
            candidate_entry.ranking_id,
            coalesce(mapping.canonical_candidate_id, candidate_entry.category_candidate_id)
          order by candidate_entry.position, candidate_entry.id
        ) as duplicate_order
      from public.user_ranking_entries as candidate_entry
      left join screenplay_candidate_map as mapping
        on mapping.old_candidate_id = candidate_entry.category_candidate_id
      where candidate_entry.category_candidate_id is not null
        and candidate_entry.ranking_id in (select ranking_id from affected_rankings)
    ) as ranked_entries
    where duplicate_order > 1
  ) as duplicate
  where entry.id = duplicate.id;

  update public.user_ranking_entries as entry
  set category_candidate_id = mapping.canonical_candidate_id
  from screenplay_candidate_map as mapping
  where entry.category_candidate_id = mapping.old_candidate_id;

  alter table public.user_ranking_entries
    disable trigger user_ranking_entries_validate_limit;
  update public.user_ranking_entries as entry
  set position = entry.position + 20
  where entry.ranking_id in (select ranking_id from affected_rankings);
  update public.user_ranking_entries as entry
  set position = ordered.new_position
  from (
    select
      id,
      row_number() over (partition by ranking_id order by position, id)::smallint
        as new_position
    from public.user_ranking_entries
    where ranking_id in (select ranking_id from affected_rankings)
  ) as ordered
  where entry.id = ordered.id;
  alter table public.user_ranking_entries
    enable trigger user_ranking_entries_validate_limit;

  update public.professional_observations as observation
  set category_candidate_id = mapping.canonical_candidate_id
  from screenplay_candidate_map as mapping
  where observation.category_candidate_id = mapping.old_candidate_id;

  insert into public.category_candidate_people (
    category_candidate_id,
    person_id,
    role,
    display_order
  )
  select
    missing.canonical_candidate_id,
    missing.person_id,
    missing.role,
    (
      coalesce(existing.maximum_order, -1)
      + row_number() over (
        partition by missing.canonical_candidate_id
        order by missing.person_id, missing.role
      )
    )::smallint
  from (
    select distinct
      mapping.canonical_candidate_id,
      people.person_id,
      people.role
    from screenplay_candidate_map as mapping
    join public.category_candidate_people as people
      on people.category_candidate_id = mapping.old_candidate_id
    where not exists (
      select 1
      from public.category_candidate_people as canonical_people
      where canonical_people.category_candidate_id = mapping.canonical_candidate_id
        and canonical_people.person_id = people.person_id
        and canonical_people.role = people.role
    )
  ) as missing
  left join lateral (
    select max(display_order) as maximum_order
    from public.category_candidate_people
    where category_candidate_id = missing.canonical_candidate_id
  ) as existing on true;

  update public.category_candidates as candidate
  set
    display_label = film.title,
    identity_key =
      md5(candidate.season_id || ':' || candidate.category_id || ':' || candidate.film_id)
      || md5('screenplay:' || candidate.season_id || ':' || candidate.category_id || ':' || candidate.film_id)
  from public.films as film
  where film.id = candidate.film_id
    and candidate.id in (
      select canonical_candidate_id from screenplay_candidate_map
    );

  update public.category_candidates as candidate
  set superseded_by_id = mapping.canonical_candidate_id
  from screenplay_candidate_map as mapping
  where candidate.id = mapping.old_candidate_id;

  return corrected_count;
end;
$$;

select public.canonicalize_screenplay_candidates();

create unique index category_candidates_screenplay_film_unique
on public.category_candidates (season_id, category_id, film_id)
where category_id in ('original-screenplay', 'adapted-screenplay')
  and film_id is not null
  and superseded_by_id is null;

create table public.market_contract_exclusions (
  id bigint generated always as identity primary key,
  contract_id bigint not null unique
    references public.market_contracts (id) on delete restrict,
  reason_code text not null,
  reason text not null,
  expected_ceremony_year smallint not null,
  detected_ceremony_year smallint,
  evidence_url text not null,
  excluded_at timestamptz not null default now(),
  actor text not null,
  constraint market_contract_exclusions_reason_code_present check (
    nullif(trim(reason_code), '') is not null
  ),
  constraint market_contract_exclusions_reason_present check (
    nullif(trim(reason), '') is not null
  ),
  constraint market_contract_exclusions_url_https check (
    evidence_url ~ '^https://'
  ),
  constraint market_contract_exclusions_actor_present check (
    nullif(trim(actor), '') is not null
  )
);

insert into public.market_contract_exclusions (
  contract_id,
  reason_code,
  reason,
  expected_ceremony_year,
  detected_ceremony_year,
  evidence_url,
  actor
)
select
  contract.id,
  'ceremony_year_conflict',
  'El evento o contrato identifica la ceremonia 2026 dentro de Oscar 2027',
  2027,
  2026,
  contract.source_url,
  'migration:20260903170000'
from public.market_contracts as contract
where contract.season_id = 'oscars-2027'
  and (
    contract.source_url ~ '(^|[^0-9])2026([^0-9]|$)'
    or coalesce(contract.original_data #>> '{event,slug}', '')
      ~ '(^|[^0-9])2026([^0-9]|$)'
    or coalesce(contract.original_data #>> '{event,title}', '')
      ~ '(^|[^0-9])2026([^0-9]|$)'
    or coalesce(contract.original_data ->> 'event_ticker', '') ~ '-26(-|$)'
    or coalesce(contract.original_data ->> 'ticker', '') ~ '-26(-|$)'
  )
on conflict (contract_id) do nothing;

create trigger market_contract_exclusions_immutable
before update or delete on public.market_contract_exclusions
for each row execute function public.prevent_locked_record_mutation();

alter table public.category_candidate_aliases enable row level security;
alter table public.user_ranking_correction_history enable row level security;
alter table public.market_contract_exclusions enable row level security;

grant select on table
  public.category_candidate_aliases,
  public.market_contract_exclusions
to anon, authenticated;

grant select on table public.user_ranking_correction_history to authenticated;
grant select, insert on table
  public.category_candidate_aliases,
  public.user_ranking_correction_history,
  public.market_contract_exclusions
to service_role;
grant execute on function public.canonicalize_screenplay_candidates(text)
to service_role;

create policy category_candidate_aliases_public_read
on public.category_candidate_aliases for select
to anon, authenticated
using (true);

create policy market_contract_exclusions_public_read
on public.market_contract_exclusions for select
to anon, authenticated
using (true);

create policy user_ranking_correction_history_own_read
on public.user_ranking_correction_history for select
to authenticated
using (
  exists (
    select 1
    from public.user_rankings as ranking
    where ranking.id = user_ranking_correction_history.ranking_id
      and ranking.user_id = (select auth.uid())
  )
);

update public.source_connectors
set extractor_version = 'awards-radar-v5'
where id = 'awards-radar-predictions';

update public.source_connectors
set extractor_version = 'next-best-picture-v3'
where id = 'next-best-picture-predictions';

update public.market_connectors
set extractor_version = case
  when id = 'kalshi-oscars' then 'kalshi-v4'
  when id = 'polymarket-oscars' then 'polymarket-v4'
  else extractor_version
end
where id in ('kalshi-oscars', 'polymarket-oscars');

comment on column public.season_categories.nominee_slots_source_url is
  'Regla oficial utilizada para verificar el número de plazas de nominación.';
comment on table public.category_candidate_aliases is
  'Aliases trazables de candidaturas consolidadas sin eliminar identidades históricas.';
comment on table public.market_contract_exclusions is
  'Exclusiones append-only que retiran contratos inválidos sin borrar sus capturas.';
