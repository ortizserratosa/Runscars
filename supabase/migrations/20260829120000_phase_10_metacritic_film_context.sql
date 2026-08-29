-- Post-launch refinement: expose only attributed Metascore observations on
-- individual film pages. Discovery links and every other paused aggregator
-- remain private.

update public.sources
set
  editorial_status = 'selected',
  last_reviewed_on = '2026-08-29',
  notes = concat_ws(
    E'\n',
    nullif(trim(notes), ''),
    'Revisión 2026-08-29: solo el Metascore agregado puede mostrarse como contexto atribuido en la ficha de cada película; no participa en agregados Runscars.'
  )
where id = 'metacritic';

drop policy if exists professional_observations_publishable_read
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
      source_id = 'metacritic'
      and data_type = 'score_aggregate'
    )
  )
);

comment on policy professional_observations_publishable_read
on public.professional_observations is
  'Expone fuentes publishable y, de Metacritic, exclusivamente Metascores agregados atribuidos que no participan en el consenso.';
