drop policy source_connectors_public_read
on public.source_connectors;

drop policy source_publications_public_read
on public.source_publications;

drop policy source_publication_captures_public_read
on public.source_publication_captures;

drop policy professional_observations_public_read
on public.professional_observations;

revoke select on table
  public.source_connectors,
  public.source_publication_captures
from anon, authenticated;

create policy source_publications_publishable_read
on public.source_publications for select
to anon, authenticated
using (
  exists (
    select 1
    from public.sources
    where sources.id = source_publications.source_id
      and sources.publication_status = 'publishable'
  )
);

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

comment on policy source_publications_publishable_read
on public.source_publications is
  'Impide publicar por accidente fuentes aún sujetas a revisión editorial.';

comment on policy professional_observations_publishable_read
on public.professional_observations is
  'Solo expone observaciones publicadas de fuentes aprobadas para publicación.';
