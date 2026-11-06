-- Version source-format repairs without changing prior receipts or snapshots.
update public.source_connectors set extractor_version = 'awards-daily-v10'
where id = 'awards-daily-predictions';
update public.source_connectors set extractor_version = 'movie-state-v2'
where id = 'movie-state-predictions';
update public.source_connectors set extractor_version = 'variety-datawrapper-v3'
where id like 'variety-%-predictions';
