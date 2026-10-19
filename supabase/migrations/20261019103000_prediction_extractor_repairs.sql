-- Semantic extractor revisions preserve all previous captures and their dates.
update public.source_connectors
set extractor_version = case
  when id = 'awardswatch-predictions' then 'awardswatch-multicategory-v8'
  else 'variety-datawrapper-v2'
end
where id = 'awardswatch-predictions'
   or (source_id = 'variety' and id like 'variety-%-predictions');
