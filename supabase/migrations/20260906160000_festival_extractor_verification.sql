-- A successful HTTP response without recognized entries is no longer a
-- successful verification. Version the parser contract so today's old empty
-- runs do not prevent a verified retry; locked festival sets remain immutable.
update public.festival_connectors
set extractor_version = festival_id || '-official-v2', updated_at = now()
where extractor_version <> festival_id || '-official-v2';
