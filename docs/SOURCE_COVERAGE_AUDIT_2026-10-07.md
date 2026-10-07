# Integridad y cobertura de fuentes · 7 de octubre de 2026

**Estado:** publicado y verificado en `https://runscars.app`.

Este mantenimiento recupera órdenes originales verificables, amplía programas y
palmarés oficiales y añade premios precursores como contexto separado. La
aclaración del usuario prioriza carteles y metadatos TMDB para películas de
festivales fuera de las predicciones; IMDb queda como enlace opcional. D-068 a
D-072 de [DECISIONS.md](DECISIONS.md) registran las decisiones aceptadas.

## Resultado

- Las ocho categorías cuentan ahora con seis medios vigentes y consenso. Mejor
  película y dirección tienen cinco fuentes ordenadas; las otras seis, cuatro.
  Variety / Clayton Davis aporta una voz por categoría mediante ocho conectores
  aislados. Se conservan `Rank`, longitud completa, fecha, artículo y tabla/CSV.
- AwardsWatch y Awards Daily reconocen listas HTML ordenadas; Awards Daily
  admite artículos válidos de categorías aisladas sin exigir Mejor película.
  Las listas sin orden declarado siguen siendo selecciones. Los sujetos ocultos
  o dudosos conservan posición y longitud sin inventar un matching.
- El circuito pasa de 313 a **1.061 entradas vigentes**, repartidas en 893 de
  selección y 168 de palmarés, con 16 conjuntos de nueve festivales. Los datos
  son versiones nuevas con recibos oficiales; no se alteran originales.
- `/premios` publica seis calendarios 2027 y un archivo parcial de 25 ganadores
  de cine de 2026: Actor Awards/SAG-AFTRA, DGA, PGA, WGA, Critics Choice y BAFTA.
  Sus doce conjuntos no aportan puntos Borda ni acreditan elegibilidad Academy.
- Hay **732 entradas con identidad TMDB corroborada**, correspondientes a 503
  películas. Las 1.006 capturas por idioma contienen metadatos para todas ellas;
  483 tienen cartel disponible, visible en 710 entradas, 608 fuera del catálogo
  de predicciones. Veinte películas verificadas carecen de cartel en TMDB.
  Diecinueve entradas verificadas sin IMDb ya pueden usar TMDB.

Las [86 exclusiones iniciales](audits/2026-10-07/prediction-exclusions-before.json)
corresponden a Midnight Critics (83) y The Ringer (3), ambas caducadas. No se
halló descarte indebido por categoría de un medio vigente. La
[cobertura posterior](audits/2026-10-07/prediction-coverage-after.json) conserva
las fuentes, fechas y diferencias entre rankings y selecciones.

Ver [cobertura festivalera](audits/2026-10-07/festival-coverage-after.json),
[metadatos y carteles](audits/2026-10-07/festival-tmdb-metadata-after.json),
[integridad de Variety](audits/2026-10-07/variety-production-integrity.json) y
[recibos de investigación](audits/2026-10-07/festival-research.md).

## Integridad e importaciones

Los enlaces externos usan título exacto, dirección y años únicamente cuando la
fuente los declara. Producción y estreno se contrastan por separado; no se usa
el año del festival como año de película. Homónimos y pruebas insuficientes
siguen pendientes. Los originales y su procedencia se conservan en historial
independiente del catálogo Oscar.

Los carteles y metadatos reutilizan `tmdb_movies` y `tmdb_movie_snapshots`.
La [comprobación de catálogo](audits/2026-10-07/festival-metadata-catalogue-integrity.json)
confirma que la carga mantuvo 112 películas, 482 candidaturas y 112 asociaciones
de temporada. No creó candidaturas ni elegibilidad. La renovación de una
respuesta idéntica conserva original, hash, URL y `fetched_at`; cambia solo la
verificación y caducidad de esa locale. Las lecturas eligen la última
verificación, incluso cuando el proveedor vuelve a un hash anterior.

Las importaciones repiten sin duplicados: once conjuntos de suplemento, uno de
corrección y doce precursores. La carga TMDB terminó con 503 películas, dos
idiomas y cero fallos. La [repetición de tres películas](audits/2026-10-07/festival-tmdb-repeat.json)
renovó seis capturas, creó cero filas y conservó sus originales. Los fallos de
una fuente, película o idioma se aíslan de los demás.

## Verificación

- `npm ci`, formato, lint, TypeScript, **349 unitarias**, **46 pruebas de base
  de datos** y compilación de producción correctos. Tipos generados desde 49
  migraciones. Las pruebas y la compilación local usan fixtures reproducibles.
- En el recorrido E2E general pasaron 140 de 142 casos. Los dos restantes
  detectaron un selector ambiguo porque ahora título y cartel abren FJORD;
  corregido el selector, ambos pasaron en escritorio y móvil. Además pasaron
  ocho casos centrados en festivales y carteles.
- La [auditoría pública](audits/2026-10-07/public-after.json) recorrió **5.218
  páginas** de un sitemap de 4.820 URLs, sin destinos internos rotos. Se verificó
  contra Supabase real antes de incorporar la presentación de carteles; esta
  ampliación no crea rutas de catálogo ni candidaturas.
- Los quince parsers profesionales vivos comprobaron sus categorías completas;
  Kalshi conservó 92 contratos 2027 válidos y Polymarket 133. Los diez runs
  manuales nuevos terminaron HTTP 200 sin fallos y se publicaron ocho snapshots.
  Ver [runs](audits/2026-10-07/ingestion-after.json),
  [snapshots](audits/2026-10-07/snapshots-after.json) y
  [auditoría operativa](audits/2026-10-07/production-audit-summary.json).
- La web anterior superó 160 comprobaciones reales ES/EN en escritorio y móvil,
  más las revisiones específicas de festivales y precursores. La nueva web
  superó [40 vistas festivaleras](audits/2026-10-07/festival-ui-after.json),
  120 cargas de cartel muestreadas y doce comprobaciones de metadatos, sin errores
  de imagen, consola, desbordamiento ni Axe grave. Se contrastaron las 1.061
  entradas en los cuatro contextos ES/EN y escritorio/móvil. La expectativa
  inicial antigua de Venecia se corrigió contra su versión vigente de 91 entradas;
  el [recibo](audits/2026-10-07/festival-ui-version-review.json) conserva el rastro.
  También se verificó [TMDB sin IMDb](audits/2026-10-07/festival-tmdb-without-imdb-ui.json).
- Vercel compiló con Supabase real el commit de web `8f0e87a`; se promovió
  exactamente el artefacto comprobado y se verificaron salud, base de datos,
  carteles públicos ES/EN, fuentes y premios. La invocación autenticada de
  `run-festivals` confirmó una identidad sin IMDb con HTTP 200 y cero fallos;
  su repetición fue idempotente. Ver
  [respuesta Edge](audits/2026-10-07/festival-links-edge-after.json) y
  [registro de publicación](audits/2026-10-07/release.json).

Se aplicaron parches a Next 16.3.8, sharp 0.35.5, brace-expansion 5.0.12 y
source-map-js 1.2.2. La auditoría de dependencias de ejecución tiene **cero
vulnerabilidades conocidas**. `npm run verify` termina con código 1 únicamente
por la auditoría total: un aviso alto de `braces` 3.0.3 sin versión corregida,
arrastrado por cinco nodos del árbol ESLint/Next de desarrollo. No se aplica el
downgrade incompatible de `npm audit fix --force`. Ver
[avisos](audits/2026-10-07/dependency-advisories.json).

## Límites reales y operación

Locarno declara cinco secciones verificadas; otras secciones quedan por revisar.
NYFF conserva las 34 películas de Main Slate, corroboradas contra el anuncio
oficial también en el navegador; Spotlight y Currents siguen pendientes.
La web oficial responde 403 al importador: se mantiene la incidencia y la fecha
real del último éxito, sin ocultarla ni inventar una captura automática correcta.
Las ocho ediciones cerradas figuran como archivos revisados, sin Cron activo.

Se creó copia lógica de roles, esquema completo y datos fuera de Git en
`/Users/nacho/Documents/Side/Runscars-backups/2026-10-07-source-coverage`,
con directorio 0700 y SQL 0600. Se aplicaron seis migraciones aditivas y se
publicaron `run-ingestion` y `run-festivals`. No se ensayó otra restauración en
este corte. Los cambios locales previos de `OPERATIONS.md` y la auditoría de
indexación del 17/09 se conservan ajenos a esta entrega.
