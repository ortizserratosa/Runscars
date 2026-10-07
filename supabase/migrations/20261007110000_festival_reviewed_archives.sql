-- Reviewed 2026 official programmes and palmarès are imported separately from
-- web/data/festivals/2026-supplement-2026-10-07.json. Existing locked sets and
-- their entries remain unchanged; the importer publishes new versions.

update public.festival_editions
set selection_url = case id
      when 'berlinale-2026' then 'https://www.berlinale.de/en/archive/programme/programme-archive.html/y=2026/o=desc/p=1/rp=40'
      when 'locarno-2026' then 'https://letterboxd.com/filmfestlocarno/list/locarno-film-festival-2026-official-selection/'
      when 'tiff-2026' then 'https://tiff.net/films?thumbnail'
      when 'san-sebastian-2026' then 'https://www.sansebastianfestival.com/2026/sections_and_films/8/in'
      else selection_url
    end,
    awards_url = case id
      when 'venice-2026' then 'https://www.labiennale.org/en/news/official-awards-83rd-venice-international-film-festival'
      when 'tiff-2026' then 'https://tiff.net/press/news/tiff-announces-2026-award-winners'
      when 'san-sebastian-2026' then 'https://www.sansebastianfestival.com/2026/awards_and_jury_members/1/23725/in'
      else awards_url
    end,
    status = case when ends_on < date '2026-10-07' then 'completed'::public.festival_edition_status else 'ongoing'::public.festival_edition_status end,
    awards_status = case when awards_status = 'pending' and ends_on < date '2026-10-07' then 'published'::public.festival_awards_status else awards_status end,
    last_verified_at = '2026-10-07T08:32:29Z',
    updated_at = now()
where edition_year = 2026;

-- Closed-edition programmes are static, reviewed archives. Dynamic pages can
-- become empty, expose only one section or replace last year's edition; they
-- must not move the current pointer away from the complete reviewed receipt.
-- Corrections and further Locarno coverage use a new manual manifest/version.
update public.festival_connectors as connector
set endpoint_url = edition.selection_url,
    extractor_version = connector.festival_id || '-official-v4',
    is_active = edition.ends_on >= date '2026-10-07',
    configuration = connector.configuration || jsonb_build_object(
      'selection_url', edition.selection_url,
      'awards_url', edition.awards_url,
      'manual_archive_kinds', case
        when edition.ends_on >= date '2026-10-07' then '[]'::jsonb
        when edition.awards_status = 'not_applicable' then '["selection"]'::jsonb
        else '["selection","awards"]'::jsonb
      end,
      'minimum_entries', case connector.festival_id
        when 'sundance' then '{"selection":90,"awards":29}'::jsonb
        when 'berlinale' then '{"selection":149,"awards":21}'::jsonb
        when 'cannes' then '{"selection":76,"awards":16}'::jsonb
        when 'locarno' then '{"selection":63,"awards":31}'::jsonb
        when 'venice' then '{"selection":91,"awards":16}'::jsonb
        when 'tiff' then '{"selection":206,"awards":20}'::jsonb
        when 'san-sebastian' then '{"selection":141,"awards":35}'::jsonb
        when 'telluride' then '{"selection":43}'::jsonb
        when 'nyff' then '{"selection":34}'::jsonb
        else '{}'::jsonb
      end,
      'archive_reviewed_at', '2026-10-07T08:32:29Z'
    ),
    last_error = null,
    updated_at = now()
from public.festival_editions as edition
where edition.id = connector.configuration ->> 'edition_id'
  and edition.edition_year = 2026;

update public.sources as source
set technical_status = (case when connector.is_active then 'automated' else 'manual' end)::public.source_technical_status,
    last_reviewed_on = '2026-10-07',
    notes = case when connector.is_active
      then 'Selección oficial en curso; cobertura declarada por sección'
      else 'Archivo oficial revisado; correcciones mediante manifiestos versionados y cobertura declarada'
    end
from public.festival_connectors as connector
where source.id = connector.source_id;

-- Public source cards need archive state and real verification dates, without
-- exposing connector errors, scheduling details or unrestricted configuration.
create view public.public_festival_freshness
with (security_barrier = true)
as
select
  connector.source_id,
  connector.is_active,
  connector.last_success_at,
  connector.last_failure_at,
  jsonb_build_object(
    'edition_id', connector.configuration -> 'edition_id',
    'manual_archive_kinds', connector.configuration -> 'manual_archive_kinds',
    'minimum_entries', connector.configuration -> 'minimum_entries'
  ) as configuration
from public.festival_connectors as connector
join public.sources as source on source.id = connector.source_id
where source.publication_status = 'publishable';

revoke all on table public.public_festival_freshness from public;
grant select on table public.public_festival_freshness
to anon, authenticated, service_role;
