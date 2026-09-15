-- Reprocess Awards Daily with the verified Los Javis alias. Existing captures,
-- observations and locked snapshots remain immutable.
update public.source_connectors
set extractor_version = 'awards-daily-v7'
where id = 'awards-daily-predictions';
