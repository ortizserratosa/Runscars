# Auditoría de fuentes de predicción · 29 de septiembre de 2026

## Conclusión

Sí hace falta ampliar la cobertura de rankings profesionales verificables. La
lista de medios elegibles del discovery no equivale a fuentes activas ni a votos
ordenados vigentes. La intervención prioritaria es reparar la interpretación de
las fuentes existentes y añadir **The Movie State** como una voz independiente.
No se alcanza una cobertura honesta convirtiendo selecciones, paneles de autores
o listas alfabéticas en rankings.

La frecuencia de consulta de Runscars es diaria; la frecuencia editorial de cada
medio es otra magnitud. Una comprobación HTTP correcta tampoco renueva una
predicción antigua. Para las páginas sin fecha propia se conserva la captura
original de su revisión; no se usa la hora de la última consulta para hacerlas
parecer recientes.

Este corte revisa los ocho premios públicos vigentes. No abre otra fase ni
incorpora categorías técnicas a la superficie pública. Las decisiones duraderas
quedan en [DECISIONS.md](../../DECISIONS.md), y el inventario vigente en
[DATA_SOURCES.md](../../DATA_SOURCES.md) y
[SOURCE_MATRIX.md](../../SOURCE_MATRIX.md).

## Método y límites de la evidencia

Se compararon los contratos de producto, metodología e ingesta, las fuentes y
conectores configurados, y páginas primarias consultadas el 2026-09-29. Se usaron
búsqueda web, lectura de páginas y peticiones HTTPS ordinarias, sin credenciales,
cookies ni cambios para eludir bloqueos. Los snippets del buscador sirven para
descubrir URLs; las fechas y estructuras decisivas se verificaron en la página
canónica. Algunas lecturas web estaban cacheadas: Cinema Sight devolvía primero
su contenido de agosto, mientras su artículo de septiembre y el HTML vivo
confirmaban una publicación del 23 de septiembre.

El error de una herramienta web no demuestra un bloqueo del proveedor: Variety,
THR e IndieWire dieron error en esa herramienta, pero devolvieron HTTP 200 a una
petición normal. A la inversa, recibir HTML 200 no acredita que el contenido esté
libre de paywall: se revisaron también la estructura y los metadatos de acceso.
No se han importado datos de resúmenes de terceros, proxies, resultados de
búsqueda ni reproducciones no canónicas.

## Fuentes que ya usa Runscars

| Fuente | Evidencia reciente | Cadencia que permite afirmar la evidencia | Tratamiento correcto |
|---|---|---|---|
| AwardsWatch | [Película/dirección, 17-09](https://awardswatch.com/2027-oscar-predictions-best-picture-and-best-director-september/); [guiones, 21-09](https://awardswatch.com/2027-oscar-predictions-adapted-screenplay-and-original-screenplay-september/) | El medio declara mensual ahora; semanal cuando vuelva Frontrunner Friday | Cambió a cuatro columnas de autores. Una sola voz por medio; mantener a Erik Anderson como autor ancla explícito. Solo película y dirección conservan numeración: interpretación y guiones pasan como selección. No inferir un orden por posición de celda. |
| Awards Daily | [11-09](https://www.awardsdaily.com/2026/09/11/2027-oscar-predictions-a-muted-festival-season-as-the-odyssey-and-project-hail-mary-light-the-way/) y [archivo de predicciones](https://www.awardsdaily.com/category/2027-oscar-predictions/) | Hay publicaciones semanales recientes, incluidas 18 y 25 de septiembre | Acotar el bloque de predicciones y separar alternativas. El mero orden de párrafos sin ranking declarado no prueba una posición Borda. |
| Awards Radar | [Estado de la carrera, 04-09](https://awardsradar.com/2026/09/04/awards-season-oscar-predictions-update-the-summer-is-pretty-much-over-and-fall-film-festival-season-is-about-to-reveal-some-contenders/); [18-09](https://awardsradar.com/2026/09/18/awards-season-oscar-predictions-update-where-do-we-stand-after-the-first-wave-of-fall-film-festival-debuts/); [ranking actualizado 23-09](https://awardsradar.com/best-picture/) | Actualizaciones varias veces al mes comprobadas | Ranking explícito. Respetar la frontera entre nominados previstos y alternativas; validar posiciones sin rellenar huecos. |
| Next Best Picture | [Perfil de Matt Neglia](https://predictions.nextbestpicture.com/u/655756da85df4c0efaa10bd2/oscars); [actividad editorial, 10-09](https://nextbestpicture.com/could-the-debut-or-wild-horse-nine-win-best-picture/) | Página viva; el artículo editorial por sí solo no fecha una revisión del ranking | El conector vigente lee el perfil de Matt Neglia: una voz del medio, no el consenso del equipo. La captura de un cambio real y el último éxito del conector son instantes distintos. No sumar perfiles como medios independientes. |
| Midnight Critics Circle | [Predicciones 2027](https://www.midnightcritics.com/predictions/2027-oscar-predictions); [archivo](https://www.midnightcritics.com/predictions) | No se verificó una fecha editorial propia reciente del ranking | Ranking numerado de consenso, con nombres de colaboradores como metadatos. No sustituir antigüedad por fecha de consulta. Conservar los errores originales; normalizar solo el matching. |
| The Ringer | [Selección, 20-03](https://www.theringer.com/2026/03/20/oscars/oscars-2027-predictions-best-picture-movies-contenders); [archivo Oscar](https://www.theringer.com/topic/oscars) | Se localizó un podcast del 22-09, pero no una nueva selección escrita equivalente | La selección de marzo permanece vencida. Un podcast reciente no actualiza retroactivamente ese artículo ni aporta un ranking sin transcripción verificable. |

AwardsWatch también publicó [categorías técnicas el 24-09](https://awardswatch.com/2027-oscar-predictions-all-below-the-line-and-feature-categories/).
Eso prueba actividad, pero no autoriza activar más categorías públicas ni
reutilizar esa fecha para las listas del 17 o del 21.

## Incorporación implementada: The Movie State

- **ID:** `the-movie-state`; conector `movie-state-predictions`.
- **Autor:** Ben Sears, identificado en el artículo y en
  [su archivo de autor](https://themoviestate.com/author/bensearsonfilm/).
- **Observación representativa:**
  [predicciones 2027](https://themoviestate.com/2026/09/14/2027-oscar-predictions/),
  publicadas `2026-09-14T15:00:00Z` y modificadas
  `2026-09-21T17:24:58Z`, ambas fechas verificadas en los metadatos de ese artículo.
- **Segunda evidencia y discovery:**
  [archivo de predicciones](https://themoviestate.com/the-movie-state/features/award-predictions/),
  que enlaza también las temporadas anteriores. Las predicciones
  [2026](https://themoviestate.com/2025/09/16/2026-oscar-predictions/) proporcionan
  un segundo ejemplo del formato mantenido hasta marzo.
- **Frecuencia:** irregular comprobada entre las muestras disponibles. El CMS
  declara una modificación siete días después de publicar, sin demostrar que
  cambiara la predicción; no hay base para prometer una publicación cada semana.
- **Formato:** ranking explícito, diez títulos para película y cinco para las
  otras siete categorías. Las dos columnas de cada tabla son categorías
  diferentes, no autores. Cada renglón conserva posición original y texto.
- **Captura:** HTTPS/HTML público. El endpoint WordPress probado devolvió 404;
  el discovery usa el archivo HTML, busca el año de ceremonia y descubre de nuevo
  la URL canónica en cada run. No depende de un artículo fijo.
- **Publicación:** únicamente datos de candidaturas, puestos, fecha, autor y
  enlaces; sin cuerpo editorial, imágenes o extractos de reseñas. La fuente no
  recibió una licencia especial: `publishable` es el estado editorial de este
  uso limitado dentro de Runscars, no una afirmación jurídica general.

El extractor conserva la publicación original y la modificación declarada. La
fecha que gobierna frescura es **14-09**, la publicación original. La modificación
CMS del 21-09 no prueba un cambio de predicción y queda como evidencia secundaria:
un cambio de ese metadato no renueva el voto. Para reactivar una publicación
vencida se exige una fecha explícita de predicción nueva o revisión editorial de
la actualización; no se promete que el timestamp del CMS la sustituya.
`prepareBatch` conserva la identidad inmutable por contenido: una consulta
idéntica no crea otra revisión. Un cambio de autor, ceremonia, canonical,
estructura, intención, fecha válida, número de filas, duplicados o posiciones
consecutivas invalida la revisión completa. No se publica una tabla parcial. Los
sujetos sin identidad exacta siguen la revisión editorial normal.

Implementación:
[movie-state.mjs](../../../supabase/functions/_shared/ingestion/movie-state.mjs),
[migración](../../../supabase/migrations/20260929160000_movie_state_predictions.sql),
[pruebas](../../../web/tests/unit/movie-state.test.ts) y
[fixture reducido](../../../web/tests/fixtures/ingestion/movie-state-multicategory.html).

## Candidatas adicionales y decisión de esta auditoría

| Fuente | Evidencia primaria | Resultado y prioridad |
|---|---|---|
| Variety / Clayton Davis | [Resumen, 24-09](https://variety.com/lists/2027-oscars-predictions/); [guion original, 18-09](https://variety.com/feature/2027-oscars-best-original-screenplay-predictions-1236834273/) | Prioridad alta si se habilita una captura accesible. Declara actualización cada jueves. El resumen actual es una selección alfabética con ganador marcado, no un ranking. La tabla ordenada se carga en un iframe Datawrapper cuyo URL exacto devolvió 403; no se extrajo ni se evitó la barrera. |
| The Hollywood Reporter / Scott Feinberg | [Primer forecast 2027, 03-09](https://www.hollywoodreporter.com/lists/oscar-predictions-2027-scott-feinberg-first-forecast/); [tras los festivales, 12-09](https://www.hollywoodreporter.com/lists/feinberg-forecast-post-venice-telluride-tiff-starts/) | Alta prioridad editorial, pendiente de acceso autorizado y revisión de publicación. Se verificaron publicaciones del 03 y 12-09 UTC; el autor declara evaluación semanal. Hay puestos explícitos, pero el JSON-LD marca `isAccessibleForFree: false` y los bloques están bajo `.pmc-paywall` en ambas muestras. No se automatiza su captura pública. Además excluye películas que todavía no ha visto: esa limitación debe acompañar cualquier futura incorporación. |
| IndieWire / Marcus Jones | [Predicciones, 25-09](https://www.indiewire.com/lists/2027-oscar-predictions-academy-awards/); [archivo de premios](https://www.indiewire.com/awards/) | Útil para selecciones cuando supere revisión de publicación. Los grupos de guion consultados son niveles con orden alfabético de autores; no dan posiciones Borda. No resuelve el déficit de rankings ordenados. |
| Filmotomy / Doug Jamieson | [Inicio 2026/2027, 03-09](https://filmotomy.com/welcome-to-awards-season-2026-2027-first-oscars-predictions/); [dirección, temporada anterior](https://filmotomy.com/best-director-oscars-predictions-september/) | Buena candidata para selección y ganador separados. La lista de septiembre de 2026 es alfabética, con ganador destacado. La temporada anterior sí tiene rankings numerados: esperar una muestra actual equivalente antes de activar Borda. No se duplica con The Jam Report si reutiliza el mismo autor/lista. |
| Cinema Sight / Wesley Lovell y colaboradores | [Agosto, 19-08](https://www.cinemasight.com/2026-nominations-predictions-august/); [septiembre, 23-09](https://www.cinemasight.com/2026-nominations-predictions-september/) | Cadencia mensual observada. La tabla agrega presencia de tres autores sobre filas alfabéticas, no una clasificación ordinal. Podría aportar selección como una voz editorial; ni los autores ni el orden alfabético cuentan como fuentes/puestos adicionales. |
| The Ankler / Prestige Junkie Pundits | [Panel](https://anklerpundits.com/); [predicciones tempranas](https://theankler.com/recklessly-early-oscar-predictions/) | El panel consultado anuncia todavía próximas predicciones Oscar 2027 y mezcla contexto Emmy en la página. No interpretar las fechas de actualización de pundits como rankings Oscar ya disponibles. Debe resolver además solapamientos de los expertos con sus medios. |
| The Film Experience | [Reparto femenino 2027](https://thefilmexperience.net/supporting-actress/); [blog](https://thefilmexperience.net/blog/) | La muestra consultada conserva indicación de junio y presenta niveles. No demuestra una lista reciente, fechada y ordenada que mejore el déficit actual. |
| Gold Derby / Award Expert / vídeo y podcasts | [Gold Derby Oscar](https://www.goldderby.com/c/film/oscars/) | No se obtuvo en este corte una exportación trazable que separe editorial/experto/usuario y su fecha por lista. No se incorporan agregados mixtos, cuotas ni inferencias de audio como votos profesionales. |

La búsqueda adicional de The Contending, Awards Ace, Oscars Central y Screen
Rant no aportó dos muestras actuales, fechadas y comparables de rankings 2027
con un método reproducible mejor que las anteriores. Esto no demuestra que esos
medios no publiquen: quedan pendientes de evidencia suficiente, sin selección
ni activación automática en este corte.

## Consecuencias para cobertura y cálculo

1. El tamaño del catálogo no debe mostrarse como número de votos vigentes.
2. Un medio aporta una sola voz por categoría e intención, incluso cuando tiene
   varios autores o aparece en un panel de otro proveedor.
3. Una selección aporta cobertura, pero no Borda, posiciones medias, medianas ni
   primeros puestos. No convertir una mención narrativa a ganador en un ranking
   completo de nominaciones.
4. La caducidad a 30 días se aplica a cada publicación/revisión, nunca al último
   éxito de red. Un conector de una fuente vencida debe seguir buscando cambios.
5. El cuarto ranking de guiones no puede inventarse para cumplir la puerta
   D-025. Tras corregir selecciones, la cobertura ordenada real puede quedar por
   debajo del mínimo; debe mostrarse como cobertura insuficiente y mantenerse
   pendiente, aunque otras fuentes aporten selecciones útiles.

No se recomienda ponderar medios por fama, tamaño de panel o reputación sin un
historial de evaluación comparable. Tampoco mezclar precios de mercados,
recepción crítica o resultados oficiales con estos votos.

## Verificación editorial de coincidencias

Se revisó el [recibo de extracción del mismo corte](prediction-extraction.json)
y se conservaron las evidencias en [editorial-matches.json](editorial-matches.json).
Las siguientes coincidencias disponen de evidencia primaria:

| Observación revisada | Evidencia de identidad | Corrección y estado |
|---|---|---|
| Awards Radar: `Artifical` | [Ficha oficial NYFF de Artificial](https://www.filmlinc.org/nyff2026/films/artificial/) y [anuncio del 05-08](https://www.filmlinc.org/nyff2026/daily/64th-new-york-film-festival-main-slate-announced/): Luca Guadagnino, Andrew Garfield y Yura Borisov | La tarjeta 24 de Radar identifica la trama de Sam Altman/OpenAI. Alias exacto implementado y probado solo para matching de Awards Radar; conserva `Artifical` en el original. No crea otra película. Despliegue/importación posteriores aún no certificados por esta nota. |
| Awards Radar: `Guy Peace – Ink` | [Ficha oficial Venecia](https://www.labiennale.org/en/cinema/2026/venezia-83-competition/ink), [Netflix Tudum](https://www.netflix.com/tudum/articles/ink-release-date-danny-boyle-movie) y [TMDB 1532610](https://www.themoviedb.org/movie/1532610): Guy Pearce interpreta a Rupert Murdoch en la película de Danny Boyle | La tarjeta 17 de Radar incluso conserva `data-image-title="Guy Pearce"`. Alias exacto de persona implementado y probado para Awards Radar, preservando el texto fuente. Los créditos de Ink se renovaron en el catálogo vivo mediante el CLI canónico; eso no certifica todavía el despliegue del extractor. |
| Next Best Picture: `Luca Guadagnino — Artificial`, `Andrew Garfield — Artificial`; Radar: Yura Borisov | Las mismas fuentes oficiales NYFF identifican al director y a Garfield como Sam Altman y Borisov como Ilya Sutskever; la API oficial de [TMDB 1492198](https://www.themoviedb.org/movie/1492198) coincide en los tres créditos y la trama de OpenAI | Defecto confirmado del catálogo: `artificial` estaba enlazada a [TMDB 1586108](https://www.themoviedb.org/movie/1586108), película de Tyler Woods sobre un policía y un robot. Se aplicó `tmdb:match artificial 1492198`, con registro en `film_tmdb_match_history` y reemplazo de créditos; no se añadieron créditos a la película equivocada. La predicción de categoría sigue perteneciendo al medio. |

La comprobación de identidad utilizó `TmdbClient.fetchMovie(id, "en-US")`, que
consulta la API oficial con créditos, para **ambos** identificadores. El título y
el año coincidían en las dos películas, pero director, reparto, sinopsis e IMDb
diferían: `tt37171180` para Guadagnino y `tt38982654` para Woods. Es una razón
concreta para exigir evidencia de identidad adicional al título y al año cuando
hay homónimos. La fecha `2026-12-25` declarada por TMDB para la ficha correcta se
conserva como metadato; no acredita por sí misma elegibilidad Oscar. La migración
`20260929164000_artificial_catalog_correction.sql` corrige el fallback antiguo
solo tras verificar que el catálogo ya apunta al identificador correcto.

NYFF describe a Garfield y Borisov como protagonistas, pero eso no convierte el
voto de reparto de Next Best Picture en un error de identidad: la colocación
Oscar forma parte de la predicción y debe conservarse como tal. Estas fichas
oficiales acreditan película, director y reparto; la fecha festivalera o la
etiqueta cinematográfica 2026 no demuestran por sí solas elegibilidad Oscar ni
sustituyen las reglas y recibos específicos de estreno.

## Verificación realizada

- Lectura de las muestras primarias enlazadas y contraste del HTML vivo cuando
  una respuesta web estaba cacheada o no disponible.
- Smoke del nuevo conector con discovery real: una publicación, Ben Sears,
  45 observaciones, ocho categorías, fechas originales y canonical verificadas.
  Esta comprobación de integración no forma parte de la suite reproducible.
- `npx vitest run tests/unit/movie-state.test.ts`, desde `web`: **15/15** pruebas
  con fixture local, incluyendo rechazo de categorías incompletas, autor,
  temporada, filas o posiciones inválidas y fechas futuras; idempotencia y
  cambio de revisión por contenido y conservación de la fecha de publicación
  aunque cambie la fecha CMS.
- Formato de los archivos JavaScript/TypeScript nuevos, TypeScript (`npx tsc
  --noEmit --project web/tsconfig.json`) y `git diff --check`.
- La verificación final conjunta incluye **263 pruebas unitarias, 25 pruebas
  de base de datos y 124 pruebas E2E correctas**.

La validación general, migraciones, importación en producción y comprobación
pública están documentadas en la
[entrega conjunta](../../PREDICTION_AUDIT_2026-09-29.md). The Movie State está
activa y participa en los ocho cortes publicados del 29/09; el smoke local
descrito arriba es una prueba distinta de esa comprobación operativa.
