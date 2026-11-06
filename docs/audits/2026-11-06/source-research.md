# Auditoría independiente de las fuentes originales — 2026-11-06

## Alcance y evidencia

Lectura de las fuentes primarias mediante HTTPS ordinario y contraste con los
extractores versionados en el repositorio. Captura de comprobación:
`2026-11-06T13:33:06.477Z`. No se han ejecutado importaciones ni escrituras en
la base de datos. La configuración usada es la de
`web/scripts/audit-production.mjs`, no una comprobación de la configuración
remota. El [recibo de extracción](live-source-extraction.json) conserva autor,
URL, fechas originales, categorías, posiciones y valores originales mínimos.

La extracción actual de las fuentes no sustenta una primera posición de Dune:
Part Three en Mejor película. En los cinco rankings completos fechados o
reconocibles del núcleo actual aparece en los puestos 2, 4, 5, 6 y 8; ninguno la
sitúa primera. Esto demuestra una discrepancia con ese resultado, pero por sí
solo no identifica el estado histórico exacto de la base que lo produjo.

## Mejor película: original frente al extractor actual

Las primeras cinco posiciones solo se llaman puestos cuando existe evidencia de
orden. Las selecciones se describen como conjuntos y no como puestos.

| Fuente y voz                                                                                                                          | Fecha editorial/evidencia visible                                                       | Primeras cinco posiciones del original                                                                                           | Dune                                                              | Semántica y resultado del conector                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Awards Radar](https://awardsradar.com/best-picture/)                                                                                 | Actualización explícita 05-11-2026                                                      | The Odyssey; You Can See Everything; La bola negra; Wild Horse Nine; Project Hail Mary                                           | #8 de 50                                                          | Ranking numerado. `awards-radar-v6`: correcto; ocho categorías, 190 observaciones.                                                                                                                                                                                               |
| [Variety / Clayton Davis](https://variety.com/lists/2027-oscars-best-picture-predictions/)                                            | `Updated Nov. 5, 2026` del dataset                                                      | The Odyssey; Dune: Part Three; You Can See Everything; La Bola Negra; Wild Horse Nine                                            | #2 de 40                                                          | Ranking con columna Rank. Picture correcto; dataset público [BBZ0P/21](https://datawrapper.dwcdn.net/BBZ0P/21/dataset.csv). Dos conectores de guion fallan por cambio de columnas.                                                                                               |
| [Next Best Picture / Matt Neglia](https://predictions.nextbestpicture.com/u/655756da85df4c0efaa10bd2/oscars)                          | Bloque visible `Nov 4`; sin año completo ni fecha editorial estable usada por el parser | La Bola Negra; The Odyssey; Wild Horse Nine; You Can See Everything; Dune: Part Three                                            | #5 de 10 visibles                                                 | Ranking explícito. `next-best-picture-v3`: correcto. Publicación nula intencionada; la frescura depende de la primera captura persistida de la secuencia con la misma lista, no del reloj del sitio.                                                                             |
| [The Ankler / Christopher Rosen](https://anklerpundits.com/pundit/christopher-rosen/)                                                 | Actualización explícita 03-11-2026 para película                                        | The Odyssey; La Bola Negra; You Can See Everything; Wild Horse Nine; I Play Rocky                                                | #6 de 10                                                          | Ranking numerado individual. `ankler-rosen-v1`: correcto; ocho publicaciones por categoría, 45 observaciones. El aviso genérico de próximas predicciones convive con los bloques ya publicados y fechados.                                                                       |
| [The Rolling Tape / Danny Jarabek](https://therollingtape.com/danny-jarabek-oscar-predictions/)                                       | API editorial de película: `2026-11-03T17:40:16+00:00`                                  | The Odyssey; La Bola Negra; The Invite; Dune: Part Three; All of a Sudden                                                        | #4 de 20                                                          | Ranking numerado individual en [API pública](https://therollingtape.com/wp-json/op/v1/predictors/danny-jarabek). `rolling-tape-jarabek-v1`: correcto; 90 observaciones. Cada categoría conserva su propia fecha.                                                                 |
| [AwardsWatch / Erik Anderson](https://awardswatch.com/2027-oscar-predictions-best-picture-and-best-director-october/)                 | Publicación 16-10-2026, `16:07:08Z`                                                     | Sin puestos acreditados: selección de diez títulos en la columna de Erik, incluidos La Bola Negra, The Odyssey y Wild Horse Nine | Incluida entre los diez; no tiene puesto acreditado               | Tabla de cuatro autores sin numeración ni declaración explícita de clasificación. `awardswatch-multicategory-v8` conserva una sola voz y la clasifica como selección. No convertir una fila visual en un rango.                                                                  |
| [Awards Daily / Sasha Stone](https://www.awardsdaily.com/2026/10/30/2027-oscar-predictions-you-can-see-everything-and-the-hive-mind/) | Publicación 30-10-2026                                                                  | The Odyssey; I Play Rocky; Project Hail Mary; Fjord; The Invite                                                                  | Solo entre alternativas (`Dune III`), fuera de los diez previstos | **Defecto semántico:** v9 devuelve selección aunque el párrafo inmediatamente anterior declara el orden por fortaleza. Hay base para clasificar la lista de película como ranking, conservando esa evidencia. No extender automáticamente la declaración a las demás categorías. |
| [Midnight Critics Circle](https://www.midnightcritics.com/predictions/2027-oscar-predictions)                                         | Sin fecha editorial propia verificable                                                  | Wild Horse Nine; La Bola Negra; The Odyssey; Project Hail Mary; Digger                                                           | #8 de 15                                                          | Ranking numerado de consenso. `midnight-critics-v2`: correcto, 150 observaciones. No se puede deducir vigencia a partir de esta consulta: comprobar la frescura persistida por categoría. Colaboradores no son votos independientes.                                             |
| [The Movie State / Ben Sears](https://themoviestate.com/2026/09/14/2027-oscar-predictions/)                                           | Publicación 14-09-2026; 53 días al auditar                                              | The Odyssey; La Bola Negra; Wild Horse Nine; You Can See Everything; The Debut                                                   | #6 de 10                                                          | Original declara ranking. **Conector fallido:** una comilla tipográfica de cierre incorrecta rompe dirección. Aunque se repare, la publicación sigue vencida con la regla actual; una modificación CMS no la rejuvenece.                                                         |
| [The Ringer](https://www.theringer.com/2026/03/20/oscars/oscars-2027-predictions-best-picture-movies-contenders)                      | Publicación 20-03-2026                                                                  | Selección de tres: The Odyssey, Dune: Part Three y Disclosure Day                                                                | Incluida sin puesto                                               | `the-ringer-v2`: extracción correcta de tres selecciones. Vencida, sin voto ni cobertura actuales; no usar actividad editorial posterior para actualizar este artículo.                                                                                                          |

## Fallos de extracción reproducidos

Se ejecutaron los 17 conectores profesionales configurados en la auditoría
versionada, incluyendo los ocho de Variety. Catorce superaron la validación de
listas ordenadas y categorías requeridas. Tres fallaron de forma reproducible:

1. `variety-original-screenplay-predictions`: el CSV actual
   [a5kl2/16](https://datawrapper.dwcdn.net/a5kl2/16/dataset.csv) añade una
   quinta columna `Type` a `Rank,Film,Writer(s),Distributor`. El parser exige
   exactamente las cuatro columnas anteriores y responde
   `Variety: columnas no reconocidas`.
2. `variety-adapted-screenplay-predictions`: el CSV actual
   [ajt7v/15](https://datawrapper.dwcdn.net/ajt7v/15/dataset.csv) añade una
   quinta columna sin nombre. El parser responde el mismo error. Una columna sin
   nombre solo puede ignorarse si todos sus valores son vacíos; una columna
   nueva con contenido requiere una interpretación explícita, no truncamiento
   silencioso.
3. `movie-state-predictions`: el original de dirección escribe la película Wild
   Horse Nine entre dos comillas iniciales `“`, en lugar de una inicial y una
   final. El regex de `parts()` solo acepta cierre `”` o `"` y responde
   `The Movie State: candidatura ambigua en directing`. El mismo defecto aparece
   en otras filas con ese enlace. La reparación debe conservar el valor original
   y aceptar delimitación inequívoca sin abrir matching aproximado.

El defecto semántico de Awards Daily no provoca un error técnico: las 80
observaciones pasan validación aunque la lista de película pierda su información
ordinal. Evidencia textual mínima: “For now, I’m ordering these by which films I
think are strongest”. La declaración pertenece al contexto inmediato de Mejor
película; es insuficiente para asignar posiciones a todo el artículo.

## Comprobación aritmética independiente

Aplicando únicamente la fórmula v4 de película, `K=20`, a los cinco rankings
actuales de Radar, Variety, NBP, Ankler y Rolling Tape, sin matching ni
consultas remotas, los puntos resultan: The Odyssey 99/100; La Bola Negra
93/100; Wild Horse Nine 82/100; Dune 80/100. Con esa superficie Dune ocupa el
cuarto puesto y nunca el primero. Es una comprobación de los hechos extraídos,
**no** una reconstrucción del consenso público: no comprueba frescura
persistida, catálogo, selecciones ni otros rankings activos.

Si la lista declarada por Awards Daily se reconoce como ranking, las seis voces
dan a Odyssey `119/120` y a Dune `80/120`; Dune pasa al séptimo puesto. Este
cálculo también es condicional y no acredita por sí solo un despliegue o una
reparación del historial público.

## Revisión crítica de la barrera de completitud

La lectura agregada filtra actualmente a observaciones publicadas y con
matching, mientras que `persistBatch()` guarda primero la captura y después sus
observaciones con concurrencia. Un fallo intermedio puede dejar una revisión
visible con solo una fracción de sus filas originales. Validar el ranking
extraído antes de persistir no demuestra que su persistencia terminara.

La barrera debe comprobar el conjunto **persistido** de una revisión y categoría
contra el manifiesto completo extraído. Debe incluir las filas `pending_review`:
estas prueban que la fuente sí publicó la candidatura, aunque todavía no pueda
entrar en el consenso. No exigir que el número de filas publicadas sea igual a
la longitud original: D-073 permite huecos de matching conservando los puestos.
Tampoco exigir veinte puestos por película: NBP y Ankler publican diez y la
ventana K no amplía la lista original.

Filtrar únicamente `run_id` por ejecución exitosa tampoco basta. La
deduplicación puede reutilizar observaciones insertadas por un intento fallido y
mantener su `run_id` original. Un reintento exitoso debe poder certificar ese
mismo conjunto completo; un intento posterior fallido no debe invalidar una
revisión ya certificada. La unidad de activación necesita ser la
revisión/captura completa, con sus categorías e identidades originales, o una
persistencia transaccional equivalente. Los conteos deben acompañarse de
identidad de filas o hash para no confundir duplicados con filas faltantes.

La lectura del snapshot debe evitar la carrera entre guardar captura y terminar
observaciones. Debe elegir el último conjunto completo válido de cada fuente y
categoría, conservando su frescura original. Un fallo de una fuente no debe
bloquear a las demás. Los intentos incompletos y sus errores deben seguir
auditables y no presentarse como ausencias editoriales. El caso de selección
también necesita manifiesto de filas: sus observaciones no tienen `list_length`.

Si se cambia el tratamiento de los huecos **editoriales** de matching —por
ejemplo, excluir una fuente completa cuando queda una candidatura sin resolver—,
es una decisión metodológica nueva. No debe introducirse como consecuencia
silenciosa de reparar una escritura parcial. Los snapshots bloqueados se
preservan; cualquier corrección histórica debe crear versión o registro de
corrección.

## Pendientes y límites reales

- Contrastar la configuración versionada con la remota, y los estados de las
  ejecuciones históricas que sustentaron el resultado cuestionado.
- Comprobar edad persistida por categoría de NBP y Midnight. La consulta de hoy
  no prueba cuándo cambiaron sus listas.
- Reparar los tres cambios de formato con fixtures reproducibles, confirmar el
  tratamiento ordinal de Awards Daily y repetir únicamente los conectores
  afectados.
- Verificar la barrera con fallo después de una fila, reintento con dedupe,
  captura ya completa seguida de intento fallido, pendientes editoriales
  legítimos y selecciones sin longitud ordinal.
- No se verificó ninguna identidad TMDB ni se alteró matching. Las erratas
  publicadas se conservan y los originales pueden contener errores del medio.

## Verificación de este informe

Lectura de AGENTS, producto, metodología, decisiones, fuentes y auditorías
previas; inspección de los originales; ejecución de parsers sin persistencia;
validación completa de listas y categorías de las 14 extracciones correctas;
comprobación aritmética independiente. Ningún secreto se ha guardado en los
recibos. El recibo inicial corresponde al código previo a las reparaciones de
esta tarea y debe conservarse como evidencia de los fallos.
