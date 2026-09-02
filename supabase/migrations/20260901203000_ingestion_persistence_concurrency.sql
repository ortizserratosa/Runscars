-- Evita que las fuentes con cientos de observaciones agoten el tiempo de la
-- Edge Function por persistir cada fila de forma estrictamente secuencial.

update public.source_connectors
set configuration = configuration || jsonb_build_object(
  'persistence_concurrency', 6
)
where id in (
  'awardswatch-predictions',
  'guardian-content-api',
  'awards-daily-predictions',
  'ringer-best-picture',
  'next-best-picture-predictions',
  'awards-radar-predictions',
  'roger-ebert-rss',
  'midnight-critics-predictions'
);
