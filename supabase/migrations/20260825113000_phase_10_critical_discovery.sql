-- Phase 10: aggregator discovery is provenance, not a new critical voice.

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
values (
  'filmaffinity',
  'FilmAffinity',
  array['review'],
  'https://www.filmaffinity.com/',
  'selected',
  'manual',
  'replace-before-publish',
  '2026-08-25'
)
on conflict (id) do update set
  name = excluded.name,
  source_types = excluded.source_types,
  homepage_url = excluded.homepage_url,
  editorial_status = excluded.editorial_status,
  technical_status = excluded.technical_status,
  publication_status = excluded.publication_status,
  last_reviewed_on = excluded.last_reviewed_on;

create table public.source_publication_discoveries (
  id bigint generated always as identity primary key,
  publication_id bigint not null references public.source_publications (id)
    on delete cascade,
  discovery_source_id text not null references public.sources (id)
    on delete restrict,
  discovery_url text not null,
  discovered_at timestamptz not null,
  original_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint source_publication_discoveries_url_https check (
    discovery_url ~ '^https://'
  ),
  constraint source_publication_discoveries_original_object check (
    jsonb_typeof(original_data) = 'object'
  ),
  unique (publication_id, discovery_source_id, discovery_url)
);

create index source_publication_discoveries_publication_idx
on public.source_publication_discoveries (publication_id, discovered_at desc);

alter table public.source_publication_discoveries enable row level security;

grant select, insert on table public.source_publication_discoveries
to service_role;

grant select on table public.source_publication_discoveries
to anon, authenticated;

grant usage, select on sequence public.source_publication_discoveries_id_seq
to service_role;

create policy source_publication_discoveries_public_read
on public.source_publication_discoveries for select
to anon, authenticated
using (
  discovery_source_id in ('metacritic', 'rotten-tomatoes', 'filmaffinity')
);

-- A curated individual observation can become public when an approved
-- aggregator discovered the original publication. The original source stays
-- review-before-publish; only the explicitly published observation is exposed.
drop policy professional_observations_publishable_read
on public.professional_observations;

create policy professional_observations_publishable_read
on public.professional_observations for select
to anon, authenticated
using (
  state = 'published'
  and (
    exists (
      select 1
      from public.sources
      where sources.id = professional_observations.source_id
        and sources.publication_status = 'publishable'
    )
    or (
      data_type = 'score_aggregate'
      and source_id in ('metacritic', 'rotten-tomatoes')
    )
    or (
      data_type in ('review', 'score_individual')
      and exists (
        select 1
        from public.source_publication_discoveries as discoveries
        where discoveries.publication_id = professional_observations.publication_id
          and discoveries.discovery_source_id in (
            'metacritic',
            'rotten-tomatoes',
            'filmaffinity'
          )
          and discoveries.discovery_source_id <> professional_observations.source_id
      )
    )
  )
);

comment on table public.source_publication_discoveries is
  'Índices externos que ayudaron a descubrir una pieza original; no son una señal crítica adicional.';

comment on policy professional_observations_publishable_read
on public.professional_observations is
  'Expone fuentes publishable, agregados atribuidos de Metacritic/Rotten Tomatoes y reseñas individuales publicadas descubiertas por un agregador aprobado.';
