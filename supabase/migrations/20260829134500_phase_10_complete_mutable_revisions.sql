-- Evita mezclar observaciones entre revisiones de una página mutable.

update public.source_connectors
set
  extractor_version = 'awards-daily-v5',
  updated_at = now()
where id = 'awards-daily-predictions';
