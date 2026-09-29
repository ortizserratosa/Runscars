-- Ranked nominations, one independent editorial source. Only linked factual
-- ranks and provenance are public; no article body or review excerpts are copied.
insert into public.sources (
  id, name, source_types, homepage_url, editorial_status,
  technical_status, publication_status, last_reviewed_on
)
values (
  'the-movie-state', 'The Movie State', array['prediction'],
  'https://themoviestate.com/', 'selected', 'automated', 'publishable', '2026-09-29'
)
on conflict (id) do update set
  name = excluded.name,
  source_types = excluded.source_types,
  homepage_url = excluded.homepage_url,
  editorial_status = excluded.editorial_status,
  technical_status = excluded.technical_status,
  publication_status = excluded.publication_status,
  last_reviewed_on = excluded.last_reviewed_on;

insert into public.source_connectors (
  id, source_id, name, kind, endpoint_url, extractor_version,
  is_active, schedule_cron, configuration
)
values (
  'movie-state-predictions', 'the-movie-state', 'The Movie State · Ben Sears',
  'html', 'https://themoviestate.com/the-movie-state/features/award-predictions/',
  'movie-state-v1', true, '17 4 * * *',
  '{"season_id":"oscars-2027","ceremony_year":2027,"required_category_ids":["best-picture","directing","actor","actress","supporting-actor","supporting-actress","original-screenplay","adapted-screenplay"]}'::jsonb
)
on conflict (id) do update set
  source_id = excluded.source_id,
  name = excluded.name,
  kind = excluded.kind,
  endpoint_url = excluded.endpoint_url,
  extractor_version = excluded.extractor_version,
  is_active = excluded.is_active,
  schedule_cron = excluded.schedule_cron,
  configuration = excluded.configuration;
