-- Bound public read work to selected capture heads. Materialized historical
-- group CTEs blocked source/season filters, while global signature windows
-- reparsed unrelated receipts for every source detail request. Public barriers,
-- complete-capture membership and all evidence/selection rules remain intact.
create index if not exists professional_observations_prediction_scope_idx
  on public.professional_observations (source_id, season_id, prediction_intention, category_id, id)
  include (publication_id, published_at)
  where state = 'published' and data_type in ('prediction_ordered','prediction_selection');
create index if not exists source_publications_source_url_idx
  on public.source_publications (source_id, canonical_url, id);

create or replace view public.public_prediction_source_status
with (security_barrier = true) as
-- Only publication age is needed while resolving historical URL revisions.
-- Summarize ranked-list fields after choosing the winning complete capture.
with capture_groups as (
  select o.source_id, o.season_id, o.category_id, o.prediction_intention,
    member.capture_id, max(o.published_at) as observed_published_at
  from public.source_capture_observations member
  join public.source_capture_completions completion on completion.capture_id = member.capture_id
  join public.professional_observations o on o.id = member.observation_id
  join public.categories category on category.id = o.category_id and category.is_public
  join public.sources source on source.id = o.source_id and source.publication_status = 'publishable'
  where o.state = 'published' and o.data_type in ('prediction_ordered', 'prediction_selection')
  group by o.source_id, o.season_id, o.category_id, o.prediction_intention, member.capture_id
), capture_metadata as (
  select g.*, source.name as source_name, p.id as publication_id,
    p.external_id as publication_external_id, p.title as publication_title,
    p.canonical_url as publication_url, capture.captured_at,
    case when capture.original_data ? 'publication_date' then
      case when capture.original_data->>'publication_date' ~ '^\d{4}-\d{2}-\d{2}(T|$)'
        then (capture.original_data->>'publication_date')::timestamptz
        when capture.original_data->'publication_date' = 'null'::jsonb then null
        else g.observed_published_at end
      else g.observed_published_at end as published_at
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
), latest_heads as (
  select * from source_revisions where source_revision = 1
)
select head.source_id, head.source_name, head.season_id, head.category_id, head.prediction_intention,
  head.publication_external_id, head.publication_title, head.publication_url, summary.author,
  head.published_at, head.captured_at,
  coalesce(head.published_at, undated.freshness_at, head.captured_at) as freshness_at,
  summary.matched_count,
  coalesce(summary.list_length,
    case when jsonb_typeof(receipt.original_data->'categories'->head.category_id) = 'array'
      then jsonb_array_length(receipt.original_data->'categories'->head.category_id) end,
    summary.matched_count) as original_count, summary.ordered
from latest_heads head
join public.source_publication_captures receipt on receipt.id = head.capture_id
cross join lateral (
  select max(o.author) as author, count(*)::integer as matched_count,
    max(case when jsonb_typeof(o.original_value->'list_length') = 'number'
      then (o.original_value->>'list_length')::integer end) as list_length,
    bool_or(o.data_type = 'prediction_ordered') as ordered
  from public.source_capture_observations member
  join public.professional_observations o on o.id = member.observation_id
  where member.capture_id = head.capture_id and o.source_id = head.source_id
    and o.season_id = head.season_id and o.category_id = head.category_id
    and o.prediction_intention = head.prediction_intention and o.state = 'published'
    and o.data_type in ('prediction_ordered','prediction_selection')
) summary
left join lateral (
  with signatures as materialized (
  select captures.id, p.source_id, p.canonical_url, captures.captured_at, head.category_id,
    (select case when count(*) > 0 and bool_and(coalesce(valid, false))
        and count(distinct subject) = count(*)
        and (count(rank_value) = 0 or (count(rank_value) = count(*)
          and min(rank_value) = 1 and max(rank_value) = count(*)
          and count(distinct rank_value) = count(*)))
      then jsonb_agg(jsonb_build_object('rank', rank_value, 'subject', subject)
        order by coalesce(rank_value, 0), subject) end
     from (
       select normalize(regexp_replace(trim(case when head.category_id in ('original-screenplay','adapted-screenplay')
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
           and (head.category_id not in ('directing','actor','actress','supporting-actor','supporting-actress')
             or (jsonb_typeof(entry->'parts'->'peopleSubjects') = 'array'
               and jsonb_array_length(case when jsonb_typeof(entry->'parts'->'peopleSubjects') = 'array'
                 then entry->'parts'->'peopleSubjects' else '[]'::jsonb end) > 0
               and not exists (select 1 from jsonb_array_elements(case
                 when jsonb_typeof(entry->'parts'->'peopleSubjects') = 'array' then entry->'parts'->'peopleSubjects'
                 else '[]'::jsonb end) person
                 where jsonb_typeof(person) <> 'string' or nullif(trim(person #>> '{}'), '') is null)))
           and (captures.original_data->>'source_id' is null or captures.original_data->>'source_id' = p.source_id)
           and coalesce(captures.original_data->>'publication_date','') = '' as valid
       from jsonb_array_elements(case when jsonb_typeof(captures.original_data->'categories'->head.category_id) = 'array'
         then captures.original_data->'categories'->head.category_id else '[]'::jsonb end) entry
     ) parsed) as signature
  from public.completed_source_publication_captures captures
  join public.source_publications p on p.id = captures.publication_id
  where head.published_at is null
    and head.source_id in ('next-best-picture','midnight-critics')
    and p.source_id = head.source_id and p.canonical_url = head.publication_url
    and (captures.captured_at, captures.id) <= (head.captured_at, head.capture_id)
), transitions as (
  select *, case when signature = lag(signature) over (
    partition by source_id, canonical_url, category_id order by captured_at, id
  ) then 0 else 1 end as changed from signatures
), grouped as (
  select *, sum(changed) over (partition by source_id, canonical_url, category_id order by captured_at, id) as revision
  from transitions
), freshness as (
  select id, category_id, min(captured_at) over (partition by source_id, canonical_url, category_id, revision) as freshness_at
  from grouped
)
  select freshness_at from freshness
  where id = head.capture_id and category_id = head.category_id
  offset 0
) undated on head.published_at is null
  and head.source_id in ('next-best-picture','midnight-critics');

create or replace view public.public_prediction_source_evidence
with (security_barrier = true) as
-- Correlate before materializing: a source detail never builds other sources'
-- heads, and every candidate reuses its head's already computed freshness.
select evidence.id, approved_source.id as source_id, evidence.source_name,
  evidence.season_id, evidence.category_id, evidence.prediction_intention,
  evidence.category_candidate_id, evidence.original_subject, evidence.original_value,
  evidence.data_type, evidence.participates, evidence.published_at, evidence.captured_at,
  evidence.extractor_version, evidence.publication_external_id, evidence.publication_title,
  evidence.publication_url, evidence.author, evidence.candidate_label,
  evidence.original_count, evidence.freshness_at
from public.sources approved_source
cross join lateral (
  with revisions as (
    -- A legacy receipt may inherit different publication dates per member.
    -- Resolve its representative once, as status does; otherwise row_number's
    -- same-capture tie can select a different URL after a query-plan change.
    select o.source_id, o.season_id, o.category_id, o.prediction_intention,
      o.publication_id, o.capture_id, max(o.published_at) as published_at,
      o.captured_at, p.canonical_url
    from public.completed_professional_observations o
    join public.categories visible_category on visible_category.id = o.category_id and visible_category.is_public
    join public.source_publications p on p.id = o.publication_id
    join public.sources s on s.id = o.source_id and s.publication_status = 'publishable'
    where o.source_id = approved_source.id and o.state = 'published' and o.data_type in ('prediction_ordered','prediction_selection')
    group by o.source_id, o.season_id, o.category_id, o.prediction_intention,
      o.publication_id, o.capture_id, o.captured_at, p.canonical_url
  ), url_revisions as (
    select *, row_number() over (partition by source_id, season_id, category_id,
      prediction_intention, canonical_url order by captured_at desc, capture_id desc) as url_revision
    from revisions
  ), latest as (
    select *, row_number() over (partition by source_id, season_id, category_id, prediction_intention
      order by published_at desc nulls last, captured_at desc, publication_id desc) as source_revision
    from url_revisions where url_revision = 1
  ), heads_with_freshness as materialized (
    select r.*, undated.freshness_at from latest r
  left join lateral (
    with signatures as materialized (
    select captures.id, history_publication.source_id, history_publication.canonical_url, captures.captured_at, r.category_id,
      (select case when count(*) > 0 and bool_and(coalesce(valid, false))
          and count(distinct subject) = count(*)
          and (count(rank_value) = 0 or (count(rank_value) = count(*)
            and min(rank_value) = 1 and max(rank_value) = count(*)
            and count(distinct rank_value) = count(*)))
        then jsonb_agg(jsonb_build_object('rank', rank_value, 'subject', subject)
          order by coalesce(rank_value, 0), subject) end
       from (
         select normalize(regexp_replace(trim(case when r.category_id in ('original-screenplay','adapted-screenplay')
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
             and (r.category_id not in ('directing','actor','actress','supporting-actor','supporting-actress')
               or (jsonb_typeof(entry->'parts'->'peopleSubjects') = 'array'
                 and jsonb_array_length(case when jsonb_typeof(entry->'parts'->'peopleSubjects') = 'array'
                   then entry->'parts'->'peopleSubjects' else '[]'::jsonb end) > 0
                 and not exists (select 1 from jsonb_array_elements(case
                   when jsonb_typeof(entry->'parts'->'peopleSubjects') = 'array' then entry->'parts'->'peopleSubjects'
                   else '[]'::jsonb end) person
                   where jsonb_typeof(person) <> 'string' or nullif(trim(person #>> '{}'), '') is null)))
             and (captures.original_data->>'source_id' is null or captures.original_data->>'source_id' = history_publication.source_id)
             and coalesce(captures.original_data->>'publication_date','') = '' as valid
         from jsonb_array_elements(case when jsonb_typeof(captures.original_data->'categories'->r.category_id) = 'array'
           then captures.original_data->'categories'->r.category_id else '[]'::jsonb end) entry
       ) parsed) as signature
    from public.completed_source_publication_captures captures
    join public.source_publications history_publication on history_publication.id = captures.publication_id
    where r.source_id in ('next-best-picture','midnight-critics')
      and (r.published_at is null or exists (
        select 1 from public.completed_professional_observations undated_observation
        where undated_observation.capture_id = r.capture_id
          and undated_observation.source_id = r.source_id
          and undated_observation.publication_id = r.publication_id
          and undated_observation.season_id = r.season_id
          and undated_observation.category_id = r.category_id
          and undated_observation.prediction_intention = r.prediction_intention
          and undated_observation.state = 'published'
          and undated_observation.data_type in ('prediction_ordered','prediction_selection')
          and undated_observation.published_at is null
      ))
      and history_publication.source_id = r.source_id and history_publication.canonical_url = r.canonical_url
      and (captures.captured_at, captures.id) <= (r.captured_at, r.capture_id)
  ), transitions as (
    select *, case when signature = lag(signature) over (
      partition by source_id, canonical_url, category_id order by captured_at, id
    ) then 0 else 1 end as changed from signatures
  ), grouped as (
    select *, sum(changed) over (partition by source_id, canonical_url, category_id order by captured_at, id) as revision
    from transitions
  ), freshness as (
    select id, category_id, min(captured_at) over (partition by source_id, canonical_url, category_id, revision) as freshness_at
    from grouped
  )
    select freshness_at from freshness
    where id = r.capture_id and category_id = r.category_id
    offset 0
  ) undated on r.source_id in ('next-best-picture','midnight-critics')
    where r.source_revision = 1
  )
  select o.id, o.source_id, s.name as source_name, o.season_id, o.category_id,
    o.prediction_intention, o.category_candidate_id, o.original_subject,
    o.original_value, o.data_type, o.participates, o.published_at, o.captured_at,
    o.extractor_version, p.external_id as publication_external_id,
    p.title as publication_title, p.canonical_url as publication_url, o.author,
    candidate.display_label as candidate_label,
    case when jsonb_typeof(capture.original_data->'categories'->o.category_id) = 'array'
      then jsonb_array_length(capture.original_data->'categories'->o.category_id) end as original_count,
    coalesce(o.published_at, r.freshness_at, o.captured_at) as freshness_at
  from heads_with_freshness r
  join public.completed_professional_observations o on o.capture_id = r.capture_id
    and o.source_id = r.source_id and o.publication_id = r.publication_id
    and o.category_id = r.category_id and o.season_id = r.season_id
    and o.prediction_intention = r.prediction_intention and o.state = 'published'
    and o.data_type in ('prediction_ordered','prediction_selection')
  join public.sources s on s.id = o.source_id and s.publication_status = 'publishable'
  join public.source_publications p on p.id = o.publication_id
  join public.completed_source_publication_captures capture on capture.id = o.capture_id
  left join public.category_candidates candidate on candidate.id = o.category_candidate_id
) evidence
where approved_source.publication_status = 'publishable';
