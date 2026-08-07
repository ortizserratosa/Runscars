# Matriz de fuentes · fase 1

**Corte de investigación:** 2026-07-24

**Alcance:** 31 fuentes candidatas; 28 seleccionadas para el catálogo del MVP.

La selección combina fuentes de datos auxiliares (`metadata`, `official`,
`festival`) y las tres señales profesionales que se mostrarán por separado
(`score`, `prediction`, `review`). `Seleccionada` significa que la fuente supera
la puerta de calidad y puede incorporarse al MVP; no obliga a activarla desde el
primer día, no la convierte en voto profesional y no equivale a permiso de
republicación. Mandan el tipo de dato, la observación y la columna
`Publicación`.

## Inventario

| ID | Fuente | Tipo | Cobertura y autoría | Frecuencia observada | Método candidato | Paywall | Editorial | Técnico | Publicación | MVP | Riesgo o límite principal |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `tmdb` | TMDB | metadata | Cine mundial; datos del proveedor | Continua | API documentada | No | selected | manual | publishable | Sí | Matching por título requiere revisión y atribución |
| `academy` | Academy | official | Reglas, candidaturas y resultados oficiales | Hitos de temporada | Manual asistido sobre páginas/PDF oficiales | No | selected | manual | publishable | Sí | PDF y HTML cambian entre ceremonias |
| `cannes` | Festival de Cannes | festival | Selección y palmarés; organización | Anual | Web oficial/manual | No | selected | manual | review-before-publish | Sí | Evidencia temprana; nunca se trata como predicción Oscar |
| `venice` | Biennale Cinema | festival | Selección y premios; organización | Anual | Web oficial/manual | No | selected | manual | review-before-publish | Sí | Títulos pueden cambiar en distribución |
| `tiff` | TIFF | festival | Selección y premios; organización | Anual | Web oficial/manual | No | selected | manual | review-before-publish | Sí | Anuncios repartidos en notas de prensa |
| `telluride` | Telluride Film Festival | festival | Programa y premios; organización | Anual | Web oficial/manual | No | selected | manual | review-before-publish | Sí | Programa se publica muy cerca del festival |
| `bafta` | BAFTA Film Awards | official | Nominaciones y ganadores; organización | Anual | Web oficial/manual | No | selected | manual | publishable | Sí | Precursor oficial; no es una fuente editorial |
| `golden-globes` | Golden Globes | official | Nominaciones y ganadores; organización | Anual | Web oficial/manual | No | selected | manual | review-before-publish | Sí | Categorías no equivalen siempre a las Oscar |
| `critics-choice` | Critics Choice Awards | official | Nominaciones y ganadores; organización | Anual | Web oficial/manual | No | selected | manual | review-before-publish | Sí | Páginas agregan varias ediciones |
| `rotten-tomatoes` | Rotten Tomatoes | score, review | Agregado y enlaces de crítica | Continua | Manual; estudiar licencia antes de automatizar | Parcial | selected | manual | replace-before-publish | Sí | Porcentaje de aprobación, no nota media individual |
| `metacritic` | Metacritic | score, review | Agregado ponderado y enlaces de crítica | Continua | Manual; sin API pública documentada | Parcial | selected | manual | replace-before-publish | Sí | Algoritmo ponderado opaco; riesgo de doble conteo |
| `roger-ebert` | RogerEbert.com | score, review | Reseñas firmadas; redactores | Varias por semana | RSS para descubrir + captura manual | No | selected | prototype | review-before-publish | Sí | La nota debe leerse de la reseña canónica |
| `variety` | Variety | prediction, review | Premios y crítica; autores identificados | Semanal/por estreno | RSS/HTML para descubrir + manual | Parcial | selected | manual | review-before-publish | Sí | Listas dinámicas y cambios sin versión explícita |
| `hollywood-reporter` | The Hollywood Reporter | prediction, review | Premios y crítica; autores identificados | Semanal/por estreno | RSS/HTML para descubrir + manual | Parcial | selected | manual | review-before-publish | Sí | Acceso y canonicalización variables por región |
| `indiewire` | IndieWire | prediction, review, score | Premios y crítica; autores identificados | Semanal/por estreno | RSS/HTML para descubrir + manual | Parcial | selected | manual | review-before-publish | Sí | Paywall y respuesta anti-bot en algunas páginas |
| `guardian` | The Guardian | review, score | Crítica firmada; cobertura internacional | Varias por semana | Content API + revisión editorial | Parcial | selected | prototype | review-before-publish | Sí | API key y condiciones sobre cuerpo/extractos |
| `nytimes` | The New York Times | review | Crítica firmada | Varias por semana | API de artículos/Manual | Completo | selected | manual | review-before-publish | Sí | Paywall: guardar solo metadatos, enlace y valor verificable |
| `latimes` | Los Angeles Times | review | Crítica firmada | Varias por semana | RSS/Manual | Parcial | selected | manual | review-before-publish | Sí | Paywall y cambios de URL |
| `washington-post` | The Washington Post | review, score | Crítica firmada | Varias por semana | RSS/Manual | Completo | selected | manual | review-before-publish | Sí | Paywall: no guardar cuerpo; escala solo si es visible |
| `bbc-culture` | BBC Culture | review | Crítica y reportajes firmados | Irregular | RSS/Manual | No | sampled | manual | review-before-publish | No | No todas las piezas incluyen escala numérica |
| `slant` | Slant Magazine | review, score | Crítica firmada | Varias por semana | RSS/HTML + manual | No | selected | manual | review-before-publish | Sí | Nota gráfica: no transcribirla sin extracción verificable |
| `little-white-lies` | Little White Lies | review, score | Crítica firmada | Varias por semana | RSS/HTML + manual | No | selected | manual | review-before-publish | Sí | Tres subpuntuaciones se conservan sin sintetizar una nota |
| `film-stage` | The Film Stage | review | Crítica firmada | Varias por semana | RSS/HTML + manual | No | selected | manual | review-before-publish | Sí | Veredictos no siempre numéricos |
| `screen-daily` | Screen Daily | review | Industria y crítica firmada | Varias por semana | RSS/Manual | Parcial | selected | manual | review-before-publish | Sí | Paywall parcial y cobertura industrial |
| `empire` | Empire | review, score | Crítica firmada | Varias por semana | Manual | Parcial | paused | manual | review-before-publish | No | URLs de reseña difíciles de descubrir de forma estable |
| `gold-derby` | Gold Derby | prediction | Odds y predicciones de editores/usuarios | Continua | Manual; investigar exportación | Parcial | paused | manual | review-before-publish | No | Páginas dinámicas, sesión y mezcla experto/usuario |
| `next-best-picture` | Next Best Picture | prediction, review | Listas por miembro del equipo y consenso | Semanal | HTML estructurado + captura fechada | No | selected | prototype | review-before-publish | Sí | Hay que distinguir voto individual de consenso |
| `awardswatch` | AwardsWatch | prediction | Rankings y análisis firmados | Mensual/semanal | HTML + captura fechada | Parcial | selected | prototype | review-before-publish | Sí | Artículos sustituyen títulos provisionales |
| `awards-daily` | Awards Daily | prediction | Rankings y análisis firmados | Semanal | HTML + captura fechada | No | selected | prototype | review-before-publish | Sí | Listas editoriales pueden ser deliberadamente especulativas |
| `awards-radar` | Awards Radar | prediction | Rankings de equipo/autor | Semanal/mensual | HTML + captura fechada | No | selected | prototype | review-before-publish | Sí | Página de categoría se actualiza en el mismo URL |
| `ankler` | The Ankler | prediction | Análisis firmado de industria | Semanal en temporada | Newsletter/Manual | Completo | selected | manual | review-before-publish | Sí | Solo entran listas explícitas y atribuibles; no el audio implícito |

## Muestras verificables

Cada candidata conserva dos puntos de comprobación. En fuentes seleccionadas,
las muestras son además entradas candidatas del dataset o pruebas del método.

| ID | Muestra 1 | Muestra 2 |
|---|---|---|
| `tmdb` | [Documentación de búsqueda](https://developer.themoviedb.org/reference/search-movie) | [FAQ y atribución](https://developer.themoviedb.org/docs/faq) |
| `academy` | [Reglas de los 99.º Oscar](https://press.oscars.org/news/awards-rules-and-campaign-promotional-regulations-approved-99th-oscarsr) | [Ceremonia 2026](https://www.oscars.org/oscars/ceremonies/2026) |
| `cannes` | [Selección oficial 2026](https://www.festival-cannes.com/en/press/press-releases/the-films-of-the-official-selection-2026/) | [Palmarés 2026](https://www.festival-cannes.com/en/press/press-releases/the-79th-festival-de-cannes-winners-list/) |
| `venice` | [Line-up 2026](https://www.labiennale.org/en/cinema/2026/lineup) | [Película de apertura 2026](https://www.labiennale.org/en/news/danny-boyle%E2%80%99s-ink-opening-film-biennale-cinema-2026) |
| `tiff` | [Special Presentations 2026](https://tiff.net/press/news/tiff-announces-five-special-presentations-in-its-2026-official-selection) | [Apertura y clausura 2026](https://tiff.net/press/news/three-world-premieres-set-the-stage-for-tiffs-51st-edition-with-sian-heders-being-heumann-announced-as-opening-night-film) |
| `telluride` | [Noticias oficiales](https://www.telluridefilmfestival.org/news) | [Festival 2026](https://www.telluridefilmfestival.org/) |
| `bafta` | [Resultados de Film Awards](https://www.bafta.org/awards/film/) | [Nominaciones 2026](https://www.bafta.org/media-centre/press-releases/nominations-2026-ee-bafta-film-awards/) |
| `golden-globes` | [Ganadores y nominados](https://goldenglobes.com/winners-nominees/) | [Reglas y formularios](https://goldenglobes.com/award-rules-and-entry-forms/) |
| `critics-choice` | [Resultados](https://www.criticschoice.com/critics-choice-awards/) | [Envíos, categorías y calendario](https://www.criticschoice.com/critics-choice-awards-submissions-and-categories/) |
| `rotten-tomatoes` | [The Odyssey](https://www.rottentomatoes.com/m/the_odyssey_2026) | [Project Hail Mary](https://www.rottentomatoes.com/m/project_hail_mary) |
| `metacritic` | [The Odyssey](https://www.metacritic.com/movie/the-odyssey-2026/) | [Project Hail Mary](https://www.metacritic.com/movie/project-hail-mary/) |
| `roger-ebert` | [The Odyssey](https://www.rogerebert.com/reviews/the-odyssey-christopher-nolan-matt-damon-film-review-2026) | [Project Hail Mary](https://www.rogerebert.com/reviews/project-hail-mary-ryan-gosling-movie-review-2026) |
| `variety` | [Predicciones Best Picture 2027](https://variety.com/lists/2027-oscars-best-picture-predictions/) | [Reseña de The Odyssey](https://au.variety.com/2026/film/reviews/the-odyssey-review-christopher-nolan-38603/) |
| `hollywood-reporter` | [Predicciones Oscar](https://es.hollywoodreporter.com/premios-oscar-2026-predicciones/) | [Reseña de Project Hail Mary](https://es.hollywoodreporter.com/critica-proyecto-hail-mary/) |
| `indiewire` | [Contendientes desde Cannes](https://www.indiewire.com/awards/industry/cannes-award-winners-reveal-2027-oscar-contenders-1235196043/) | [Predicciones para The Odyssey](https://www.indiewire.com/awards/predictions/the-odyssey-oscar-predictions-crafts-will-impress-academy-1235206635/) |
| `guardian` | [Reseña de The Odyssey](https://www.theguardian.com/film/2026/jul/15/the-odyssey-review-christopher-nolan-matt-damon) | [Reseña de Project Hail Mary](https://www.theguardian.com/film/2026/mar/10/project-hail-mary-review-ryan-goslings-charm-carries-unserious-last-ditch-space-mission) |
| `nytimes` | [Reseña de Project Hail Mary](https://www.nytimes.com/2026/03/19/movies/project-hail-mary-gosling-review.html) | [API de artículos](https://developer.nytimes.com/docs/articlesearch-product/1/overview) |
| `latimes` | [Reseña de The Odyssey](https://www.latimes.com/entertainment-arts/movies/story/2026-07-15/odyssey-review-christopher-nolan-matt-damon-anne-hathaway-tom-holland) | [Entrevista con Christopher Nolan](https://www.latimes.com/entertainment-arts/movies/story/2026-07-07/christopher-nolan-explains-how-he-made-the-odyssey-interview) |
| `washington-post` | [Ranking con The Odyssey](https://www.washingtonpost.com/entertainment/movies/2026/07/17/every-christopher-nolan-movie-ranked-including-odyssey/) | [Reseña de Disclosure Day](https://www.washingtonpost.com/entertainment/movies/2026/06/09/disclosure-day-is-spielbergs-beautiful-plea-all-us/) |
| `bbc-culture` | [Culture: Film & TV](https://www.bbc.com/culture/film-tv) | [Films to watch in 2026](https://www.bbc.com/culture/article/20251230-films-to-watch-in-2026) |
| `slant` | [Reseña de Project Hail Mary](https://www.slantmagazine.com/film/project-hail-mary-review-ryan-gosling-phil-lord-christopher-miller/) | [Archivo del crítico Jake Cole](https://www.slantmagazine.com/author/jcole/) |
| `little-white-lies` | [Reseña de The Odyssey](https://lwlies.com/reviews/the-odyssey-2) | [Reseña de Project Hail Mary](https://lwlies.com/reviews/project-hail-mary) |
| `film-stage` | [Reseña de The Odyssey](https://thefilmstage.com/the-odyssey-review-christopher-nolans-journey-of-perpetual-enervating-awe/) | [Reseña de Project Hail Mary](https://thefilmstage.com/project-hail-mary-review-sci-fi-buddy-picture-takes-time-to-soar/) |
| `screen-daily` | [Reseña de The Odyssey](https://www.screendaily.com/reviews/the-odyssey-review-matt-damon-leads-all-star-cast-in-christopher-nolans-towering-imax-adaptation-of-homers-epic-poem/5218632.article) | [Reseña de Project Hail Mary](https://www.screendaily.com/reviews/project-hail-mary-review-ryan-gosling-is-a-wise-cracking-hero-in-lord-and-millers-irreverent-sci-fi/5214641.article) |
| `empire` | [Ficha de The Odyssey](https://www.empireonline.com/movies/features/christopher-nolan-odyssey-everything-we-know/) | [Noticia de Project Hail Mary](https://www.empireonline.com/movies/news/martian-drew-goddard-hail-mary-ryan-gosling-phil-lord-chris-miller/) |
| `gold-derby` | [Portada Oscar](https://www.goldderby.com/c/film/oscars/) | [Newsletter](https://cloud.email.goldderby.com/newsletters/) |
| `next-best-picture` | [Predicciones Oscar](https://predictions.nextbestpicture.com/oscars) | [Balance de la primera mitad de 2026](https://nextbestpicture.com/oscar-potentials-from-the-first-half-of-2026/) |
| `awardswatch` | [Predicciones de julio](https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/) | [Predicciones de junio](https://awardswatch.com/2027-oscar-predictions-best-picture-and-best-director-june/) |
| `awards-daily` | [Predicciones del 4 de julio](https://www.awardsdaily.com/2026/07/04/2027-oscar-predictions-make-the-oscars-unpredictable-again/) | [Predicciones del 10 de julio](https://www.awardsdaily.com/2026/07/10/2027-oscar-predictions-isthe-odyssey-the-frontrunner/) |
| `awards-radar` | [Best Picture](https://awardsradar.com/best-picture/) | [Predicciones de mitad de año](https://awardsradar.com/2026/07/03/year-in-advance-oscar-predictions-considering-first-half-contenders-and-whats-to-come-as-we-enter-the-second-half-of-2026/) |
| `ankler` | [Predicciones tempranas](https://theankler.com/recklessly-early-oscar-predictions/) | [Predicciones finales](https://theankler.com/p/final-oscar-predictions-wholl-make) |

## Ampliación de fase 7.1

Estas cuatro fuentes amplían el inventario histórico de 31 candidatas sin
reescribir el corte de fase 1:

| ID | Fuente | Tipo | Cobertura y autoría | Método | Editorial | Técnico | Publicación | Riesgo principal |
|---|---|---|---|---|---|---|---|---|
| `midnight-critics` | Midnight Critics Circle | prediction | Consenso del círculo en ocho categorías y adicionales | HTML + captura | selected | automated | publishable | Errores tipográficos de colaboradores requieren matching conservador |
| `the-ringer` | The Ringer | prediction | Selección editorial de Mejor película | HTML + captura | selected | automated | publishable | No publica un ranking numérico comparable |
| `kalshi` | Kalshi | market | Contratos Oscar disponibles | API pública paginada | selected | automated | publishable | Puede no existir un mercado para una categoría |
| `polymarket` | Polymarket | market | Eventos y contratos Oscar disponibles | Gamma API pública | selected | automated | publishable | Preguntas y eventos requieren matching por proveedor |

| ID | Muestra 1 | Muestra 2 |
|---|---|---|
| `midnight-critics` | [Predicciones Oscar 2027](https://www.midnightcritics.com/predictions/2027-oscar-predictions) | [Archivo de predicciones](https://www.midnightcritics.com/predictions) |
| `the-ringer` | [Previa de Mejor película 2027](https://www.theringer.com/2026/03/20/oscars/oscars-2027-predictions-best-picture-movies-contenders) | [Archivo Oscar](https://www.theringer.com/topic/oscars) |
| `kalshi` | [Documentación de mercados](https://docs.kalshi.com/welcome) | [Paginación de mercados](https://docs.kalshi.com/getting_started/pagination) |
| `polymarket` | [Visión general de datos](https://docs.polymarket.com/market-data/overview) | [Listado de eventos](https://docs.polymarket.com/api-reference/events/list-events) |

## Puerta de calidad

Una candidata queda `selected` solo si cumple simultáneamente:

1. autoridad editorial o institucional identificable;
2. URL canónica y procedencia verificable, con autor y fecha cuando existan;
3. dos puntos de comprobación: al menos una observación representativa y otra
   muestra, archivo o documentación del método; para una fuente oficial anual,
   un archivo y una publicación oficial comprobables;
4. método de captura viable, aunque inicialmente sea manual;
5. un papel inequívoco que no mezcle crítica, predicción, usuarios y hechos
   oficiales.

Un paywall no excluye por sí solo: limita la captura a metadatos, enlace y
valores originales que puedan comprobarse. La selección tampoco implica que una
observación participe en un agregado.

## Segunda revisión de las 19 no seleccionadas

| Grupo | Fuentes | Decisión | Motivo |
|---|---|---|---|
| Festivales oficiales | Cannes, Venice, TIFF, Telluride | Seleccionar | Autoridad primaria, archivo o publicación oficial y método manual reproducible; solo evidencia de festival |
| Precursores oficiales | BAFTA, Golden Globes, Critics Choice | Seleccionar | Nominaciones y resultados atribuibles; requieren mapeo de categorías y no son predicciones |
| Industria y prensa general | The Hollywood Reporter, The New York Times, Los Angeles Times, The Washington Post, Screen Daily | Seleccionar | Crítica o predicción firmada, fechada y con URL canónica; los paywalls restringen campos, no la fiabilidad |
| Crítica independiente | Slant, Little White Lies, The Film Stage | Seleccionar | Cadencia estable, autoría visible y reseñas canónicas; escalas especiales se conservan sin inventar conversiones |
| Especialista de premios | The Ankler | Seleccionar | Predicciones firmadas y fechadas; solo se capturan selecciones o listas explícitas, no inferencias de podcasts |
| BBC Culture | Mantener `sampled` | Las muestras verifican autoridad, pero no dos reseñas comparables de la temporada ni una cadencia estable para el papel declarado |
| Empire | Mantener `paused` | Las dos muestras son noticia/ficha, no reseñas con nota; falta un método estable para descubrir el dato declarado |
| Gold Derby | Mantener `paused` | La interfaz dinámica mezcla editores, expertos y usuarios; no hay todavía una extracción verificable que preserve esa separación |

El resultado es un catálogo de 28 fuentes seleccionadas. La activación puede ser
gradual por coste de mantenimiento, pero no hay un máximo numérico: una nueva
fuente entra si supera la misma puerta. Festivales y precursores nunca sustituyen
las predicciones editoriales.
