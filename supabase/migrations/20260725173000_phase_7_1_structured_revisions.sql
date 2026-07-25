update public.source_connectors
set
  extractor_version = 'awards-radar-v3',
  updated_at = now()
where id = 'awards-radar-predictions';

comment on column public.source_publications.external_id is
  'Identidad externa; las páginas vivas añaden una revisión derivada del contenido estructurado y la versión del extractor.';
