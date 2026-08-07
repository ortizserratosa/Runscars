update public.source_connectors
set
  extractor_version = 'awardswatch-multicategory-v4',
  updated_at = now()
where id = 'awardswatch-predictions';

comment on column public.source_publications.external_id is
  'Identidad externa; toda fuente reconsultada añade una revisión derivada del contenido estructurado y la versión del extractor para no mezclar extracciones.';
