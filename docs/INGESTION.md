# Sistema de ingesta · fases 5 y 7.1

**Estado:** fase 5 completada; ampliación 7.1 completada
**Última revisión:** 2026-07-25

## Objetivo

Incorporar publicaciones y señales profesionales de forma idempotente,
trazable y aislada por fuente, sin normalizar ni agregar todavía sus valores.
La implementación sigue la separación definida en
[METHODOLOGY.md](METHODOLOGY.md): una reseña, una puntuación y una predicción
son observaciones distintas aunque procedan de la misma publicación.

## Contrato persistido

| Entidad | Responsabilidad |
|---|---|
| `source_connectors` | Configuración sin secretos, versión de extractor, activación y última salud |
| `ingestion_runs` | Un intento por conector, disparador, resultado y contadores |
| `ingestion_run_events` | Log privado y estructurado de cada intento |
| `source_publications` | Identidad canónica de la pieza externa |
| `source_publication_captures` | Campos originales necesarios, inmutables y deduplicados por hash |
| `professional_observations` | Valor y escala originales, procedencia, matching y participación |
| `ingestion_review_items` | Cola privada para identidades o valores dudosos |
| `category_candidates` | Identidad genérica de película u obra y personas |
| `category_candidate_people` | Colaboradores ordenados de la candidatura |

Una observación publicada puede recorrerse hasta `source_url`, publicación,
autor, fecha de publicación, captura y versión del extractor. No existe ningún
campo normalizado ni agregado en esta fase.

La deduplicación usa un SHA-256 estable de fuente, publicación canónica,
autoría, sujeto resuelto o rótulo original, tipo, categoría, intención y valor
original. Una nueva captura idéntica reutiliza su hash; una publicación que
cambia conserva una captura nueva. Las correcciones futuras deben crear una
observación enlazada mediante `corrects_observation_id`, no sobrescribir el
valor original.

## Matching y revisión

El matching automático solo acepta una coincidencia exacta, sin distinguir
mayúsculas ni diacríticos, contra título o título alternativo del catálogo de la
temporada. Cero o varias coincidencias dejan la observación en
`pending_review`, sin participación, y crean una entrada idempotente en la
cola. No se acepta automáticamente ninguna similitud difusa.

Los roles públicos solo leen publicaciones y observaciones `published` cuando
la fuente también tiene `publication_status = publishable`. Conectores,
capturas, runs, errores y cola editorial son privados para `service_role`; así
una fuente `review-before-publish` puede probarse en staging sin exponer sus
datos por accidente.

## Conectores del primer corte

| Conector | Entrada | Señal | Estado |
|---|---|---|---|
| Guardian Content API | JSON documentado | Reseña y estrella estructurada | Activo; clave alojada solo en secretos de servidor |
| RogerEbert.com | RSS oficial `/feed` | Reseña enlazada | Activo; solo acepta URLs bajo `/reviews/` |
| AwardsWatch Best Picture | HTML con tabla bajo `BEST PICTURE` | Predicción ordenada de nominaciones | Activo |
| Editorial manual | Manifiesto JSON v1 | Cualquiera de los tipos profesionales | Disponible por CLI, nunca programado |

Guardian requiere una clave en cada petición y permite pedir campos y etiquetas
concretos en `/search`; el adaptador solicita únicamente titular, autoría y
`starRating`. Antes de persistir, descarta publicaciones cuyo título no coincide
exactamente con una película o título alternativo de la temporada; esas piezas
no pertenecen al ámbito de Runscars y no deben llenar la cola editorial.
Referencia:
[Guardian Open Platform](https://open-platform.theguardian.com/documentation/).

RogerEbert se usa como feed de descubrimiento. No se infiere una nota desde
iconos ni desde el RSS. AwardsWatch guarda las filas originales de la tabla,
autor, fecha y URL, pero no el texto del artículo. La publicación usada en el
fixture reproduce la estructura comprobada en
[las predicciones de junio de 2026](https://awardswatch.com/2027-oscar-predictions-best-picture-and-best-director-june/).

## Importación manual

El formato reproducible se ejemplifica en
`web/tests/fixtures/ingestion/manual.json`. Requiere `formatVersion`,
`sourceId`, `seasonId`, publicaciones canónicas y observaciones con valor
original.

```bash
npm run ingest:manual -- web/tests/fixtures/ingestion/manual.json
```

El comando lee `web/.env.local` y necesita URL de Supabase y
`SUPABASE_SERVICE_ROLE_KEY`. Esta clave no se usa en cliente ni se registra.

## Ejecución diaria

`run-ingestion` es una Supabase Edge Function protegida por
`INGESTION_CRON_SECRET`. Cada día a las **04:17 UTC**, Supabase Cron la invoca;
la función lee solo conectores activos y ejecuta cada uno dentro de su propio
run. Un error se registra y el bucle continúa con la fuente siguiente.

La definición versionada está en
`supabase/schedules/run-ingestion-daily.sql`. El secreto existe tanto como
secreto de Edge Functions como en Vault, nunca en SQL o Git. Supabase recomienda
combinar Cron, `pg_net`, Vault y una llamada HTTP para programar funciones:
[guía oficial](https://supabase.com/docs/guides/functions/schedule-functions).

Comandos operativos de staging:

```bash
npx supabase functions deploy run-ingestion \
  --no-verify-jwt \
  --use-api \
  --import-map supabase/functions/deno.json
npx supabase db query --linked --file supabase/schedules/run-ingestion-daily.sql
```

`--no-verify-jwt` es intencionado: la función aplica su propio secreto de
alta entropía en `x-runscars-cron-secret`. Una llamada sin él recibe 401.

### Ampliación multcategoría

La tarea diaria ejecuta de forma aislada AwardsWatch, Awards Daily, Awards
Radar, Next Best Picture, Midnight Critics Circle y The Ringer. Los cinco
primeros medios aportan rankings cuando los publican; The Ringer aporta solo una
selección de Mejor película. Los extractores estructurados conservan también
categorías adicionales, cuya visibilidad pública se decide en `categories`.

Un título ausente se consulta en TMDB solo desde servidor. La importación
automática exige una coincidencia única exacta y compatible con la temporada;
después, las personas solo se buscan en sus créditos. Película, persona, equipo
o categoría se pueden corregir con:

```bash
npm run candidate:match -- <observation-id> <candidate-id> \
  --kind <film|person|team|category> --reason "<motivo>"
```

Los mercados se ejecutan cada hora mediante `run-markets`. Kalshi y Polymarket
se paginan, se filtran por Oscar y se guardan en tablas append-only. Un fallo de
un proveedor no bloquea al otro y ninguno escribe observaciones profesionales.

## Pruebas sin red

Los fixtures de `web/tests/fixtures/ingestion/` contienen solo la estructura y
campos mínimos necesarios:

- `guardian.json`;
- `roger-ebert.xml`;
- `awardswatch.html`;
- `manual.json`.
- fixtures HTML de las seis fuentes de predicción multcategoría;
- fixtures JSON de Kalshi y Polymarket.

Vitest no llama a ninguna fuente. Comprueba los tres parsers, el formato manual,
matching exacto y por título alternativo, cola de revisión, reimportación y
aislamiento de fallos. PGlite aplica la migración y el seed, verifica la
restricción única, la URL de procedencia y la privacidad de runs/logs/cola.

## Operación y riesgos

- Un cambio estructural de HTML hace fallar solo AwardsWatch y deja un evento
  `connector.failed`; no publica filas parciales silenciosamente.
- Guardian está activo desde el 2026-07-24. Su clave existe únicamente en
  `web/.env.local` para desarrollo y en los secretos de Edge Functions para
  staging; no forma parte del seed, los logs ni Git.
- La revisión de condiciones previa a una publicación comercial sigue abierta;
  `review-before-publish` permite discovery personal, no autoriza reutilizar
  cuerpos.
- La agregación de fase 6 lee únicamente observaciones `published` y
  `participates = true`; las pendientes no se reinterpretan ni participan.

## Evidencia en staging

El 2026-07-24 se aplicaron las migraciones y el seed al proyecto aislado de
staging. La Edge Function quedó `ACTIVE` y el Cron
`runscars-ingestion-daily`, activo con expresión `17 4 * * *`.

La primera llamada autenticada ejecutó dos conectores: AwardsWatch insertó 10
predicciones ordenadas y RogerEbert terminó con cero publicaciones aplicables
porque el feed del momento no contenía URLs `/reviews/`. La segunda llamada
detectó las 10 observaciones como duplicadas e insertó cero. La base conserva
una publicación, una captura y 10 observaciones con la URL canónica de
AwardsWatch. Una llamada sin el secreto devolvió HTTP 401.

Después de configurar la clave de Guardian, una primera ejecución amplia
confirmó dos coincidencias del catálogo (`The Odyssey` y `The Invite`) y
publicó cuatro observaciones originales: dos reseñas y dos notas. Las 94
observaciones de películas ajenas a la temporada quedaron conservadas como
`excluded` y sus revisiones se cerraron como `dismissed`. El conector se
restringió entonces dinámicamente al catálogo: la ejecución de comprobación
procesó solo esas dos publicaciones, reconoció las cuatro observaciones como
duplicadas y no creó revisiones nuevas.

El 2026-07-25 se desplegó la ampliación multcategoría. Los seis conectores de
predicción completaron una ejecución real con trigger `scheduled`; cinco
aportaron rankings y The Ringer una selección de Mejor película. La revisión
editorial vinculó seis erratas inequívocas y excluyó las obras sin match único,
conservando siempre el valor original. La cola quedó en `0` pendientes.

Los extractores corrigieron además tres casos descubiertos en staging: identidad
de publicación estable por URL aunque cambie su ID externo, encabezados
alternativos de categorías técnicas y elección determinista del crédito
relevante cuando una persona figura como guionista y directora. Repetir el
archivo oficial 2026 confirmó que esas candidaturas son idempotentes.

El Cron `runscars-ingestion-daily` está activo a las 04:17 UTC y
`runscars-markets-hourly` al minuto 17 de cada hora. La primera captura de
mercados terminó con Kalshi sin contratos Oscar abiertos y Polymarket con 65;
ninguno creó observaciones profesionales.

## Puerta de salida

- [x] Repetir una importación no duplica observaciones ni revisiones.
- [x] Un fallo de una fuente no bloquea la siguiente.
- [x] Toda observación publicada conserva su URL canónica.
- [x] Los tres conectores se prueban con fixtures sin internet.
- [x] Existe importación manual versionada.
- [x] Runs, logs, cola de revisión, Edge Function y tarea diaria están
  implementados.
