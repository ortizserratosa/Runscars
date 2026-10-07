-- D-072: corroborated TMDB identity drives festival metadata; IMDb is optional.
alter table public.festival_entry_external_link_history drop constraint festival_external_identity_shape;
alter table public.festival_entry_external_link_history add constraint festival_external_identity_shape check (
  (status = 'confirmed' and tmdb_id is not null and tmdb_id > 0 and (imdb_id is null or imdb_id ~ '^tt[0-9]{7,10}$'))
  or (status <> 'confirmed' and tmdb_id is null and imdb_id is null)
);

-- Keep the original capture while renewing an identical cache response per locale.
alter table public.tmdb_movie_snapshots add column last_verified_at timestamptz;
update public.tmdb_movie_snapshots set last_verified_at = fetched_at;
alter table public.tmdb_movie_snapshots alter column last_verified_at set not null;
create function public.initialize_tmdb_movie_verification() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.last_verified_at is null then new.last_verified_at := new.fetched_at; end if;
  return new;
end $$;
create trigger tmdb_movie_snapshots_initialize_verification before insert on public.tmdb_movie_snapshots
for each row execute function public.initialize_tmdb_movie_verification();
alter table public.tmdb_movie_snapshots drop constraint tmdb_movie_snapshots_cache_window;
alter table public.tmdb_movie_snapshots add constraint tmdb_movie_snapshots_cache_window check (
  last_verified_at >= fetched_at and expires_at > last_verified_at and expires_at <= last_verified_at + interval '6 months'
);
create index tmdb_movie_snapshots_verified_idx on public.tmdb_movie_snapshots(tmdb_id,locale,last_verified_at desc,id desc);

create function public.persist_festival_tmdb_metadata(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  capture jsonb := payload->'snapshot';
  target_id bigint := (capture->>'tmdb_id')::bigint;
  verified_at timestamptz := (capture->>'fetched_at')::timestamptz;
  existing_id bigint;
  previous_verification timestamptz;
  snapshot_id bigint;
  existing_original_data jsonb;
begin
  if not exists (select 1 from public.public_festival_external_links where tmdb_id = target_id) then
    raise exception 'TMDB ID lacks a current corroborated festival identity';
  end if;
  if (capture->'original_data'->>'id')::bigint is distinct from target_id
    or (payload->'identity'->>'tmdb_id')::bigint is distinct from target_id
    or capture->>'source_url' is distinct from 'https://api.themoviedb.org/3/movie/' || target_id::text
    or capture->>'locale' not in ('es-ES','en-US') then
    raise exception 'TMDB metadata provenance or locale does not match the corroborated identity';
  end if;
  insert into public.tmdb_movies as identity(tmdb_id,last_checked_at) values(target_id,verified_at)
  on conflict(tmdb_id) do update set last_checked_at = greatest(identity.last_checked_at,excluded.last_checked_at);
  select id,last_verified_at,original_data into existing_id,previous_verification,existing_original_data from public.tmdb_movie_snapshots
  where tmdb_id=target_id and locale=capture->>'locale' and content_hash=capture->>'content_hash' for update;
  if existing_id is not null and existing_original_data is distinct from capture->'original_data' then
    raise exception 'TMDB metadata hash conflicts with different original data';
  end if;
  insert into public.tmdb_movie_snapshots as cached(tmdb_id,locale,content_hash,title,original_title,original_language,overview,release_date,runtime,status,tagline,imdb_id,poster_path,backdrop_path,genres,original_data,source_url,fetched_at,last_verified_at,expires_at)
  values(target_id,capture->>'locale',capture->>'content_hash',capture->>'title',capture->>'original_title',capture->>'original_language',capture->>'overview',(capture->>'release_date')::date,(capture->>'runtime')::smallint,capture->>'status',capture->>'tagline',capture->>'imdb_id',capture->>'poster_path',capture->>'backdrop_path',capture->'genres',capture->'original_data',capture->>'source_url',verified_at,verified_at,(capture->>'expires_at')::timestamptz)
  on conflict(tmdb_id,locale,content_hash) do update set last_verified_at = excluded.last_verified_at, expires_at = excluded.expires_at
    where excluded.last_verified_at > cached.last_verified_at
  returning id into snapshot_id;
  return jsonb_build_object('status',case when existing_id is null then 'inserted' when verified_at>previous_verification then 'refreshed' else 'duplicate' end,'snapshotId',coalesce(snapshot_id,existing_id),'tmdbId',target_id,'locale',capture->>'locale');
end $$;
revoke all on function public.persist_festival_tmdb_metadata(jsonb) from public,anon,authenticated;
grant execute on function public.persist_festival_tmdb_metadata(jsonb) to service_role;
comment on column public.tmdb_movie_snapshots.last_verified_at is 'Actual verification of this payload and locale; fetched_at retains the first capture. Latest metadata is ordered by verification time.';

-- Preserve an invalid provider IMDb value while keeping the normalized public ID null.
create or replace function public.persist_festival_external_link(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_entry bigint := (payload->>'entryId')::bigint;
  existing_id bigint;
  link_id bigint;
  target_status text := payload->>'status';
  target_captured_at timestamptz := (payload->>'capturedAt')::timestamptz;
begin
  -- Serialize history/pointer decisions for an entry and ensure the immutable receipt exists.
  perform 1 from public.festival_entries where id = target_entry and is_feature for update;
  if not found then raise exception 'Entrada festivalera ausente o no cinematográfica'; end if;
  if payload->>'originalSourceUrl' is distinct from (
    select s.source_url from public.festival_entries e join public.festival_sets s on s.id = e.set_id where e.id = target_entry
  ) then raise exception 'La procedencia original no corresponde al recibo'; end if;
  if target_status = 'confirmed' then
    if coalesce(jsonb_array_length(payload->'evidence'->'claim'->'directors'), 0) = 0
      or nullif(payload->'evidence'->>'matchedTitle', '') is null
      or jsonb_array_length(coalesce(payload->'evidence'->'matchedDirectors', '[]'::jsonb)) = 0
      or (payload->>'imdbId' is not null and payload->'originalData'->>'imdb_id' is distinct from payload->>'imdbId')
      or (payload->'originalData'->>'id')::bigint is distinct from (payload->>'tmdbId')::bigint
      then raise exception 'Falta evidencia corroborada de identidad'; end if;
  end if;
  select id into existing_id from public.festival_entry_external_link_history where entry_id = target_entry and content_hash = payload->>'contentHash';
  if existing_id is not null then return jsonb_build_object('status', 'duplicate', 'historyId', existing_id); end if;
  insert into public.festival_entry_external_link_history(entry_id,status,tmdb_id,imdb_id,source_url,original_source_url,captured_at,method,content_hash,evidence,original_data)
  values(target_entry,target_status,(payload->>'tmdbId')::bigint,payload->>'imdbId',payload->>'sourceUrl',payload->>'originalSourceUrl',target_captured_at,payload->>'method',payload->>'contentHash',payload->'evidence',payload->'originalData') returning id into link_id;
  if target_status = 'confirmed' then
    insert into public.current_festival_entry_external_links as current_link(entry_id,history_id) values(target_entry,link_id)
    on conflict(entry_id) do update set history_id = excluded.history_id, updated_at = now()
    where target_captured_at >= (select h.captured_at from public.festival_entry_external_link_history h where h.id = current_link.history_id);
  end if;
  return jsonb_build_object('status', 'inserted', 'historyId', link_id, 'linkStatus', target_status);
end $$;
