-- Public prediction facts only. Raw capture bodies, configuration, errors and
-- editorial notes remain private; an incident is independent from vote age.
create view public.public_prediction_connector_freshness
with (security_barrier = true) as
select c.source_id, category_id,
  max(c.last_success_at) as last_successful_check_at,
  max(c.last_failure_at) as last_failure_at,
  bool_or(c.last_failure_at is not null and
    (c.last_success_at is null or c.last_failure_at > c.last_success_at)) as has_current_failure
from public.source_connectors c
join public.sources s on s.id = c.source_id and s.publication_status = 'publishable'
cross join lateral jsonb_array_elements_text(
  coalesce(c.configuration->'required_category_ids', '[]'::jsonb)
) as categories(category_id)
where c.is_active
group by c.source_id, category_id;

create view public.public_prediction_source_evidence
with (security_barrier = true) as
with page_categories as (
  select distinct o.source_id, p.canonical_url, o.category_id
  from public.professional_observations o
  join public.source_publications p on p.id = o.publication_id
  join public.sources s on s.id = o.source_id and s.publication_status = 'publishable'
  where o.source_id in ('next-best-picture','midnight-critics') and o.state = 'published'
    and o.data_type in ('prediction_ordered','prediction_selection')
), signatures as (
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
  from public.source_publication_captures captures
  join public.source_publications p on p.id = captures.publication_id
  join page_categories category on category.source_id = p.source_id and category.canonical_url = p.canonical_url
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
), revisions as (
  select distinct o.source_id, o.season_id, o.category_id, o.prediction_intention,
    o.publication_id, o.capture_id, o.published_at, o.captured_at, p.canonical_url
  from public.professional_observations o
  join public.source_publications p on p.id = o.publication_id
  join public.sources s on s.id = o.source_id and s.publication_status = 'publishable'
  where o.state = 'published' and o.data_type in ('prediction_ordered','prediction_selection')
), url_revisions as (
  select *, row_number() over (partition by source_id, season_id, category_id,
    prediction_intention, canonical_url order by captured_at desc, capture_id desc) as url_revision
  from revisions
), latest as (
  select *, row_number() over (partition by source_id, season_id, category_id, prediction_intention
    order by coalesce(published_at,captured_at) desc, captured_at desc, publication_id desc) as source_revision
  from url_revisions where url_revision = 1
)
select o.id, o.source_id, s.name as source_name, o.season_id, o.category_id,
  o.prediction_intention, o.category_candidate_id, o.original_subject,
  o.original_value, o.data_type, o.participates, o.published_at, o.captured_at,
  o.extractor_version, p.external_id as publication_external_id,
  p.title as publication_title, p.canonical_url as publication_url, o.author,
  candidate.display_label as candidate_label,
  case when jsonb_typeof(capture.original_data->'categories'->o.category_id) = 'array'
    then jsonb_array_length(capture.original_data->'categories'->o.category_id) end as original_count,
  coalesce(o.published_at, f.freshness_at, o.captured_at) as freshness_at
from latest r
join public.professional_observations o on o.capture_id = r.capture_id
  and o.category_id = r.category_id and o.season_id = r.season_id
  and o.prediction_intention = r.prediction_intention and o.state = 'published'
  and o.data_type in ('prediction_ordered','prediction_selection')
join public.sources s on s.id = o.source_id and s.publication_status = 'publishable'
join public.source_publications p on p.id = o.publication_id
join public.source_publication_captures capture on capture.id = o.capture_id
left join public.category_candidates candidate on candidate.id = o.category_candidate_id
left join freshness f on f.id = o.capture_id and f.category_id = o.category_id
where r.source_revision = 1;

revoke all on public.public_prediction_connector_freshness, public.public_prediction_source_evidence from public;
grant select on public.public_prediction_connector_freshness, public.public_prediction_source_evidence to anon, authenticated, service_role;
comment on view public.public_prediction_source_evidence is
  'Latest published prediction facts, including expired lists and positions beyond the scoring horizon. Does not expose capture bodies, credentials or editorial notes.';

create view public.public_prediction_source_status
with (security_barrier = true) as
select source_id, source_name, season_id, category_id, prediction_intention,
  publication_external_id, publication_title, publication_url, author,
  published_at, max(captured_at) as captured_at, min(freshness_at) as freshness_at,
  count(*)::integer as matched_count,
  coalesce(max(case when jsonb_typeof(original_value->'list_length') = 'number'
    then (original_value->>'list_length')::integer end), max(original_count), count(*)::integer) as original_count,
  bool_or(data_type = 'prediction_ordered') as ordered
from public.public_prediction_source_evidence
 group by source_id, source_name, season_id, category_id, prediction_intention,
  publication_external_id, publication_title, publication_url, author, published_at;
revoke all on public.public_prediction_source_status from public;
grant select on public.public_prediction_source_status to anon, authenticated, service_role;
