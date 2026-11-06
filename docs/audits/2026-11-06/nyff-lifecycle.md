# Cierre operativo de NYFF 2026

Comprobación de solo lectura el 6 de noviembre de 2026. El festival terminó el
12 de octubre, según
[Film at Lincoln Center](https://www.filmlinc.org/now-playing/?tab=schedule). Su
[página actual](https://www.filmlinc.org/nyff/) ya promociona proyecciones
posteriores y el acceso HTTPS ordinario al lineup puede devolver protección 403.

D-070 mantuvo NYFF activo mientras continuaba la edición. En producción seguían
`status=ongoing`, `is_active=true` y `manual_archive_kinds=[]`; el último éxito
automático era del 6 de septiembre y los intentos recientes fallaban con cero
largometrajes frente al mínimo revisado de 34. El conjunto vigente
`nyff-2026-selection-a78028ab5b1e`, versión 1, conservaba sus 34 entradas; el
control de mínimos había protegido esos datos.

La migración `20261106140000_archive_completed_nyff.sql` completa ese cierre:
edición finalizada, conector inactivo y selección archivada para correcciones
manuales versionadas. `archived_at` registra el momento real de aplicación y no
cambia al repetir la migración. La revisión del programa permanece en
`archive_reviewed_at=2026-10-07T08:32:29Z`; la verificación del cierre se fecha
separadamente. No se cambian conjuntos, entradas, punteros, hashes, éxitos,
fallos ni errores automáticos, y no se añade palmarés a un festival no
competitivo.

El archivo sigue limitado a Main Slate: Spotlight y Currents permanecen
pendientes. Archivar no acredita exhaustividad ni inventa un éxito de Cron.

Verificación reproducible: prueba PostgreSQL del ciclo de cierre, conservación
de datos y fechas, repetición idempotente y lectura pública del estado
archivado.
