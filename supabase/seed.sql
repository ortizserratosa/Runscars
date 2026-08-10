insert into public.seasons (
  id,
  ceremony_year,
  eligibility_year,
  status
)
values ('oscars-2027', 2027, 2026, 'active')
on conflict (id) do update set
  ceremony_year = excluded.ceremony_year,
  eligibility_year = excluded.eligibility_year,
  status = excluded.status;

insert into public.seasons (
  id,
  ceremony_year,
  eligibility_year,
  nominations_announced_on,
  ceremony_on,
  status
)
values (
  'oscars-2026',
  2026,
  2025,
  '2026-01-22',
  '2026-03-15',
  'closed'
)
on conflict (id) do update set
  ceremony_year = excluded.ceremony_year,
  eligibility_year = excluded.eligibility_year,
  nominations_announced_on = excluded.nominations_announced_on,
  ceremony_on = excluded.ceremony_on,
  status = excluded.status;

insert into public.categories (
  id,
  name,
  subject,
  display_order,
  is_public,
  candidate_kind
)
values
  ('best-picture', 'Mejor película', 'film', 1, true, 'film'),
  ('directing', 'Dirección', 'person', 2, true, 'team'),
  ('actor', 'Actor protagonista', 'person', 3, true, 'performance'),
  ('actress', 'Actriz protagonista', 'person', 4, true, 'performance'),
  ('supporting-actor', 'Actor de reparto', 'person', 5, true, 'performance'),
  ('supporting-actress', 'Actriz de reparto', 'person', 6, true, 'performance'),
  ('original-screenplay', 'Guion original', 'film', 7, true, 'team'),
  ('adapted-screenplay', 'Guion adaptado', 'film', 8, true, 'team'),
  ('casting', 'Casting', 'film', 9, false, 'team'),
  ('cinematography', 'Fotografía', 'film', 10, false, 'team'),
  ('film-editing', 'Montaje', 'film', 11, false, 'team'),
  ('original-score', 'Música original', 'film', 12, false, 'team'),
  ('original-song', 'Canción original', 'film', 13, false, 'work'),
  ('sound', 'Sonido', 'film', 14, false, 'team'),
  ('visual-effects', 'Efectos visuales', 'film', 15, false, 'team'),
  ('animated-feature', 'Película de animación', 'film', 16, false, 'film'),
  ('documentary-feature', 'Documental', 'film', 17, false, 'film'),
  ('international-feature', 'Película internacional', 'film', 18, false, 'film'),
  ('costume-design', 'Vestuario', 'film', 19, false, 'team'),
  ('makeup-hairstyling', 'Maquillaje y peluquería', 'film', 20, false, 'team'),
  ('production-design', 'Diseño de producción', 'film', 21, false, 'team')
on conflict (id) do update set
  name = excluded.name,
  subject = excluded.subject,
  display_order = excluded.display_order,
  is_public = excluded.is_public,
  candidate_kind = excluded.candidate_kind;

insert into public.season_categories (season_id, category_id)
select 'oscars-2027', id
from public.categories
on conflict (season_id, category_id) do update set is_enabled = true;

insert into public.season_categories (season_id, category_id)
select 'oscars-2026', id
from public.categories
where is_public = true
on conflict (season_id, category_id) do update set is_enabled = true;

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
    'the-odyssey',
    'The Odyssey',
    '{}',
    2026,
    'released',
    '2026-07-17',
    'https://www.theguardian.com/film/2026/jul/15/the-odyssey-review-christopher-nolan-matt-damon',
    'Fecha de estreno UK/US indicada en la reseña'
  ),
  (
    'dune-part-three',
    'Dune: Part Three',
    array['Dune Part III', 'Dune: Messiah'],
    2026,
    'upcoming',
    null,
    'https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/',
    'Se conservan variantes publicadas'
  ),
  (
    'wild-horse-nine',
    'Wild Horse Nine',
    array['Wild Horse 9'],
    2026,
    'upcoming',
    null,
    'https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/',
    'Variante numérica conservada'
  ),
  (
    'project-hail-mary',
    'Project Hail Mary',
    '{}',
    2026,
    'released',
    '2026-03-20',
    'https://www.theguardian.com/film/2026/mar/10/project-hail-mary-review-ryan-goslings-charm-carries-unserious-last-ditch-space-mission',
    'Fecha de estreno US indicada en la reseña'
  ),
  ('la-bola-negra', 'La Bola Negra', '{}', 2026, 'upcoming', null, 'https://predictions.nextbestpicture.com/oscars', null),
  ('fjord', 'Fjord', '{}', 2026, 'upcoming', null, 'https://predictions.nextbestpicture.com/oscars', null),
  ('digger', 'Digger', '{}', 2026, 'upcoming', null, 'https://awardsradar.com/best-picture/', null),
  ('the-debut', 'The Debut', '{}', 2026, 'upcoming', null, 'https://predictions.nextbestpicture.com/oscars', null),
  ('behemoth', 'Behemoth!', '{}', 2026, 'upcoming', null, 'https://predictions.nextbestpicture.com/oscars', null),
  (
    'cliff-booth',
    'The Adventures of Cliff Booth',
    array['Untitled Cliff Booth Movie'],
    2026,
    'upcoming',
    null,
    'https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/',
    'Título provisional conservado'
  ),
  ('the-invite', 'The Invite', '{}', 2026, 'released', null, 'https://predictions.nextbestpicture.com/oscars', 'La muestra no fija fecha de estreno'),
  ('obsession', 'Obsession', '{}', 2026, 'released', null, 'https://www.metacritic.com/movie/obsession-2025/', 'El slug de Metacritic conserva 2025; la muestra corresponde a estreno 2026'),
  ('the-social-reckoning', 'The Social Reckoning', '{}', 2026, 'upcoming', null, 'https://awardsradar.com/best-picture/', null),
  ('fatherland', 'Fatherland', '{}', 2026, 'upcoming', null, 'https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/', null),
  ('all-of-a-sudden', 'All of a Sudden', array['Soudain'], 2026, 'upcoming', null, 'https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/', 'Título alternativo publicado'),
  ('being-heumann', 'Being Heumann', '{}', 2026, 'upcoming', null, 'https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/', null),
  ('michael', 'Michael', '{}', 2026, 'released', null, 'https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/', 'La muestra no fija fecha de estreno'),
  ('sense-and-sensibility', 'Sense and Sensibility', '{}', 2026, 'upcoming', null, 'https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/', null),
  ('saturn-return', 'Saturn Return', '{}', 2026, 'upcoming', null, 'https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/', null),
  ('primetime', 'Primetime', '{}', 2026, 'upcoming', null, 'https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/', null)
  ,
  ('one-battle-after-another', 'One Battle After Another', '{}', 2025, 'released', '2025-09-23', 'https://www.oscars.org/oscars/ceremonies/2026', 'Nominada y ganadora oficial de 2026'),
  ('bugonia', 'Bugonia', '{}', 2025, 'released', '2025-10-23', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('f1', 'F1', array['F1 The Movie'], 2025, 'released', '2025-06-25', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('frankenstein-2025', 'Frankenstein', '{}', 2025, 'released', '2025-10-17', 'https://www.oscars.org/oscars/ceremonies/2026', 'Película de Guillermo del Toro'),
  ('hamnet', 'Hamnet', '{}', 2025, 'released', '2025-11-26', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('marty-supreme', 'Marty Supreme', '{}', 2025, 'released', '2025-12-19', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('the-secret-agent', 'The Secret Agent', '{}', 2025, 'released', '2025-07-23', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('sentimental-value', 'Sentimental Value', '{}', 2025, 'released', '2025-08-20', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('sinners', 'Sinners', '{}', 2025, 'released', '2025-04-16', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('train-dreams', 'Train Dreams', '{}', 2025, 'released', '2025-11-05', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('blue-moon', 'Blue Moon', '{}', 2025, 'released', '2025-10-17', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('if-i-had-legs-id-kick-you', 'If I Had Legs I''d Kick You', array['If I Had Legs I’d Kick You'], 2025, 'released', '2025-10-10', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('song-sung-blue', 'Song Sung Blue', '{}', 2025, 'released', '2025-12-15', 'https://www.oscars.org/oscars/ceremonies/2026', null),
  ('weapons', 'Weapons', '{}', 2025, 'released', '2025-08-04', 'https://www.oscars.org/oscars/ceremonies/2026', null)
  ,
  ('it-was-just-an-accident', 'It Was Just an Accident', array['Un simple accident'], 2025, 'released', '2025-10-01', 'https://www.oscars.org/oscars/ceremonies/2026', null)
on conflict (id) do update set
  title = excluded.title,
  alternate_titles = excluded.alternate_titles,
  eligibility_year = excluded.eligibility_year,
  release_status = excluded.release_status,
  release_date = excluded.release_date,
  verification_url = excluded.verification_url,
  notes = excluded.notes;

insert into public.season_films (season_id, film_id)
select 'oscars-2027', id
from public.films
where eligibility_year = 2026
on conflict (season_id, film_id) do nothing;

insert into public.season_films (season_id, film_id)
select 'oscars-2026', id
from public.films
where eligibility_year = 2025
on conflict (season_id, film_id) do nothing;

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
values
  ('tmdb', 'TMDB', array['metadata'], 'https://www.themoviedb.org/', 'selected', 'manual', 'publishable', '2026-07-24'),
  ('academy', 'Academy of Motion Picture Arts and Sciences', array['official'], 'https://www.oscars.org/', 'selected', 'manual', 'publishable', '2026-07-24'),
  ('awards-daily', 'Awards Daily', array['prediction'], 'https://www.awardsdaily.com/', 'selected', 'prototype', 'review-before-publish', '2026-07-24'),
  ('awards-radar', 'Awards Radar', array['prediction'], 'https://awardsradar.com/', 'selected', 'prototype', 'review-before-publish', '2026-07-24'),
  ('awardswatch', 'AwardsWatch', array['prediction'], 'https://awardswatch.com/', 'selected', 'prototype', 'review-before-publish', '2026-07-24'),
  ('film-stage', 'The Film Stage', array['review'], 'https://thefilmstage.com/', 'selected', 'manual', 'review-before-publish', '2026-07-24'),
  ('guardian', 'The Guardian', array['review', 'score'], 'https://www.theguardian.com/film', 'selected', 'prototype', 'review-before-publish', '2026-07-24'),
  ('hollywood-reporter', 'The Hollywood Reporter', array['prediction', 'review'], 'https://www.hollywoodreporter.com/', 'selected', 'manual', 'review-before-publish', '2026-07-24'),
  ('latimes', 'Los Angeles Times', array['review'], 'https://www.latimes.com/entertainment-arts/movies', 'selected', 'manual', 'review-before-publish', '2026-07-24'),
  ('little-white-lies', 'Little White Lies', array['review', 'score'], 'https://lwlies.com/', 'selected', 'manual', 'review-before-publish', '2026-07-24'),
  ('metacritic', 'Metacritic', array['score', 'review'], 'https://www.metacritic.com/movie/', 'selected', 'manual', 'replace-before-publish', '2026-07-24'),
  ('next-best-picture', 'Next Best Picture', array['prediction', 'review'], 'https://nextbestpicture.com/', 'selected', 'prototype', 'review-before-publish', '2026-07-24'),
  ('midnight-critics', 'Midnight Critics Circle', array['prediction'], 'https://www.midnightcritics.com/', 'selected', 'automated', 'publishable', '2026-07-25'),
  ('the-ringer', 'The Ringer', array['prediction'], 'https://www.theringer.com/', 'selected', 'automated', 'publishable', '2026-07-25'),
  ('kalshi', 'Kalshi', array['market'], 'https://kalshi.com/', 'selected', 'automated', 'publishable', '2026-07-25'),
  ('polymarket', 'Polymarket', array['market'], 'https://polymarket.com/', 'selected', 'automated', 'publishable', '2026-07-25'),
  ('nytimes', 'The New York Times', array['review'], 'https://www.nytimes.com/section/movies', 'selected', 'manual', 'review-before-publish', '2026-07-24'),
  ('roger-ebert', 'RogerEbert.com', array['score', 'review'], 'https://www.rogerebert.com/', 'selected', 'prototype', 'review-before-publish', '2026-07-24'),
  ('rotten-tomatoes', 'Rotten Tomatoes', array['score', 'review'], 'https://www.rottentomatoes.com/', 'selected', 'manual', 'replace-before-publish', '2026-07-24'),
  ('screen-daily', 'Screen Daily', array['review'], 'https://www.screendaily.com/', 'selected', 'manual', 'review-before-publish', '2026-07-24'),
  ('slant', 'Slant Magazine', array['review', 'score'], 'https://www.slantmagazine.com/film/', 'selected', 'manual', 'review-before-publish', '2026-07-24'),
  ('variety', 'Variety', array['prediction', 'review'], 'https://variety.com/', 'selected', 'manual', 'review-before-publish', '2026-07-24'),
  ('washington-post', 'The Washington Post', array['review', 'score'], 'https://www.washingtonpost.com/entertainment/movies/', 'selected', 'manual', 'review-before-publish', '2026-07-24')
on conflict (id) do update set
  name = excluded.name,
  source_types = excluded.source_types,
  homepage_url = excluded.homepage_url,
  editorial_status = excluded.editorial_status,
  technical_status = excluded.technical_status,
  publication_status = excluded.publication_status,
  last_reviewed_on = excluded.last_reviewed_on;

insert into public.source_connectors (
  id,
  source_id,
  name,
  kind,
  endpoint_url,
  extractor_version,
  is_active,
  schedule_cron,
  configuration
)
values
  (
    'manual-editorial',
    null,
    'Importación editorial manual',
    'manual',
    null,
    'manual-v1',
    false,
    null,
    '{"format_version": 1}'::jsonb
  ),
  (
    'guardian-content-api',
    'guardian',
    'Guardian Content API',
    'api_json',
    'https://content.guardianapis.com/search',
    'guardian-v1',
    true,
    '17 4 * * *',
    '{
      "season_id": "oscars-2027",
      "query": "film review",
      "catalog_only": true,
      "requires_secret": "GUARDIAN_CONTENT_API_KEY"
    }'::jsonb
  ),
  (
    'roger-ebert-rss',
    'roger-ebert',
    'RogerEbert.com RSS',
    'rss',
    'https://www.rogerebert.com/feed',
    'roger-ebert-v1',
    true,
    '17 4 * * *',
    '{
      "season_id": "oscars-2027",
      "allowed_path_prefix": "/reviews/"
    }'::jsonb
  ),
  (
    'awardswatch-best-picture',
    'awardswatch',
    'AwardsWatch Best Picture',
    'html',
    'https://awardswatch.com/2027-oscar-predictions-best-picture-and-best-director-june/',
    'awardswatch-v1',
    false,
    null,
    '{
      "season_id": "oscars-2027",
      "category_id": "best-picture",
      "intention": "nomination"
    }'::jsonb
  ),
  (
    'awardswatch-predictions',
    'awardswatch',
    'AwardsWatch Oscar Predictions HQ',
    'html',
    'https://awardswatch.com/oscar-predictions-hq/',
    'awardswatch-multicategory-v4',
    true,
    '17 4 * * *',
    '{
      "season_id": "oscars-2027",
      "ceremony_year": 2027,
      "category_ids": [
        "best-picture",
        "directing",
        "actor",
        "actress",
        "supporting-actor",
        "supporting-actress",
        "original-screenplay",
        "adapted-screenplay"
      ],
      "archive_url": "https://awardswatch.com/category/predictions/film-predictions/oscars-predictions/2027-oscar-predictions/"
    }'::jsonb
  ),
  (
    'awards-daily-predictions',
    'awards-daily',
    'Awards Daily Oscar predictions',
    'html',
    'https://www.awardsdaily.com/wp-json/wp/v2/search?search=2027%20Oscar%20Predictions&per_page=20&_fields=id,url,title,subtype',
    'awards-daily-v3',
    true,
    '17 4 * * *',
    '{
      "season_id": "oscars-2027",
      "ceremony_year": 2027,
      "discovery_url": "https://www.awardsdaily.com/wp-json/wp/v2/search?search=2027%20Oscar%20Predictions&per_page=20&_fields=id,url,title,subtype",
      "discovery_limit": 12
    }'::jsonb
  ),
  (
    'awards-radar-predictions',
    'awards-radar',
    'Awards Radar Oscar predictions',
    'html',
    'https://awardsradar.com/predictions/',
    'awards-radar-v3',
    true,
    '17 4 * * *',
    '{
      "season_id": "oscars-2027",
      "ceremony_year": 2027,
      "category_urls": {
        "best-picture": "https://awardsradar.com/best-picture/",
        "directing": "https://awardsradar.com/best-director/",
        "actor": "https://awardsradar.com/best-actor/",
        "actress": "https://awardsradar.com/best-actress/",
        "supporting-actor": "https://awardsradar.com/best-supporting-actor/",
        "supporting-actress": "https://awardsradar.com/best-supporting-actress/",
        "original-screenplay": "https://awardsradar.com/best-original-screenplay/",
        "adapted-screenplay": "https://awardsradar.com/best-adapted-screenplay/"
      }
    }'::jsonb
  ),
  (
    'next-best-picture-predictions',
    'next-best-picture',
    'Next Best Picture Oscar predictions',
    'html',
    'https://predictions.nextbestpicture.com/u/655756da85df4c0efaa10bd2/oscars',
    'next-best-picture-v2',
    true,
    '17 4 * * *',
    '{
      "season_id": "oscars-2027",
      "ceremony_year": 2027,
      "discovery_mode": "mutable-page"
    }'::jsonb
  ),
  (
    'midnight-critics-predictions',
    'midnight-critics',
    'Midnight Critics Circle consensus',
    'html',
    'https://www.midnightcritics.com/predictions/2027-oscar-predictions',
    'midnight-critics-v2',
    true,
    '17 4 * * *',
    '{
      "season_id": "oscars-2027",
      "ceremony_year": 2027,
      "discovery_mode": "mutable-page"
    }'::jsonb
  ),
  (
    'ringer-best-picture',
    'the-ringer',
    'The Ringer Best Picture selections',
    'html',
    'https://www.theringer.com/topic/oscars',
    'the-ringer-v2',
    true,
    '17 4 * * *',
    '{
      "season_id": "oscars-2027",
      "category_id": "best-picture",
      "ceremony_year": 2027,
      "article_fallback_url": "https://www.theringer.com/2026/03/20/oscars/oscars-2027-predictions-best-picture-movies-contenders"
    }'::jsonb
  ),
  (
    'academy-archive-2026',
    'academy',
    'Archivo oficial Oscars 2026',
    'html',
    'https://www.oscars.org/oscars/ceremonies/2026',
    'academy-archive-v1',
    false,
    null,
    '{
      "season_id":"oscars-2026",
      "manifest":"web/data/phase-7/oscars-2026.json",
      "command":"npm run results:archive"
    }'::jsonb
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

update public.sources
set technical_status = case id
  when 'guardian' then 'automated'::public.source_technical_status
  when 'roger-ebert' then 'automated'::public.source_technical_status
  when 'awardswatch' then 'automated'::public.source_technical_status
  when 'awards-daily' then 'automated'::public.source_technical_status
  when 'awards-radar' then 'automated'::public.source_technical_status
  when 'next-best-picture' then 'automated'::public.source_technical_status
  when 'midnight-critics' then 'automated'::public.source_technical_status
  when 'the-ringer' then 'automated'::public.source_technical_status
  else technical_status
end
where id in (
  'guardian',
  'roger-ebert',
  'awardswatch',
  'awards-daily',
  'awards-radar',
  'next-best-picture',
  'midnight-critics',
  'the-ringer'
);

update public.sources
set technical_status = 'automated'
where id = 'academy';

update public.sources
set
  editorial_status = 'selected',
  publication_status = 'publishable',
  last_reviewed_on = '2026-07-25'
where id in (
  'awardswatch',
  'awards-daily',
  'awards-radar',
  'next-best-picture',
  'midnight-critics',
  'the-ringer'
);

insert into public.snapshot_schedules (
  id,
  season_id,
  category_id,
  prediction_intention,
  kind,
  cron_expression,
  time_zone,
  is_active
)
select
  'oscars-2027-' || id || '-nomination-weekly',
  'oscars-2027',
  id,
  'nomination',
  'periodic',
  '47 4 * * *',
  'UTC',
  true
from public.categories
where is_public = true
on conflict (id) do update set
  season_id = excluded.season_id,
  category_id = excluded.category_id,
  prediction_intention = excluded.prediction_intention,
  kind = excluded.kind,
  cron_expression = excluded.cron_expression,
  time_zone = excluded.time_zone,
  is_active = excluded.is_active;

insert into public.market_connectors (
  id,
  source_id,
  provider,
  endpoint_url,
  extractor_version,
  schedule_cron,
  is_active,
  configuration
)
values
  (
    'kalshi-oscars',
    'kalshi',
    'kalshi',
    'https://external-api.kalshi.com/trade-api/v2/markets',
    'kalshi-v2',
    '17 * * * *',
    true,
    '{
      "ceremony_year": 2027,
      "season_id": "oscars-2027",
      "series_tickers": [
        "KXOSCARNOMPIC", "KXOSCARPIC",
        "KXOSCARNOMDIR", "KXOSCARDIR",
        "KXOSCARNOMACTO", "KXOSCARACTO",
        "KXOSCARNOMACTR", "KXOSCARACTR",
        "KXOSCARNOMSUPACTO", "KXOSCARSUPACTO",
        "KXOSCARNOMSUPACTR", "KXOSCARSUPACTR",
        "KXOSCARNOMSPLAY", "KXOSCARSPLAY",
        "KXOSCARNOMASPLAY", "KXOSCARASPLAY"
      ]
    }'::jsonb
  ),
  (
    'polymarket-oscars',
    'polymarket',
    'polymarket',
    'https://gamma-api.polymarket.com/markets',
    'polymarket-v2',
    '17 * * * *',
    true,
    '{
      "ceremony_year": 2027,
      "query": "Oscars 2027",
      "season_id": "oscars-2027"
    }'::jsonb
  )
on conflict (id) do update set
  source_id = excluded.source_id,
  provider = excluded.provider,
  endpoint_url = excluded.endpoint_url,
  extractor_version = excluded.extractor_version,
  schedule_cron = excluded.schedule_cron,
  is_active = excluded.is_active,
  configuration = excluded.configuration;
