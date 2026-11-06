-- Build source health from one row per committed capture/category. Expanding
-- every latest candidate and then re-aggregating replayed cohort/freshness work
-- under concurrent public revalidations. The public security barrier, source
-- approval, complete-capture guard and undated freshness semantics stay intact.
create or replace view public.public_prediction_source_status
with (security_barrier = true) as
with capture_groups as materialized (
  select o.source_id, o.season_id, o.category_id, o.prediction_intention,
    member.capture_id, max(o.author) as author, max(o.published_at) as observed_published_at,
    count(*)::integer as matched_count,
    max(case when jsonb_typeof(o.original_value->'list_length') = 'number'
      then (o.original_value->>'list_length')::integer end) as list_length,
    bool_or(o.data_type = 'prediction_ordered') as ordered
  from public.source_capture_observations member
  join public.source_capture_completions completion on completion.capture_id = member.capture_id
  join public.professional_observations o on o.id = member.observation_id
  join public.categories category on category.id = o.category_id and category.is_public
  join public.sources source on source.id = o.source_id and source.publication_status = 'publishable'
  where o.state = 'published' and o.data_type in ('prediction_ordered', 'prediction_selection')
  group by o.source_id, o.season_id, o.category_id, o.prediction_intention, member.capture_id
), capture_metadata as materialized (
  select g.*, source.name as source_name, p.id as publication_id,
    p.external_id as publication_external_id, p.title as publication_title,
    p.canonical_url as publication_url, capture.captured_at,
    case when capture.original_data ? 'publication_date' then
      case when capture.original_data->>'publication_date' ~ '^\d{4}-\d{2}-\d{2}(T|$)'
        then (capture.original_data->>'publication_date')::timestamptz
        when capture.original_data->'publication_date' = 'null'::jsonb then null
        else g.observed_published_at end
      else g.observed_published_at end as published_at,
    coalesce(g.list_length, case when jsonb_typeof(capture.original_data->'categories'->g.category_id) = 'array'
      then jsonb_array_length(capture.original_data->'categories'->g.category_id) end, g.matched_count) as original_count
  from capture_groups g
  join public.sources source on source.id = g.source_id
  join public.source_publication_captures capture on capture.id = g.capture_id
  join public.source_publications p on p.id = capture.publication_id
), url_revisions as (
  select *, row_number() over (partition by source_id,season_id,category_id,prediction_intention,publication_url
    order by captured_at desc,capture_id desc) as url_revision from capture_metadata
), source_revisions as (
  select *, row_number() over (partition by source_id,season_id,category_id,prediction_intention
    order by published_at desc nulls last,captured_at desc,publication_id desc) as source_revision
  from url_revisions where url_revision = 1
), latest_heads as materialized (
  select * from source_revisions where source_revision = 1
), page_categories as (
  select distinct source_id, publication_url as canonical_url, category_id
  from latest_heads where published_at is null and source_id in ('next-best-picture','midnight-critics')
), signatures as materialized (
  select captures.id, p.source_id, p.canonical_url, captures.captured_at, category.category_id,
    (select case when count(*) > 0 and bool_and(coalesce(valid, false))
        and count(distinct subject) = count(*)
        and (count(rank_value) = 0 or (count(rank_value) = count(*)
          and min(rank_value) = 1 and max(rank_value) = count(*)
          and count(distinct rank_value) = count(*)))
      then jsonb_agg(jsonb_build_object('rank', rank_value, 'subject', subject)
        order by coalesce(rank_value, 0), subject) end
     from (
       select normalize(regexp_replace(trim(case when category.category_id in ('original-screenplay','adapted-screenplay')
           then entry->'parts'->>'filmSubject' else entry->'parts'->>'subject' end), '\s+', ' ', 'g'), NFC) as subject,
         case when jsonb_typeof(entry->'rank') = 'number' and entry->>'rank' ~ '^[1-9][0-9]{0,6}$'
           then (entry->>'rank')::integer end as rank_value,
         jsonb_typeof(entry) = 'object' and jsonb_typeof(entry->'parts') = 'object'
           and jsonb_typeof(entry->'parts'->'subject') = 'string'
           and nullif(trim(entry->'parts'->>'subject'), '') is not null
           and jsonb_typeof(entry->'parts'->'filmSubject') = 'string'
           and nullif(trim(entry->'parts'->>'filmSubject'), '') is not null
           and (jsonb_typeof(entry->'rank') = 'null' or (jsonb_typeof(entry->'rank') = 'number'
             and entry->>'rank' ~ '^[1-9][0-9]{0,6}$'))
           and (category.category_id not in ('directing','actor','actress','supporting-actor','supporting-actress')
             or (jsonb_typeof(entry->'parts'->'peopleSubjects') = 'array'
               and jsonb_array_length(case when jsonb_typeof(entry->'parts'->'peopleSubjects') = 'array'
                 then entry->'parts'->'peopleSubjects' else '[]'::jsonb end) > 0
               and not exists (select 1 from jsonb_array_elements(case
                 when jsonb_typeof(entry->'parts'->'peopleSubjects') = 'array' then entry->'parts'->'peopleSubjects'
                 else '[]'::jsonb end) person
                 where jsonb_typeof(person) <> 'string' or nullif(trim(person #>> '{}'), '') is null)))
           and (captures.original_data->>'source_id' is null or captures.original_data->>'source_id' = p.source_id)
           and coalesce(captures.original_data->>'publication_date','') = '' as valid
       from jsonb_array_elements(case when jsonb_typeof(captures.original_data->'categories'->category.category_id) = 'array'
         then captures.original_data->'categories'->category.category_id else '[]'::jsonb end) entry
     ) parsed) as signature
  from public.completed_source_publication_captures captures
  join public.source_publications p on p.id = captures.publication_id
  join page_categories category on category.source_id = p.source_id and category.canonical_url = p.canonical_url
), transitions as (
  select *, case when signature = lag(signature) over (
    partition by source_id, canonical_url, category_id order by captured_at, id
  ) then 0 else 1 end as changed from signatures
), grouped as (
  select *, sum(changed) over (partition by source_id, canonical_url, category_id order by captured_at, id) as revision
  from transitions
), freshness as materialized (
  select id, category_id, min(captured_at) over (partition by source_id, canonical_url, category_id, revision) as freshness_at
  from grouped
)
select head.source_id, head.source_name, head.season_id, head.category_id, head.prediction_intention,
  head.publication_external_id, head.publication_title, head.publication_url, head.author,
  head.published_at, head.captured_at,
  coalesce(head.published_at, freshness.freshness_at, head.captured_at) as freshness_at,
  head.matched_count, head.original_count, head.ordered
from latest_heads head
left join freshness on freshness.id = head.capture_id and freshness.category_id = head.category_id;
