-- Phase 10 launch review: aggregator data remains private until licensed.

update public.sources
set
  editorial_status = 'paused',
  publication_status = 'review-before-publish',
  last_reviewed_on = '2026-08-26',
  notes = concat_ws(
    E'\n',
    nullif(trim(notes), ''),
    'Revisión de lanzamiento 2026-08-26: uso público pausado hasta obtener permiso o una licencia compatible.'
  )
where id in ('metacritic', 'rotten-tomatoes', 'filmaffinity');

update public.films
set verification_url = concat(
  'https://www.themoviedb.org/movie/',
  tmdb_id::text
)
where tmdb_id is not null
  and verification_url ~ '^https://(?:www\.)?(?:metacritic|rottentomatoes|filmaffinity)\.com/';

drop policy if exists source_publication_discoveries_public_read
on public.source_publication_discoveries;

revoke select on table public.source_publication_discoveries
from anon, authenticated;

drop policy if exists professional_observations_publishable_read
on public.professional_observations;

create policy professional_observations_publishable_read
on public.professional_observations for select
to anon, authenticated
using (
  state = 'published'
  and exists (
    select 1
    from public.sources
    where sources.id = professional_observations.source_id
      and sources.publication_status = 'publishable'
  )
);

comment on table public.source_publication_discoveries is
  'Índices externos conservados como procedencia editorial privada; no se exponen sin permiso compatible.';

comment on policy professional_observations_publishable_read
on public.professional_observations is
  'Solo expone observaciones publicadas cuya fuente original está aprobada para publicación.';
