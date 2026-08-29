-- Corrige el anclaje del parser de Awards Daily sin alterar revisiones previas.

update public.source_connectors
set
  extractor_version = 'awards-daily-v4',
  updated_at = now()
where id = 'awards-daily-predictions';
