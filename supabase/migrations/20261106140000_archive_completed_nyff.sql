-- D-070 kept NYFF active only while the 2026 edition was ongoing. The edition
-- ended on 12 October; preserve the reviewed 34-film Main Slate and all logs.
update public.festival_editions
set status = 'completed',
    last_verified_at = '2026-11-06T14:06:10Z',
    updated_at = now()
where id = 'nyff-2026'
  and ends_on = date '2026-10-12';

update public.festival_connectors as connector
set is_active = false,
    configuration = connector.configuration || jsonb_build_object(
      'manual_archive_kinds', '["selection"]'::jsonb,
      'archived_at', coalesce(connector.configuration -> 'archived_at', to_jsonb(now())),
      'archive_reason', 'Edición NYFF 2026 finalizada el 12 de octubre. Se conserva el Main Slate revisado de 34 largometrajes; Spotlight y Currents siguen pendientes. Correcciones mediante manifiestos versionados.'
    ),
    updated_at = now()
where connector.id = 'festival-nyff'
  and connector.configuration ->> 'edition_id' = 'nyff-2026';

update public.sources
set technical_status = 'manual',
    notes = 'Archivo oficial NYFF 2026 revisado: 34 largometrajes de Main Slate. Spotlight y Currents pendientes; correcciones mediante manifiestos versionados.'
where id = 'nyff';
