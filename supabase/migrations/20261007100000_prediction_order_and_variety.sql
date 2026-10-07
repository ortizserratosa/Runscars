-- Preserve newly recognized semantic ordering under new immutable capture
-- versions. Existing captures and locked snapshots remain untouched.
update public.source_connectors
set extractor_version = case id
  when 'awardswatch-predictions' then 'awardswatch-multicategory-v7'
  when 'awards-daily-predictions' then 'awards-daily-v9'
end
where id in ('awardswatch-predictions', 'awards-daily-predictions');

-- Only public factual ranking fields are extracted from the linked Datawrapper
-- tables. Article bodies, review excerpts and eligible alphabetical catalogues
-- are excluded. All eight connectors contribute a single Variety source voice.
insert into public.sources (
  id, name, source_types, homepage_url, editorial_status,
  technical_status, publication_status, last_reviewed_on
)
values (
  'variety', 'Variety', array['prediction', 'review'], 'https://variety.com/',
  'selected', 'automated', 'publishable', '2026-10-07'
)
on conflict (id) do update set
  editorial_status = excluded.editorial_status,
  technical_status = excluded.technical_status,
  publication_status = excluded.publication_status,
  last_reviewed_on = excluded.last_reviewed_on;

insert into public.source_connectors (
  id, source_id, name, kind, endpoint_url, extractor_version,
  is_active, schedule_cron, configuration
)
select
  'variety-' || category_id || '-predictions', 'variety',
  'Variety · Clayton Davis · ' || category_name, 'html',
  'https://variety.com/lists/2027-oscars-predictions/',
  'variety-datawrapper-v1', true, '17 4 * * *',
  jsonb_build_object(
    'season_id', 'oscars-2027',
    'ceremony_year', 2027,
    'category_id', category_id,
    'discovery_url', 'https://variety.com/lists/2027-oscars-predictions/',
    'required_category_ids', jsonb_build_array(category_id),
    'persistence_concurrency', 6
  )
from (values
  ('best-picture', 'Best Picture'),
  ('directing', 'Best Director'),
  ('actor', 'Best Actor'),
  ('actress', 'Best Actress'),
  ('supporting-actor', 'Best Supporting Actor'),
  ('supporting-actress', 'Best Supporting Actress'),
  ('original-screenplay', 'Best Original Screenplay'),
  ('adapted-screenplay', 'Best Adapted Screenplay')
) as categories(category_id, category_name)
on conflict (id) do update set
  source_id = excluded.source_id,
  name = excluded.name,
  kind = excluded.kind,
  endpoint_url = excluded.endpoint_url,
  extractor_version = excluded.extractor_version,
  is_active = excluded.is_active,
  schedule_cron = excluded.schedule_cron,
  configuration = excluded.configuration;

-- One category's successful check must not hide a newer failure of another
-- connector belonging to the same medium. Expose only safe aggregate flags.
create or replace view public.public_source_freshness
with (security_barrier = true)
as
select
  source_id,
  max(last_success_at) as last_successful_check_at,
  max(last_failure_at) as last_failure_at,
  bool_or(
    is_active and last_failure_at is not null and
    (last_success_at is null or last_failure_at > last_success_at)
  ) as has_current_failure,
  bool_or(is_active) as has_active_connector
from public.source_connectors
where source_id is not null
group by source_id;
