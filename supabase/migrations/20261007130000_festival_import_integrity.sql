-- D070: keep factual identity separate from mutable catalogue matching.
-- A newly hashed historical receipt stays immutable but cannot replace a more
-- recent current capture. The edition lock also serializes pointer decisions.
create or replace function public.persist_festival_set(
  payload jsonb,
  matching_actor text default 'automatic-exact-title'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  edition_id_value text := payload ->> 'editionId';
  kind_value public.festival_set_kind := (payload ->> 'kind')::public.festival_set_kind;
  hash_value text := payload ->> 'contentHash';
  set_id_value text;
  version_value integer;
  entry_value jsonb;
  entry_id_value bigint;
  history_id_value bigint;
begin
  if coalesce(nullif(trim(matching_actor), ''), '') = '' then
    raise exception 'matching_actor es obligatorio';
  end if;

  perform 1
  from public.festival_editions
  where id = edition_id_value
  for update;
  if not found then
    raise exception 'Edición festivalera desconocida: %', edition_id_value;
  end if;

  -- El bloqueo por edición serializa imports concurrentes. La comprobación de
  -- hash debe ocurrir después para que dos procesos idénticos sean idempotentes.
  select id, version into set_id_value, version_value
  from public.festival_sets
  where edition_id = edition_id_value
    and kind = kind_value
    and content_hash = hash_value;

  if set_id_value is not null then
    return jsonb_build_object(
      'status', 'duplicate',
      'setId', set_id_value,
      'version', version_value,
      'entriesInserted', 0
    );
  end if;

  select coalesce(max(version), 0) + 1 into version_value
  from public.festival_sets
  where edition_id = edition_id_value and kind = kind_value;

  set_id_value := edition_id_value || '-' || kind_value::text || '-' || left(hash_value, 12);
  insert into public.festival_sets (
    id,
    edition_id,
    kind,
    version,
    content_hash,
    source_url,
    source_title,
    published_at,
    captured_at,
    raw_capture,
    extractor_version,
    corrects_set_id,
    correction_reason
  ) values (
    set_id_value,
    edition_id_value,
    kind_value,
    version_value,
    hash_value,
    payload #>> '{source,url}',
    payload #>> '{source,title}',
    nullif(payload #>> '{source,publishedAt}', '')::timestamptz,
    (payload ->> 'capturedAt')::timestamptz,
    payload -> 'rawCapture',
    payload ->> 'extractorVersion',
    nullif(payload ->> 'correctsSetId', ''),
    nullif(payload ->> 'correctionReason', '')
  );

  for entry_value in
    select value
    from jsonb_array_elements(payload -> 'entries')
    order by (value ->> 'entryOrder')::integer
  loop
    insert into public.festival_entries (
      set_id,
      entry_order,
      section,
      original_title,
      original_recipient,
      award_type,
      is_feature,
      film_id,
      match_status,
      original_data
    ) values (
      set_id_value,
      (entry_value ->> 'entryOrder')::smallint,
      entry_value ->> 'section',
      entry_value ->> 'originalTitle',
      nullif(entry_value ->> 'originalRecipient', ''),
      nullif(entry_value ->> 'awardType', ''),
      coalesce((entry_value ->> 'isFeature')::boolean, true),
      nullif(entry_value ->> 'filmId', ''),
      (entry_value ->> 'status')::public.festival_match_status,
      entry_value -> 'originalData'
    ) returning id into entry_id_value;

    insert into public.festival_entry_match_history (
      entry_id,
      normalized_title,
      status,
      film_id,
      candidate_film_ids,
      reason,
      actor
    ) values (
      entry_id_value,
      entry_value ->> 'normalizedTitle',
      (entry_value ->> 'status')::public.festival_match_status,
      nullif(entry_value ->> 'filmId', ''),
      coalesce(
        array(select jsonb_array_elements_text(entry_value -> 'candidateFilmIds')),
        '{}'
      ),
      entry_value ->> 'reason',
      matching_actor
    ) returning id into history_id_value;

    insert into public.current_festival_entry_matches (
      entry_id,
      match_history_id
    ) values (entry_id_value, history_id_value);
  end loop;

  insert into public.current_festival_sets (edition_id, kind, set_id)
  values (edition_id_value, kind_value, set_id_value)
  on conflict (edition_id, kind) do update set
    set_id = excluded.set_id,
    updated_at = now()
  where (
    select previous.captured_at
    from public.festival_sets as previous
    where previous.id = public.current_festival_sets.set_id
  ) < (payload ->> 'capturedAt')::timestamptz;

  return jsonb_build_object(
    'status', 'inserted',
    'setId', set_id_value,
    'version', version_value,
    'entriesInserted', jsonb_array_length(payload -> 'entries'),
    'isCurrent', exists (
      select 1 from public.current_festival_sets
      where edition_id = edition_id_value and kind = kind_value
        and set_id = set_id_value
    )
  );
end;
$$;

revoke all on function public.persist_festival_set(jsonb, text) from public;
grant execute on function public.persist_festival_set(jsonb, text) to service_role;
