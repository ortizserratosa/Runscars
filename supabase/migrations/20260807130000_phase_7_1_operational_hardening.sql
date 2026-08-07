-- Fase 7.1.1: recuperación operativa, higiene editorial y catálogo verificado.

update public.source_connectors
set
  extractor_version = 'awards-daily-v3',
  updated_at = now()
where id = 'awards-daily-predictions';

insert into public.films (
  id,
  title,
  alternate_titles,
  eligibility_year,
  release_status,
  release_date,
  verification_url,
  notes
)
values
  (
    'rose-2026',
    'Rose',
    '{}',
    2026,
    'announced',
    null,
    'https://www.themoviedb.org/movie/1176962-rose',
    'Alta editorial 7.1.1; la identidad TMDB se importa mediante manifiesto versionado'
  ),
  (
    'ink',
    'Ink',
    '{}',
    2026,
    'announced',
    null,
    'https://www.themoviedb.org/movie/1532610-ink',
    'Alta editorial 7.1.1; la identidad TMDB se importa mediante manifiesto versionado'
  ),
  (
    'elsinore',
    'Elsinore',
    '{}',
    2026,
    'announced',
    null,
    'https://www.themoviedb.org/movie/1599230-elsinore',
    'Alta editorial 7.1.1; la identidad TMDB se importa mediante manifiesto versionado'
  ),
  (
    'possible-love',
    'Possible Love',
    '{}',
    2026,
    'announced',
    null,
    'https://www.themoviedb.org/movie/1483525',
    'Alta editorial 7.1.1; la identidad TMDB se importa mediante manifiesto versionado'
  )
on conflict (id) do update set
  title = excluded.title,
  alternate_titles = excluded.alternate_titles,
  eligibility_year = excluded.eligibility_year,
  verification_url = excluded.verification_url,
  notes = excluded.notes;

insert into public.season_films (season_id, film_id)
values
  ('oscars-2027', 'rose-2026'),
  ('oscars-2027', 'ink'),
  ('oscars-2027', 'elsinore'),
  ('oscars-2027', 'possible-love')
on conflict (season_id, film_id) do nothing;

with artifacts as (
  select id
  from public.professional_observations
  where source_id = 'awards-daily'
    and (
      original_subject ilike 'Alt.%'
      or original_subject ilike 'Tags:%'
      or original_subject = 'Previous Post'
      or original_subject ilike 'Oscar Podcast%'
      or original_subject ilike 'The Buzzmeter:%'
      or (
        category_id = 'costume-design'
        and (original_value ->> 'rank') ~ '^\d+$'
        and (original_value ->> 'rank')::integer > 5
      )
    )
)
update public.professional_observations
set
  state = 'excluded',
  participates = false
where id in (select id from artifacts);

update public.professional_observations
set
  state = 'excluded',
  participates = false
where source_id = 'awards-radar'
  and state = 'pending_review'
  and original_subject ~* '\s+\(or\s+';

update public.ingestion_review_items
set
  status = 'dismissed',
  resolution_note = 'Excluida: artefacto de navegación, fila alternativa o categoría mal delimitada por el parser anterior de Awards Daily',
  resolved_at = now(),
  resolved_by = 'migration-20260807130000'
where status = 'pending'
  and observation_id in (
    select id
    from public.professional_observations
    where source_id = 'awards-daily'
      and state = 'excluded'
  );

update public.ingestion_review_items
set
  status = 'dismissed',
  resolution_note = 'Excluida: la fuente no atribuye la predicción a una única película',
  resolved_at = now(),
  resolved_by = 'migration-20260807130000'
where status = 'pending'
  and observation_id in (
    select id
    from public.professional_observations
    where source_id = 'awards-radar'
      and state = 'excluded'
      and original_subject ~* '\s+\(or\s+'
  );

update public.ingestion_review_items as review
set context = review.context || jsonb_build_object(
  'season_id', observation.season_id,
  'category_id', observation.category_id,
  'subject_key', lower(regexp_replace(trim(review.subject_label), '\s+', ' ', 'g'))
)
from public.professional_observations as observation
where observation.id = review.observation_id;

with ranked as (
  select
    id,
    row_number() over (
      partition by
        connector_id,
        kind,
        context ->> 'season_id',
        context ->> 'category_id',
        context ->> 'subject_key'
      order by created_at desc, id desc
    ) as revision_order
  from public.ingestion_review_items
  where status = 'pending'
)
update public.ingestion_review_items
set
  status = 'dismissed',
  resolution_note = 'Sustituida por una revisión más reciente del mismo sujeto',
  resolved_at = now(),
  resolved_by = 'migration-20260807130000'
where id in (
  select id
  from ranked
  where revision_order > 1
);

with abandoned as (
  update public.ingestion_runs
  set
    status = 'failed',
    finished_at = now(),
    error_summary = 'Ejecución abandonada; recuperada por el mantenimiento 7.1.1'
  where status = 'running'
    and started_at < now() - interval '15 minutes'
  returning id
)
insert into public.ingestion_run_events (
  run_id,
  level,
  code,
  message,
  context
)
select
  id,
  'error',
  'connector.abandoned',
  'La ejecución se cerró al superar el umbral operativo sin terminar',
  jsonb_build_object('recovered_by', 'migration-20260807130000')
from abandoned;

comment on table public.ingestion_review_items is
  'Cola editorial privada; conserva las revisiones históricas y mantiene pendiente solo la revisión semántica más reciente por conector.';
