# Snapshots y evaluación · fase 7

**Estado:** fase 7 completada; ampliación v2 integrada en staging
**Última revisión:** 2026-08-10

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

`runscars-snapshot-v2` mantiene la misma envolvente, pero usa
`runscars-aggregation-v2` y candidaturas genéricas con `candidateId`, película,
obra y personas. La migración no modifica ninguna envolvente v1: su contenido y
hash siguen siendo reproducibles byte a byte.

Un snapshot periódico conserva todo el ranking, pero no fija una papeleta
final. El cierre de nominaciones registra explícitamente cuántos candidatos
selecciona y sus IDs; el cierre de ganador fija la primera posición.

## Automatización por cambios reales

Vercel Cron llama cada día a las **04:47 UTC**, después de la ingesta
profesional de las 04:17 UTC, a
`/api/cron/snapshots`. El endpoint exige `CRON_SECRET`, carga las
programaciones activas y procesa cada alcance de forma aislada. Un fallo no
impide intentar el siguiente.

Antes de bloquear una envolvente, el proceso compara por proveedor las
candidaturas efectivas, el tipo de aparición y las posiciones y longitudes de
lista contra el puntero vigente. Si ninguna fuente cambia, devuelve `unchanged`
y no crea un snapshot. Los cambios de captura o metadatos sin efecto en las
listas tampoco crean un corte.

La web conserva todos los snapshots inmutables. Para navegación toma primero la
última envolvente de cada fecha UTC y presenta después únicamente los estados
diarios consecutivos distintos. El visitante puede seleccionar un corte real y
la variación se calcula contra el corte real anterior, aunque entre ambos
existan ejecuciones históricas redundantes o varios reintentos el mismo día.

Las ocho programaciones cubren Oscar 2027 y predicción de nominaciones. Si no
existen observaciones de fuentes aprobadas para publicación,
el proceso devuelve `skipped` y no fabrica un snapshot vacío. La configuración
de Vercel usa un `GET` autenticado mediante `Authorization: Bearer`, según la
[documentación oficial de Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

El 2026-07-25 staging bloqueó los ocho snapshots v2 con datos reales. Una
segunda ejecución con el mismo estado devolvió ocho `unchanged`. Las 16 páginas
de categoría —ocho activas y ocho de archivo— respondieron correctamente desde
Supabase en <https://runscars-staging.vercel.app>.

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

El archivo real de Oscar 2026 se importa mediante:

```bash
npm run results:archive
```

El manifiesto v2 conserva los 45 nominados y los ocho ganadores de las ocho
categorías públicas, con películas, intérpretes, guionistas y equipos. Genera
dos resultados oficiales append-only y no reconstruye predicciones históricas.

## Evaluación

`runscars-evaluation-v2` aplica las mismas reglas por `candidateId`. La v1
permanece disponible para reproducir sus cierres. Ambas implementan
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
