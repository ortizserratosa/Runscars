-- D-071: identidad externa de películas festivaleras, independiente del catálogo Oscar.
create table public.festival_entry_external_link_history (
  id bigint generated always as identity primary key,
  entry_id bigint not null references public.festival_entries(id) on delete restrict,
  status text not null check (status in ('confirmed', 'pending_review', 'unmatched')),
  tmdb_id bigint,
  imdb_id text,
  source_url text not null check (source_url ~ '^https://'),
  original_source_url text not null check (original_source_url ~ '^https://'),
  captured_at timestamptz not null,
  method text not null check (nullif(trim(method), '') is not null),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  original_data jsonb not null check (jsonb_typeof(original_data) = 'object'),
  created_at timestamptz not null default now(),
  constraint festival_external_identity_shape check (
    (status = 'confirmed' and tmdb_id is not null and imdb_id is not null and tmdb_id > 0 and imdb_id ~ '^tt[0-9]{7,10}$')
    or (status <> 'confirmed' and tmdb_id is null and imdb_id is null)
  ),
  unique (entry_id, content_hash),
  unique (entry_id, id)
);

create table public.current_festival_entry_external_links (
  entry_id bigint primary key references public.festival_entries(id) on delete restrict,
  history_id bigint not null unique,
  updated_at timestamptz not null default now(),
  foreign key (entry_id, history_id) references public.festival_entry_external_link_history(entry_id, id) on delete restrict
);

create trigger festival_external_history_immutable
before update or delete on public.festival_entry_external_link_history
for each row execute function public.prevent_locked_record_mutation();

alter table public.festival_entry_external_link_history enable row level security;
alter table public.current_festival_entry_external_links enable row level security;
create policy festival_external_history_service on public.festival_entry_external_link_history for all to service_role using (true) with check (true);
create policy festival_external_current_service on public.current_festival_entry_external_links for all to service_role using (true) with check (true);
revoke all on public.festival_entry_external_link_history, public.current_festival_entry_external_links from public, anon, authenticated;
grant select, insert on public.festival_entry_external_link_history to service_role;
grant select, insert, update on public.current_festival_entry_external_links to service_role;
grant usage, select on sequence public.festival_entry_external_link_history_id_seq to service_role;

-- Deliberately expose only a confirmed current link, not private review/provider metadata.
create view public.public_festival_external_links with (security_barrier = true) as
select h.entry_id, h.tmdb_id, h.imdb_id, h.captured_at, h.source_url
from public.current_festival_entry_external_links c
join public.festival_entry_external_link_history h on h.id = c.history_id and h.entry_id = c.entry_id
join public.festival_entries e on e.id = h.entry_id
join public.current_festival_sets s on s.set_id = e.set_id
join public.festival_sets fs on fs.id = e.set_id
join public.festival_editions ed on ed.id = fs.edition_id
join public.festivals f on f.id = ed.festival_id
join public.sources src on src.id = f.id
where h.status = 'confirmed' and e.is_feature and src.publication_status = 'publishable';
revoke all on public.public_festival_external_links from public, anon, authenticated;
grant select on public.public_festival_external_links to anon, authenticated, service_role;

create function public.persist_festival_external_link(payload jsonb)
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
      or payload->'originalData'->>'imdb_id' is distinct from payload->>'imdbId'
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
revoke all on function public.persist_festival_external_link(jsonb) from public, anon, authenticated;
grant execute on function public.persist_festival_external_link(jsonb) to service_role;
