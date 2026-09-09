-- Berlin special mentions inherit the feature/short scope of the preceding
-- award in their jury section. Reparse into a new immutable set version.
update public.festival_connectors
set extractor_version = 'berlinale-official-v3', updated_at = now()
where festival_id = 'berlinale' and extractor_version <> 'berlinale-official-v3';
