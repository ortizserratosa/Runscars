# Identidad e IMDb de películas de festivales

Revisión de solo lectura del 7 de octubre de 2026. No se han importado
películas, cambiado candidaturas ni escrito datos en producción durante esta
investigación.

## Resultado verificable

Dos películas presentes en fuentes festivaleras tienen una identidad TMDB
corroborada por título y dirección, y un identificador IMDb de película:

| Película en la fuente | Crédito de dirección de la fuente | TMDB                                  | IMDb                                                 | Fuente festivalera                                                                                                                                       |
| --------------------- | --------------------------------- | ------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Common Story        | Anna Foglietta                    | 1597196, título original `Una storia` | [tt39307632](https://www.imdb.com/title/tt39307632/) | [TIFF, programación y descarga CSV](https://tiff.net/films?thumbnail), campo `Directors`                                                                 |
| Tear Gas              | Uta Beria                         | 1246509                               | [tt14987186](https://www.imdb.com/title/tt14987186/) | [Palmarès oficial de Locarno 79](https://www.locarnofestival.ch/dam/jcr:43be8be5-b5f4-4c0c-85d5-774e7ca025ad/Locarno79-Palmar%C3%A8s-ENG.pdf), página 11 |

La consulta de solo lectura de `films` en producción para estos dos títulos
devolvió cero filas. Ambos ejemplos permiten comprobar enlaces festivaleros sin
necesitar pertenencia al catálogo o a una temporada Oscar.

Las búsquedas TMDB completas de estos dos títulos devolvieron una página cada
una. `A Common Story` tiene dos candidatos con título exacto: el correcto de
Anna Foglietta y otro de Ekaterina Beloborodova, de 2019. `Tear Gas` tiene
cuatro; solo uno acredita a Uta Beria como director. Deben consultarse los
detalles de los candidatos exactos antes de exigir una identidad única. Exigir
un único título exacto antes de comprobar los créditos rechazaría ambos ejemplos
válidos.

Los valores originales, URL de cada consulta y fecha de captura están en
[festival-tmdb-identity-probes.json](festival-tmdb-identity-probes.json). El
identificador IMDb procede de `external_ids.imdb_id` de una película TMDB
corroborada; no se ha deducido de un resultado textual o de una búsqueda IMDb.
Las consultas TMDB no proporcionan fecha de publicación ni autor y se conservan
como `null`.

## Contrato de identidad

- Coincidencia exacta del título original, del título publicado o de una
  alternativa explícita procedente de la fuente o de `alternative_titles` de
  TMDB. La normalización de comparación debe conservar caracteres Unicode y
  dejar intacto el valor original. No traducir ni inventar alias.
- Comparar los créditos completos con `job = Director`. Cada director explícito
  en la fuente debe estar corroborado; un receptor de premio de interpretación
  no es un director. Las películas con créditos insuficientes quedan pendientes
  y pueden conservar su enlace a la fuente.
- Usar únicamente años de película explícitos en la fuente. El año de edición
  del festival, la temporada Oscar y el año de elegibilidad no son el año de la
  película. Si no hay año explícito, resolver por título y dirección sin filtro
  anual. Una fecha de estreno no equivale automáticamente a año de producción.
  En la integración revisada, título y dirección determinan la identidad y el
  año se conserva como contraste contextual: un año de producción 2025 y un
  estreno TMDB de 2026 pueden referirse a la misma película. Por ese motivo la
  búsqueda no aplica un filtro de estreno basado en el año de producción.
- Evaluar todos los candidatos relevantes dentro del límite declarado de
  solicitudes. Si queda una página sin consultar o un candidato sin comprobar,
  no afirmar unicidad. El ejemplo `17` tiene 59 páginas sin filtro y dos con el
  año de película explícito 2026; esta investigación consultó la primera página
  y no usa ese ejemplo como prueba completa de unicidad.
- Conservar la prueba del enlace separada del emparejamiento editorial con
  `films`. Un `film_id` previamente asignado solo por título no demuestra por sí
  mismo la identidad de la entrada festivalera.
- Construir la URL IMDb solo desde un ID válido de película `tt` seguido de
  dígitos. Un `nm` de persona, URL arbitraria o ID ausente no produce enlace.
- El enriquecimiento es metadato de la entrada del festival. No crea
  candidaturas, predicciones, resultados Oscar ni pertenencia a temporadas.

## Calidad de los créditos disponibles

El suplemento revisado conserva director en las 149 selecciones de Berlinale,
las 206 de TIFF y las 76 de Cannes. En Berlinale `countryAndYear` incluye 2025 y
varios años anteriores, además de 2026. En TIFF `originalRecipient` coincide con
el campo explícito `Directors`; no se conserva un año de película explícito.
Cannes conserva la línea original `by` con el director.

La selección parcial de Locarno contiene 63 entradas y no conserva dirección en
`originalRecipient`. No se puede cubrir automáticamente esa selección solo con
sus nombres. Se han preparado 22 identidades oficiales con dirección explícita
para las películas representadas en los 31 premios actuales, en
[locarno-film-identity-evidence.json](locarno-film-identity-evidence.json). La
evidencia identifica los créditos, la página y el hash de la captura PDF; no
contiene IDs IMDb supuestos. Por ejemplo, el director de `Ketticè` es Giovanni
Tortorici; Monica Bellucci es la receptora del premio de interpretación. En
`Violence du corps de l'autre` el director es Denis Côté, mientras que Xavier
Bergeron es el intérprete premiado. Los años de producción permanecen `null`
cuando la fuente no los da.

## Reutilización del código y secretos

`supabase/functions/_shared/ingestion/tmdb-expansion.mjs` ya consulta detalles
con `credits,external_ids` y obtiene `imdb_id`, pero su regla se diseñó para
ampliar predicciones Oscar: filtra por elegibilidad de la temporada y exige un
candidato único antes de los créditos. Reutilizar su política sin adaptarla
excluiría películas festivaleras correctas. Tampoco se debe reutilizar el
recorte de 30 créditos como prueba completa de dirección.

`web/src/lib/tmdb/catalog.mjs` tiene cliente y snapshots útiles como referencia,
pero sus imports Node y su verificación de elegibilidad no deben trasladarse
directamente a la función Edge festivalera. La función Edge puede usar el
cliente `fetch` servidor existente y conservar respuestas necesarias para la
prueba. `TMDB_READ_ACCESS_TOKEN` existe localmente y se ha usado únicamente en
el servidor, sin imprimirlo ni guardarlo en las evidencias. El runner de
festivales debe recibir el secreto desde el entorno servidor si programa este
enriquecimiento.

La API primaria de TMDB documenta
[búsqueda por títulos originales, traducidos y alternativos y filtros anuales opcionales](https://developer.themoviedb.org/reference/search-movie),
[consulta posterior de detalles](https://developer.themoviedb.org/docs/search-and-query-for-details),
[créditos de película](https://developer.themoviedb.org/reference/movie-credits)
y
[IDs externos de película, incluido IMDb](https://developer.themoviedb.org/reference/movie-external-ids).
Estas consultas aportan identidad cinematográfica; no aportan elegibilidad ni
resultados Oscar.

## Comprobación de la integración

El resolver nuevo se ejecutó contra TMDB en modo de solo lectura para los dos
ejemplos de la tabla. Confirmó `A Common Story` con `1597196 / tt39307632` y
`Tear Gas` con `1246509 / tt14987186` después de comprobar sus candidatos. No se
persistieron esas resoluciones durante la revisión.

La revisión del core y de la migración corrigió colisiones de normalización de
texto no latino, añadió claves no vacías y límites de tiempo de red y reforzó
los IDs obligatorios de una identidad confirmada. La unicidad se comprueba antes
de exigir IMDb: un segundo candidato exacto sin ID IMDb sigue siendo una
ambigüedad. El historial se mantiene privado e inmutable, la vista filtra
fuentes retiradas y recibos que dejaron de estar vigentes y un duplicado o
resultado pendiente no reactiva un enlace antiguo ni altera el catálogo Oscar.

## Límites de la revisión

Se han investigado cinco consultas, cuatro películas distintas y sus candidatos
exactos visibles, además de los créditos oficiales de las 22 películas premiadas
en Locarno. Esto verifica ejemplos y reglas de identidad; no demuestra cobertura
IMDb total de los festivales. Las nuevas importaciones deben seguir siendo
idempotentes, conservar entradas bloqueadas inmutables y registrar una prueba o
corrección separada para cada enlace confirmado.
