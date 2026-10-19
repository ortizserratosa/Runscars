-- Two independent editorial voices. Keep their own category update dates,
-- complete factual ballots and links; exclude panel consensus and user odds.
insert into public.sources (
  id, name, source_types, homepage_url, editorial_status,
  technical_status, publication_status, last_reviewed_on
)
values
  ('ankler', 'The Ankler', array['prediction'], 'https://anklerpundits.com/',
   'selected', 'automated', 'publishable', '2026-10-19'),
  ('the-rolling-tape', 'The Rolling Tape', array['prediction'], 'https://therollingtape.com/',
   'selected', 'automated', 'publishable', '2026-10-19')
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
select
  connector_id, source_id, name, kind::public.connector_kind, endpoint_url, extractor_version,
  true, '17 4 * * *',
  jsonb_build_object(
    'season_id', 'oscars-2027',
    'ceremony_year', 2027,
    'editorial_author', editorial_author,
    'request_timeout_ms', 15000,
    'required_category_ids', jsonb_build_array(
      'best-picture', 'directing', 'actor', 'actress',
      'supporting-actor', 'supporting-actress',
      'original-screenplay', 'adapted-screenplay'
    )
  )
from (values
  ('ankler-predictions', 'ankler', 'The Ankler · Christopher Rosen', 'html',
   'https://anklerpundits.com/pundit/christopher-rosen/', 'ankler-rosen-v1', 'Christopher Rosen'),
  ('rolling-tape-predictions', 'the-rolling-tape', 'The Rolling Tape · Danny Jarabek', 'api_json',
   'https://therollingtape.com/wp-json/op/v1/predictors/danny-jarabek', 'rolling-tape-jarabek-v1', 'Danny Jarabek')
) as profiles(connector_id, source_id, name, kind, endpoint_url, extractor_version, editorial_author)
on conflict (id) do update set
  source_id = excluded.source_id,
  name = excluded.name,
  kind = excluded.kind,
  endpoint_url = excluded.endpoint_url,
  extractor_version = excluded.extractor_version,
  is_active = excluded.is_active,
  schedule_cron = excluded.schedule_cron,
  configuration = excluded.configuration;
