# Auditoría y corrección de predicciones · 19 de octubre de 2026

**Estado:** publicada y verificada en producción; límites externos documentados.

## Diagnóstico inicial

Lectura HTTPS del HTML público vivo, comparación con los recibos del 29/09 y
07/10 y ejecución de los extractores contra las páginas originales. Las cifras
son medios con contribuciones elegibles / medios con ranking ordenado.

| Categorías | 07/10 | 19/10 antes de corregir |
|---|---:|---:|
| Película y dirección | 6 / 5 | 4 / 3 |
| Actriz protagonista | 6 / 4 | 3 / 2 |
| Actor, repartos y guiones | 6 / 4 | 5 / 3 |

Movie State mantiene la publicación del 14/09: caducó en todas las categorías.
NBP actriz conserva su evidencia sin cambios desde el 17/09 y caducó. Midnight
Critics y The Ringer ya estaban vencidas antes del 07/10; no explican la caída
reciente. Una comprobación de red correcta no renueva una predicción.

AwardsWatch tuvo su último éxito el 15/10. El encabezado original de
[guiones](https://awardswatch.com/2027-oscar-predictions-adapted-screenplay-and-original-screenplay-october/)
escribe `ADAPTED SCREEPNPLAY`, provocando rechazo por categoría requerida
ausente. El [panel de reparto masculino](https://awardswatch.com/2027-oscar-predictions-supporting-actor-october/)
sitúa NEXT dentro de la misma tabla: la versión anterior interpretaba cinco
alternativas y el marcador como selecciones. Sus tablas de octubre no declaran
un orden total; recuperar su captura recupera cobertura, no puntos Borda.

El bloque final de [Awards Daily](https://www.awardsdaily.com/2026/10/17/2027-oscar-predictions-is-can-you-see-everything-really-a-major-best-picture-contender/)
no declara orden. Su discusión numerada anterior de once películas no equivale
a sus diez predicciones finales y no se usa como ranking.

Variety adaptado tiene Rank completo 1–30 con filas físicas `1,3,2,4...` en
[su CSV](https://datawrapper.dwcdn.net/ajt7v/13/dataset.csv). Se valida el conjunto
y se ordena por Rank, preservando las filas originales. [Reparto femenino](https://datawrapper.dwcdn.net/Wczo3/15/dataset.csv)
duplica 4 y omite 7; [guion original](https://datawrapper.dwcdn.net/a5kl2/14/dataset.csv)
duplica 6 y omite 5. Esas revisiones siguen rechazadas, con la última válida
conservada. Los fallos de las categorías no bloquean las demás.

## Profundidad acordada

| Medio | Longitud original película / resto | Ventana ordenada v4 |
|---|---:|---:|
| Awards Radar | 50 / 20 | 20 / 10 |
| Variety | 40 / 30 | 20 / 10 |
| NBP | 10 / 5 | 10 / 5 |
| Awards Daily y AwardsWatch de octubre | Selección 10 / 5 | Sin Borda |
| The Ankler / Christopher Rosen | 10 / 5 | 10 / 5 |
| The Rolling Tape / Danny Jarabek | 20 / 10 | 20 / 10 |

K es 20 en película y 10 en las demás categorías; puntos `(K-p+1)/K` si p<=K.
El puesto cinco vale 0,60 en una categoría de cinco nominados, tanto en listas
de cinco como de treinta. Listas cortas no se rellenan; huecos de matching no
se comprimen. Fuera de K no hay puntos, cobertura ni desempates del consenso.
Los originales siguen completos y las selecciones aportan solo cobertura.

## Incorporaciones y límites

[Christopher Rosen](https://anklerpundits.com/pundit/christopher-rosen/) tiene
45 posiciones explícitas y fechas por categoría del 10 al 18/10. Es deputy
editor de The Ankler; su [panel](https://anklerpundits.com/predictions/best-picture/)
aporta la segunda evidencia. No se ingiere su consenso agregado, que incluye
otros medios ya contabilizados. El texto obsoleto «coming soon» convive con
ballots actuales verificables y ya no justifica descartar la fuente.

[Danny Jarabek](https://therollingtape.com/danny-jarabek/) es editor jefe y
cofundador de The Rolling Tape. Su [ballot](https://therollingtape.com/danny-jarabek-oscar-predictions/)
usa un [JSON público del mismo medio](https://therollingtape.com/wp-json/op/v1/predictors/danny-jarabek)
con 90 puestos explícitos y `last_updated` por categoría. Dirección es del
23/09, reparto femenino del 27/09 y las demás del 11/10. `last_synced` no
renueva vigencia; la fuente requiere control explícito del cambio de temporada.

Gold Derby y Music City Drive-In siguen candidatas; evidencia y restricciones
figuran en [DATA_SOURCES.md](DATA_SOURCES.md). Las nuevas capturas están sujetas
a matching conservador y su participación depende de la frescura real al importar.

## Entrega y evidencias

D-073 a D-075 en [DECISIONS.md](DECISIONS.md) registran las decisiones aceptadas
por el usuario. No se modifican snapshots bloqueados ni hashes; v4 inicia una
serie sin movimientos contra métodos anteriores. Continúan cuatro rankings
mínimos, frescura de treinta días y ocho categorías públicas.

La copia previa está fuera de Git, en
`/Users/nacho/Documents/Side/Runscars-backups/2026-10-19-prediction-sources`,
con directorio 0700 y SQL 0600. Se preservan los cambios locales previos de
operación y la auditoría de indexación de septiembre. Los recibos de este corte
conservan pruebas, importaciones y publicación sin secretos ni datos de usuarios.

### Verificación de implementación e ingestas

- `npm ci`, formato, lint, tipos y compilación correctos. La compilación local
  usa fixtures con Supabase desactivado explícitamente; Vercel compila contra
  la base real. Tipos regenerados desde 57 migraciones.
- **419 pruebas unitarias y 53 de base de datos** correctas. Las seis pruebas
  nuevas de evidencias cubren RLS/publicación, frescura por URL entre IDs distintos,
  huecos, Unicode, créditos de guion, correcciones de fechas y salud por categoría.
- El recorrido E2E general completo pasó **142/142 casos**, en escritorio,
  móvil, Chromium, Firefox y WebKit. Las aserciones reflejan las nuevas etiquetas.
- Diecisiete invocaciones Edge independientes devolvieron HTTP 200: quince
  importaciones correctas y dos incidencias explícitas de Variety por duplicados
  en sus propios Rank. Ankler importó 45 observaciones, Rolling Tape 90 y
  AwardsWatch 45. Los originales válidos de Variety se conservaron por categoría.
- La repetición reutilizó **948 observaciones**, insertó **cero capturas y cero
  observaciones**. Las dos incidencias originales de Variety permanecen visibles.
- La auditoría de ejecución tiene cero vulnerabilidades conocidas. `npm run
  verify` termina con código 1 únicamente en la auditoría general: persiste el
  aviso previo de `braces`, arrastrado por cinco paquetes de herramientas de
  desarrollo. La alternativa sugerida implica un downgrade incompatible de Next;
  no se aplica en este corte.
- La comprobación pública detectó timeouts anónimos que no aparecían en el
  `EXPLAIN ANALYZE` administrativo. Se corrigieron con frescura diferida,
  categorías públicas, caché de 60 segundos por fuente y una lectura compartida
  de estados para las ocho categorías. El benchmark anónimo final pasó **7/7**
  lecturas, incluidas tres concurrentes: entre **149 y 1.739 ms**, sin errores.
  Las doce comprobaciones de preview en ambos idiomas y dispositivos pasaron;
  sus logs de ejecución no contienen errores.
- Las fichas comparan la lista efectiva completa antes de conservar puntos entre
  capturas con IDs nuevos. Un cambio de cola, formato o artículo con votos
  idénticos mantiene las contribuciones; una cabeza distinta o incompleta no.
  Veinte regresiones verifican este caso, las selecciones, los métodos históricos
  y los cero puntos de una publicación caducada.

### Resultado de datos en producción

| Categorías | Medios con datos | Rankings que puntúan | Consenso |
|---|---:|---:|---|
| Película, dirección, actor, repartos y guiones | 7 | 5 | Sí |
| Actriz protagonista | 6 | 4 | Sí |

Los ocho punteros actuales corresponden a v4 y tienen la ventana correcta; no hay
contribuciones vencidas. Las 271 versiones históricas conservan sus hashes;
se crearon ocho snapshots nuevos y repetir el refresco devolvió ocho `unchanged`.

Las candidaturas consideradas sumadas por fuente y categoría son: Radar 89,
Variety 89, Rolling Tape 90, Ankler 45, Awards Daily 45, AwardsWatch 44 y NBP 40.
No son longitudes originales: descuentan ventanas, caducidad y matching pendiente.
En las capturas actuales hay 19 observaciones pendientes de matching editorial
(Radar 1, AwardsWatch 1 y Variety 17); las dos fuentes nuevas no tienen pendientes.

Los [recibos de ingesta](audits/2026-10-19/import-responses.json),
[repetición](audits/2026-10-19/repeat-responses.json),
[parsers vivos](audits/2026-10-19/prediction-parsers.txt) y
[estado editorial](audits/2026-10-19/source-status-after-import.json) conservan
la evidencia sin secretos ni datos de usuarios.

### Publicación

El código `29451e4` está publicado en el artefacto
`dpl_98zPhuq6zq6JWeubwwUdu9rZFpDj`, promovido a
[Runscars](https://runscars.app/temporadas/2027) tras ocho comprobaciones del
último ajuste de etiquetas y las doce comprobaciones previas de datos reales.
Se aplicaron ocho migraciones aditivas y se desplegó `run-ingestion`; los nuevos
conectores diarios usan el schedule profesional existente.

Los [conteos públicos](audits/2026-10-19/public-source-counts.json) verifican las
ocho categorías de ocho fuentes, incluida Movie State con cero consideradas.
El [benchmark anónimo](audits/2026-10-19/anonymous-read-benchmark.json), la
[integridad histórica](audits/2026-10-19/snapshot-integrity.json),
[verificación completa](audits/2026-10-19/verification.txt) y
[E2E](audits/2026-10-19/e2e.txt) conservan los resultados reproducibles.

La [comprobación pública final](audits/2026-10-19/production-ui-final.json)
pasó **100/100 casos**, en español e inglés, escritorio y móvil: ocho categorías,
seis fichas de predicciones, fuentes, metodología y recorridos relacionados.
No hubo errores de navegador, imágenes rotas, desbordamientos ni infracciones
graves/críticas de accesibilidad automatizada. La revisión visual confirmó las
etiquetas separadas y la conservación del historial.

Los [logs del artefacto final](audits/2026-10-19/production-runtime-final.jsonl)
no contienen errores durante la comprobación. [Salud web/base de datos, robots,
sitemap y tarjeta social](audits/2026-10-19/public-health-final.json) respondieron
HTTP 200; el sitemap incluye las dos fuentes nuevas. El
[dominio público](audits/2026-10-19/production-deployment.txt) apunta al mismo
artefacto verificado. Son comprobaciones de laboratorio y de este intervalo;
no equivalen a métricas de campo ni garantizan disponibilidad futura de las fuentes.
