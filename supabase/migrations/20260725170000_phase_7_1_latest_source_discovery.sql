-- Phase 7.1: discover the latest eligible prediction on every scheduled run.

alter table public.source_publications
  drop constraint if exists source_publications_source_id_canonical_url_key;

create index if not exists source_publications_source_canonical_idx
  on public.source_publications (source_id, canonical_url);

comment on index public.source_publications_source_canonical_idx is
  'A mutable source URL may have multiple immutable, content-addressed revisions.';

update public.source_connectors
set
  endpoint_url = 'https://www.awardsdaily.com/wp-json/wp/v2/search?search=2027%20Oscar%20Predictions&per_page=20&_fields=id,url,title,subtype',
  extractor_version = 'awards-daily-v2',
  configuration = jsonb_build_object(
    'season_id', 'oscars-2027',
    'ceremony_year', 2027,
    'discovery_url', 'https://www.awardsdaily.com/wp-json/wp/v2/search?search=2027%20Oscar%20Predictions&per_page=20&_fields=id,url,title,subtype',
    'discovery_limit', 12
  )
where id = 'awards-daily-predictions';

update public.source_connectors
set
  endpoint_url = 'https://awardsradar.com/predictions/',
  extractor_version = 'awards-radar-v2',
  configuration = jsonb_build_object(
    'season_id', 'oscars-2027',
    'ceremony_year', 2027,
    'category_urls', jsonb_build_object(
      'best-picture', 'https://awardsradar.com/best-picture/',
      'directing', 'https://awardsradar.com/best-director/',
      'actor', 'https://awardsradar.com/best-actor/',
      'actress', 'https://awardsradar.com/best-actress/',
      'supporting-actor', 'https://awardsradar.com/best-supporting-actor/',
      'supporting-actress', 'https://awardsradar.com/best-supporting-actress/',
      'original-screenplay', 'https://awardsradar.com/best-original-screenplay/',
      'adapted-screenplay', 'https://awardsradar.com/best-adapted-screenplay/'
    )
  )
where id = 'awards-radar-predictions';

update public.source_connectors
set
  extractor_version = 'next-best-picture-v2',
  configuration = configuration || jsonb_build_object(
    'ceremony_year', 2027,
    'discovery_mode', 'mutable-page'
  )
where id = 'next-best-picture-predictions';

update public.source_connectors
set
  extractor_version = 'midnight-critics-v2',
  configuration = configuration || jsonb_build_object(
    'ceremony_year', 2027,
    'discovery_mode', 'mutable-page'
  )
where id = 'midnight-critics-predictions';

update public.source_connectors
set
  endpoint_url = 'https://www.theringer.com/topic/oscars',
  extractor_version = 'the-ringer-v2',
  configuration = jsonb_build_object(
    'season_id', 'oscars-2027',
    'category_id', 'best-picture',
    'ceremony_year', 2027,
    'article_fallback_url', 'https://www.theringer.com/2026/03/20/oscars/oscars-2027-predictions-best-picture-movies-contenders'
  )
where id = 'ringer-best-picture';

update public.source_connectors
set
  extractor_version = 'awardswatch-multicategory-v3',
  configuration = configuration || jsonb_build_object(
    'archive_url', 'https://awardswatch.com/category/predictions/film-predictions/oscars-predictions/2027-oscar-predictions/'
  )
where id = 'awardswatch-predictions';
