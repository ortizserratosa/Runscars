# Registro de fuentes

**Estado:** fase 8.5 cerrada; fuentes públicas derivadas de datos reales
**Última revisión:** 2026-08-10

## 1. Objetivo

Mantener un inventario único de fuentes, su utilidad editorial, el método de
obtención y su preparación para una eventual publicación.

Durante el prototipo personal, una duda de publicación no bloquea el análisis
técnico. Sí debe quedar registrada para poder desactivar o sustituir la fuente
antes de publicar.

## 2. Tipos de fuente

- `metadata`: fichas de películas, personas e imágenes.
- `official`: reglas, nominaciones, ganadores y calendarios.
- `score`: puntuaciones de críticos o medios.
- `prediction`: rankings de nominaciones o ganadores.
- `review`: reseñas y extractos enlazables.
- `festival`: selecciones, premios y proyecciones.
- `market`: contratos y precios de mercados de predicción.

Una fuente puede tener más de un tipo, pero cada conector debe declarar qué datos
usa realmente.

## 3. Métodos de incorporación

Orden de preferencia:

1. API documentada;
2. RSS o feed oficial;
3. exportación estructurada;
4. introducción manual asistida;
5. extracción de HTML.

El método más automático no siempre es el más apropiado. Se valorarán
estabilidad, trazabilidad y coste de mantenimiento.

## 4. Estados

### Estado editorial

- `candidate`: descubierta, no evaluada.
- `sampled`: se han guardado ejemplos.
- `selected`: supera la puerta de calidad y puede incluirse en el alcance actual.
- `paused`: temporalmente desactivada.
- `rejected`: descartada con motivo.

`selected` no significa que la fuente esté activa en todos los snapshots ni que
aporte un voto profesional. La activación pertenece a cada importación y
snapshot, y el tipo de observación decide si participa en un agregado.

El índice público no enumera candidatas sin datos: muestra fuentes presentes en
el corte profesional vigente o con observaciones críticas publicadas. La ficha
de cada fuente deriva publicaciones, capturas, valores originales y categorías
de las tablas persistidas; no conserva una captura de ejemplo como estado
actual.

### Estado técnico

- `manual`;
- `prototype`;
- `automated`;
- `failing`;
- `retired`.

### Estado de publicación

- `not-reviewed`;
- `review-before-publish`;
- `publishable`;
- `replace-before-publish`.

El estado de publicación es un registro de proyecto, no asesoramiento jurídico.

## 5. Campos obligatorios por fuente

| Campo | Descripción |
|---|---|
| ID | Identificador estable interno |
| Nombre | Nombre público |
| Tipo | Uno o más tipos definidos arriba |
| URL principal | Página canónica |
| Cobertura | Temporadas y categorías |
| Autoría | Medio, experto o ambos |
| Frecuencia | Esperada o desconocida |
| Método | API, RSS, manual o HTML |
| Ejemplos | Al menos dos URLs en fase 1 |
| Paywall | Ninguno, parcial o completo |
| Última revisión | Fecha |
| Estado editorial | Estado actual |
| Estado técnico | Estado actual |
| Estado publicación | Estado actual |
| Notas | Riesgos, límites y decisiones |

## 6. Resultado del discovery

La [matriz de fase 1](SOURCE_MATRIX.md) documenta 31 candidatas con tipo,
cobertura, autoría, frecuencia, método, paywall, estados, riesgos y dos muestras
verificables por fuente. Tras una segunda revisión, 28 superan la puerta de
calidad y forman el catálogo elegible del MVP; pueden activarse gradualmente.

### Núcleo seleccionado en el primer corte

| ID | Papel | Método viable inicial | Evolución prevista | Publicación |
|---|---|---|---|---|
| `tmdb` | Metadatos | API documentada | Conector automático | publishable |
| `academy` | Reglas y resultados | Manual asistido de HTML/PDF oficial | Importador oficial versionado | publishable |
| `rotten-tomatoes` | Agregado crítico contextual | Pausado; captura privada | Requiere permiso o licencia antes de volver a publicar | review-before-publish |
| `metacritic` | Agregado crítico contextual | Pausado; captura privada | Requiere permiso o licencia antes de volver a publicar | review-before-publish |
| `filmaffinity` | Discovery de críticas profesionales y ficha contextual | Pausado; captura privada | Requiere permiso o licencia; no importar su valoración comunitaria | review-before-publish |
| `roger-ebert` | Reseñas y notas individuales | RSS para descubrir + revisión manual | Conector RSS con fixture | review-before-publish |
| `guardian` | Reseñas y notas individuales | Content API + revisión editorial | Conector API con fixture | review-before-publish |
| `variety` | Predicciones y reseñas | RSS/HTML para descubrir + captura manual | Prototipo solo si la revisión lo permite | review-before-publish |
| `indiewire` | Predicciones y reseñas | RSS/HTML para descubrir + captura manual | Prototipo solo si la revisión lo permite | review-before-publish |
| `next-best-picture` | Predicciones de equipo | HTML estructurado + captura fechada | Prototipo idempotente | review-before-publish |
| `awardswatch` | Predicciones de autor | HTML + captura fechada | Prototipo idempotente | review-before-publish |
| `awards-daily` | Predicciones de autor | HTML + captura fechada | Prototipo idempotente | review-before-publish |
| `awards-radar` | Predicciones editoriales | HTML + captura fechada | Prototipo idempotente | review-before-publish |

### Fuentes admitidas en la segunda revisión

| ID | Papel permitido | Método viable inicial | Límite de uso | Publicación |
|---|---|---|---|---|
| `cannes` | Selección y palmarés de festival | Web oficial/manual | Evidencia contextual; no predicción | review-before-publish |
| `venice` | Selección y premios de festival | Web oficial/manual | Evidencia contextual; revisar cambios de título | review-before-publish |
| `tiff` | Selección y premios de festival | Notas oficiales/manual | Unificar anuncios de varias páginas | review-before-publish |
| `telluride` | Programa oficial | Web oficial/manual | Activar cuando se publique el programa | review-before-publish |
| `bafta` | Nominaciones y resultados | Web oficial/manual | Precursor factual; mapear categorías | publishable |
| `golden-globes` | Nominaciones y resultados | Web oficial/manual | Precursor factual; no equiparar categorías | review-before-publish |
| `critics-choice` | Nominaciones y resultados | Web oficial/manual | Precursor factual; fijar edición | review-before-publish |
| `hollywood-reporter` | Predicciones y reseñas | RSS/HTML + manual | Resolver canonical regional antes de importar | review-before-publish |
| `nytimes` | Reseñas | Article Search API + manual | Solo metadatos, enlace y valor verificable | review-before-publish |
| `latimes` | Reseñas | RSS/manual | Solo metadatos y enlace bajo paywall | review-before-publish |
| `washington-post` | Reseñas y notas | RSS/manual | No guardar cuerpo; nota solo si es visible | review-before-publish |
| `slant` | Reseñas y notas | RSS/HTML + manual | No inferir nota desde un recurso gráfico | review-before-publish |
| `little-white-lies` | Reseñas y tres subnotas | RSS/HTML + manual | Conservar componentes; no sintetizar promedio | review-before-publish |
| `film-stage` | Reseñas | RSS/HTML + manual | Sin nota numérica salvo valor explícito | review-before-publish |
| `screen-daily` | Reseñas | RSS/manual | Metadatos y enlace si la pieza queda tras paywall | review-before-publish |
| `ankler` | Predicciones firmadas | Newsletter/manual | Solo listas o selecciones explícitas | review-before-publish |

`Rotten Tomatoes` y `Metacritic` no aportan votos a la media Runscars: sus
agregados se conservan como contexto según D-012. La selección incluye
deliberadamente fuentes manuales; el contrato del MVP exige tres conectores al
final de la fase 5, no en el discovery.

### Cobertura profesional

- **Puntuaciones individuales:** Guardian, RogerEbert.com, IndieWire, Slant,
  Little White Lies y The Washington Post cuando el valor original sea
  verificable. Las escalas especiales no se convierten sin regla aprobada.
- **Agregados contextuales:** Rotten Tomatoes y Metacritic; no aportan votos.
- **Predicciones:** Variety, The Hollywood Reporter, IndieWire, Next Best
  Picture, AwardsWatch, Awards Daily, Awards Radar y The Ankler.
- **Reseñas:** RogerEbert.com, Guardian, Variety, The Hollywood Reporter,
  IndieWire, The New York Times, Los Angeles Times, The Washington Post, Slant,
  Little White Lies, The Film Stage y Screen Daily.
- **Apoyo, no señal profesional:** TMDB; Academy; Cannes, Venice, TIFF y
  Telluride; BAFTA, Golden Globes y Critics Choice.

## 7. Estrategia concreta de conectores

El primer conector quedó implementado en la fase 4:

1. **TMDB API:** búsqueda y detalle de película/persona con token Bearer solo en
   el importador; ID externo, snapshots locales de 180 días, imágenes,
   atribución y correcciones auditables. La web no llama a TMDB durante una
   visita y nunca importa sus votos como señal Oscar.

Prioridad para los primeros conectores profesionales de la fase 5:

1. **Guardian Content API:** descubrir reseñas, autoría, fecha, URL y
   puntuación cuando esté estructurada; almacenar enlace y metadatos, no el
   cuerpo completo. La ejecución automática se limita dinámicamente a títulos
   principales o alternativos del catálogo de la temporada.
2. **RSS de RogerEbert.com:** descubrir publicaciones y luego exigir revisión
   editorial del matching y de la nota visible en la página canónica.

Cada conector usará fixtures guardados, una clave idempotente formada por
`source_id + publication_id + film_id + data_type`, captura aislada por fuente
y cola de revisión para coincidencias dudosas.

3. **AwardsWatch Best Picture:** tabla HTML ordenada con publicación, autor,
   fecha, URL, categoría e intención explícitas. El fixture reproduce la
   estructura verificada de la publicación de junio de 2026.

Los tres conectores y la importación manual idempotente quedaron implementados
en la fase 5. Guardian, RogerEbert y AwardsWatch están activos en la tarea
diaria; la API key de Guardian se mantiene únicamente como secreto de servidor.
Variety, IndieWire y Awards Daily empiezan manuales. La ampliación a 28 fuentes
no cambia esta prioridad: las nuevas fuentes se incorporarán por lotes, cada una
con fixture y revisión de publicación.

La fase 7 añade una importación manual separada para la Academy. Nominaciones y
ganadores se guardan como resultados oficiales, nunca como predicciones, con
URL, publicación, captura, valor original, hash y versión inmutable. El fixture
solo prueba el contrato y está rotulado como no real.

### Conectores automáticos de la fase 7.1

| Fuente | Cobertura real validada el 2026-07-25 | Tratamiento |
|---|---|---|
| AwardsWatch | Película, dirección y cuatro categorías interpretativas | Ranking ordenado |
| Awards Daily | Ocho públicas y categorías adicionales | Ranking ordenado |
| Awards Radar | Ocho públicas | Ranking ordenado |
| Next Best Picture | Ocho públicas y categorías adicionales | Un consenso del medio |
| Midnight Critics Circle | Ocho públicas y categorías adicionales | Un consenso del medio |
| The Ringer | Mejor película | Selección sin Borda |

Cada adaptador conserva captura original, hash, publicación, URL, autor cuando
existe, fecha, versión e idempotencia. La última publicación elegible se conserva
por fuente, categoría e intención. La cobertura efectiva es de cinco rankings
ordenados en las seis categorías que cubre AwardsWatch y cuatro en los dos
guiones; Best Picture suma una sexta fuente como selección.

La frescura pública separa tres instantes: publicación activa, último cambio
efectivo que alteró un corte y última comprobación correcta del conector. Un
fallo posterior al último éxito se muestra como incidencia sin exponer el error
interno ni retirar automáticamente el último dato verificable.

Desde el 2026-07-25 ningún conector profesional depende de una publicación fija
como estado actual:

- Awards Daily consulta en cada run su búsqueda WordPress de predicciones 2027
  y conserva la combinación mínima de publicaciones que aporta la lista más
  reciente de cada categoría; el corte verificado más nuevo es del 31 de julio
  de 2026 y contiene las ocho categorías públicas.
- Awards Radar consulta sus ocho páginas de categoría, cuyo ranking visible
  indica actualización del 20 de julio de 2026.
- AwardsWatch descubre por archivo la publicación más reciente de cada
  categoría.
- Next Best Picture y Midnight Critics versionan por contenido sus páginas
  vivas.
- The Ringer consulta su archivo de Oscar y conserva la selección 2027 más
  reciente.

Una misma URL actualizable puede generar varias revisiones inmutables
identificadas por contenido. Un run sin cambios no crea observaciones nuevas y
deja un evento explícito `source.unchanged`.

El mantenimiento del 2026-08-07 acotó Awards Daily al cuerpo editorial,
descartó sus filas `Alt.` y separó `Makeup and Hair` de vestuario. Las
coincidencias dudosas siguen requiriendo revisión; las identidades verificadas
de `Rose`, `Ink`, `Elsinore` y `Possible Love` se documentan en un manifiesto y
se aplican mediante migraciones TMDB trazables.

Kalshi y Polymarket usan sus API públicas en un proceso horario independiente.
Kalshi consulta las series 2027 de nominación y ganador de cada categoría
pública; Polymarket selecciona únicamente eventos activos rotulados como Oscar
2027. Los extractores v3 descartan contratos sin categoría pública, conservan
el payload identificativo una vez por contrato y crean una captura solo cuando
cambia la señal efectiva de precio. Sus estados son append-only y no comparten
tablas ni agregadores con las predicciones profesionales. El archivo Academy
2026 usa un manifiesto oficial v2 idempotente con las ocho categorías; no
reconstruye predicciones históricas.

## 8. Dataset de prueba

El [dataset de fase 1](../data/phase-1/README.md) contiene:

- 20 películas de la temporada Oscar 2027;
- 69 observaciones: 48 posiciones o selecciones de predicción, 14 reseñas, 2
  puntuaciones individuales y 5 agregados críticos contextuales;
- cuatro listas ordenadas completas de Best Picture y una selección no
  ordenada;
- valor original, URL, publicación, autor cuando se pudo confirmar, fecha de
  publicación, instante de captura, versión de extracción y participación.

Una misma reseña puede generar una observación `review` y otra
`score_individual`; no son dos votos. Los campos desconocidos están vacíos y
ninguna fecha, nota o posición se estima.

## 9. Puerta de salida de la fase 1

- [x] 31 fuentes candidatas documentadas.
- [x] Dos ejemplos verificables para las 31 candidatas.
- [x] 28 fuentes seleccionadas mediante una puerta de calidad explícita.
- [x] Las 3 restantes conservan un motivo verificable para no seleccionarlas.
- [x] Cobertura separada de puntuaciones, predicciones y reseñas.
- [x] Estrategia manual o automática para cada seleccionada.
- [x] Dataset verificable de 20 películas con observaciones de los tres tipos.
- [x] Propuesta de tres conectores prioritarios y segunda oleada.

## 10. Riesgos abiertos

- `rotten-tomatoes`, `metacritic` y `filmaffinity` están pausadas y
  `review-before-publish` tras la revisión de lanzamiento de 2026-08-26. Sus
  capturas y enlaces de descubrimiento son privados hasta contar con permiso o
  licencia compatible. La señal crítica individual solo puede publicarse desde
  el medio original si esa fuente supera su propia revisión.
- El Content API de Guardian necesita clave y respeto de sus condiciones.
- El HTML de AwardsWatch puede cambiar; el conector falla de forma aislada y
  exige actualizar el fixture antes de aceptar una nueva estructura.
- AwardsWatch todavía no ha publicado páginas 2027 de guion en su archivo. Los
  dos guiones cumplen el mínimo con cuatro medios, pero el objetivo inicial de
  cinco permanece abierto hasta que exista una quinta publicación verificable o
  se apruebe una sustituta automatizable.
- The New York Times, The Washington Post y The Ankler tienen paywall completo:
  Runscars solo guardará metadatos, enlaces y valores que pueda verificar.
- Las tres subpuntuaciones de Little White Lies no forman una nota única sin una
  decisión metodológica posterior.
- Festivales y precursores necesitan entidades y mapeos propios; no pueden
  introducirse como predicciones de expertos.
- Los extractores HTML deben probarse con fixtures y detectar cambios de
  estructura; nunca se ejecutarán en pruebas contra la web real.
- BBC Culture sigue `sampled`; Empire y Gold Derby siguen `paused` hasta superar
  la misma puerta de calidad técnica y semántica.
- D-014 sigue como `Propuesta`: la fase 1 no decide el consenso de rankings
  parciales de usuarios.
