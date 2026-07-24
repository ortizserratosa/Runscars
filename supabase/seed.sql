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

insert into public.categories (id, name, subject, display_order)
values
  ('best-picture', 'Mejor película', 'film', 1),
  ('directing', 'Dirección', 'person', 2),
  ('actor', 'Actor protagonista', 'person', 3),
  ('actress', 'Actriz protagonista', 'person', 4),
  ('supporting-actor', 'Actor de reparto', 'person', 5),
  ('supporting-actress', 'Actriz de reparto', 'person', 6),
  ('original-screenplay', 'Guion original', 'film', 7),
  ('adapted-screenplay', 'Guion adaptado', 'film', 8)
on conflict (id) do update set
  name = excluded.name,
  subject = excluded.subject,
  display_order = excluded.display_order;

insert into public.season_categories (season_id, category_id)
select 'oscars-2027', id
from public.categories
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
    true,
    '17 4 * * *',
    '{
      "season_id": "oscars-2027",
      "category_id": "best-picture",
      "intention": "nomination"
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
  else technical_status
end
where id in ('guardian', 'roger-ebert', 'awardswatch');
