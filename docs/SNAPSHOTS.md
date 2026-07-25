# Snapshots y evaluación · fase 7

**Estado:** completada
**Fecha de cierre:** 2026-07-25

## Objetivo

Conservar el estado exacto de una predicción en un instante y compararlo después
con resultados oficiales sin recalcular el pasado. La fase añade persistencia,
automatización y evaluación, pero no inventa nominaciones ni ganadores para la
temporada activa.

## Contrato persistido

| Entidad | Responsabilidad |
|---|---|
| `snapshot_schedules` | Alcances periódicos activos, frecuencia y zona horaria |
| `aggregate_snapshots` | Envolvente bloqueada, agregado completo, hash, método y autor del bloqueo |
| `snapshot_observations` | Evidencia incluida o excluida en el instante |
| `current_aggregate_snapshots` | Puntero publicable a la versión vigente |
| `official_result_sets` | Captura versionada de nominaciones o ganadores oficiales |
| `official_result_entries` | Candidaturas oficiales por categoría |
| `current_official_result_sets` | Versión oficial vigente sin reescribir anteriores |

`aggregate_snapshots` y sus relaciones de evidencia tienen triggers que
rechazan `UPDATE` y `DELETE`. Lo mismo ocurre con los resultados oficiales. Un
error se corrige creando otra fila con el ID original y un motivo; solo cambia
el puntero de publicación.

La función transaccional `lock_aggregate_snapshot` comprueba que toda observación
incluida exista, esté publicada, participe y proceda de una fuente marcada
`publishable`. Repetir el mismo ID y hash devuelve `false` sin duplicar. La
función `lock_official_result_set` aplica el mismo patrón a una fuente oficial
publicable.

## Envolvente reproducible

`runscars-snapshot-v1` conserva:

- tipo periódico, cierre de nominaciones o cierre de ganador;
- temporada, categoría, intención, corte y zona horaria;
- salida completa de `runscars-aggregation-v1`;
- fuentes activas y observaciones incluidas o excluidas;
- selección final cuando corresponde;
- SHA-256 del JSON canónico;
- instante, persona o proceso que bloqueó;
- enlace y motivo de corrección cuando existe.

El hash cubre el contenido metodológico. El ID, el proceso de bloqueo y la
cadena de corrección permanecen como metadatos persistidos fuera de ese hash.

Un snapshot periódico conserva todo el ranking, pero no fija una papeleta
final. El cierre de nominaciones registra explícitamente cuántos candidatos
selecciona y sus IDs; el cierre de ganador fija la primera posición.

## Automatización semanal

Vercel Cron llama cada lunes a las **04:47 UTC** a
`/api/cron/snapshots`. El endpoint exige `CRON_SECRET`, carga las
programaciones activas y procesa cada alcance de forma aislada. Un fallo no
impide intentar el siguiente.

La primera programación cubre Oscar 2027, Mejor película y predicción de
nominaciones. Si no existen observaciones de fuentes aprobadas para publicación,
el proceso devuelve `skipped` y no fabrica un snapshot vacío. La configuración
de Vercel usa un `GET` autenticado mediante `Authorization: Bearer`, según la
[documentación oficial de Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Resultados oficiales

El importador manual versionado se ejecuta con:

```bash
npm run results:import -- <manifiesto.json>
```

El manifiesto conserva fuente, URL, autor cuando exista, publicación, captura,
valor original y candidaturas. Solo una fuente de tipo `official` y estado
`publishable` puede bloquearse. El fixture de pruebas declara de forma explícita
que es un ejemplo reproducible y no un resultado real.

Los Oscar 2027 todavía no tienen resultados oficiales. La interfaz muestra
“pendiente” y no evalúa el snapshot periódico como si fuera un cierre final.

## Evaluación

`runscars-evaluation-v1` implementa las reglas de
[METHODOLOGY.md](METHODOLOGY.md):

- nominaciones: aciertos, falsos positivos, omitidos, precisión y cobertura;
- ganador: acierto en primera posición, posición exacta y presencia;
- global: suma de numeradores y denominadores por categoría, no media simple de
  porcentajes.

El ejemplo manual de nominaciones usa diez predicciones y diez nominados:
ocho aciertos, dos falsos positivos y dos omitidos producen precisión `8/10 =
0,8` y cobertura `8/10 = 0,8`. El ejemplo de ganador coloca al resultado
oficial en tercera posición y comprueba `no`, posición `3` y presencia `sí`.

## Seguridad

- Los roles públicos solo leen snapshots, resultados y punteros.
- Las programaciones y las dos funciones de escritura quedan reservadas a
  `service_role`.
- Las funciones usan `security definer`, `search_path = ''`, nombres de tabla
  cualificados y permisos de ejecución revocados a `public`, `anon` y
  `authenticated`, siguiendo las
  [recomendaciones de Supabase](https://supabase.com/docs/guides/database/functions).
- El cron y el importador usan secretos de servidor; no aparecen en cliente,
  logs ni Git.

## Verificación de la puerta

Las pruebas de PostgreSQL:

1. bloquean un snapshot con evidencia persistida;
2. importan otra observación después;
3. verifican que payload y enlaces originales son idénticos;
4. rechazan mutaciones y borrados;
5. repiten el bloqueo sin duplicar;
6. crean una corrección enlazada y conservan ambas versiones;
7. registran resultados oficiales trazables y niegan la escritura pública.

Vitest comprueba hash canónico, reglas de cierres, manifiesto oficial y los dos
ejemplos manuales de evaluación. Playwright verifica la distinción visible
entre corte recalculable, snapshot inmutable y resultados pendientes.

Con estas comprobaciones, un snapshot bloqueado permanece idéntico tras nuevas
importaciones y las métricas coinciden con ejemplos manuales: la puerta de salida
de la fase 7 queda cumplida.
