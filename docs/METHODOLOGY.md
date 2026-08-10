# Metodología

**Estado:** agregación, snapshots y evaluación profesional operativos
**Última revisión:** 2026-08-07

## 1. Principios

1. Mostrar el valor original antes que la transformación.
2. Separar recepción, predicción y comunidad.
3. Favorecer métricas comprensibles frente a una fórmula opaca.
4. Dar el mismo peso inicial a cada fuente profesional.
5. Conservar procedencia y versiones.
6. No completar datos ausentes mediante estimaciones automáticas.

## 2. Unidad de observación

Toda observación externa guardará:

- fuente;
- publicación y URL;
- autor o experto cuando exista;
- fecha de publicación;
- fecha y hora de captura;
- temporada;
- candidatura canónica, categoría, película u obra y personas ordenadas;
- tipo de dato;
- valor y escala originales;
- valor normalizado cuando proceda;
- versión del extractor;
- estado: pendiente, publicada, corregida o excluida.

El contenido capturado no se sobrescribe. Una corrección enlaza la observación
original con la corregida.

Desde la fase 5, la publicación y su captura se identifican por claves e hashes
estables. El matching automático solo acepta una coincidencia exacta contra el
título principal o alternativo de la temporada. Una coincidencia ausente o
ambigua deja la observación pendiente, sin participación, y genera revisión
editorial. Desde la fase 7.1, una película solo se resuelve automáticamente
cuando título o alias y temporada producen una coincidencia única; las personas
se resuelven únicamente dentro de sus créditos. Si TMDB confirma de forma
inequívoca una película ausente, el importador incorpora película, personas y
créditos antes de reintentar. Una observación pendiente nunca participa.

La identidad `CategoryCandidate` combina temporada, categoría, película u obra y
el conjunto de personas. El conjunto identifica la candidatura y su orden
conserva cómo se presenta el equipo. Así pueden coexistir dos intérpretes de la
misma película, una persona con varias películas y equipos de dirección.

### 2.1 Elegibilidad de una fuente

El catálogo no tiene un máximo numérico. Una fuente solo se selecciona si tiene
autoridad identificable, procedencia canónica, una observación representativa
más un segundo punto de comprobación, un método de captura viable y un papel que
no mezcla señales. Para una fuente anual oficial sirven su archivo y una
publicación oficial. La puerta completa se documenta en
[SOURCE_MATRIX.md](SOURCE_MATRIX.md).

La selección es distinta de la activación y de la participación:

- una fuente seleccionada puede esperar a una oleada posterior de ingesta;
- cada snapshot declara qué fuentes estaban activas;
- cada observación declara si participa en el agregado;
- hechos de Academy, festivales o premios precursores son `official` o
  `festival`, nunca predicciones de expertos;
- un paywall permite guardar metadatos, enlace y valores verificables, pero no
  justifica copiar el cuerpo ni estimar datos ocultos.

## 3. Recepción crítica

### 3.1 Conversión lineal

Para una puntuación numérica con mínimo cero:

```text
puntuación_5 = puntuación_original / máximo_original × 5
```

| Original | Normalizada |
|---|---:|
| 8/10 | 4,00/5 |
| 75/100 | 3,75/5 |
| 3/4 | 3,75/5 |

Se conservarán al menos cuatro decimales internamente y se mostrarán dos.

### 3.2 Escalas no numéricas

Letras, etiquetas, pulgares, veredictos binarios o textos no se convertirán sin
una tabla explícita y aprobada para esa fuente. En ausencia de esa tabla se
muestra el valor original, pero no participa en la media numérica.

Si una reseña publica varias dimensiones —por ejemplo `Anticipation`,
`Enjoyment` e `In Retrospect` en Little White Lies— se conservan como valores
originales separados. No se promedian para fabricar una nota única sin una
decisión metodológica aceptada.

### 3.3 Agregado

Para cada película se muestran:

- media aritmética de puntuaciones normalizadas publicadas;
- mediana;
- número de puntuaciones;
- rango mínimo y máximo;
- fecha de actualización.

Una fuente aporta como máximo una puntuación activa por reseña y película. Las
revisiones sustituyen la observación activa, pero conservan el historial.

Una película necesita al menos **tres reseñas numéricas independientes** para
entrar en un orden público por media. Con una o dos se muestran los valores
originales y “datos insuficientes”, sin posición agregada. “Independiente”
significa una reseña canónica distinta; una sindicación o republicación del
mismo autor y texto no crea otra puntuación.

### 3.4 Agregadores de terceros

Un porcentaje de aprobación como Tomatometer y un agregado ponderado como
Metascore se guardan con su denominador y fecha de captura, pero no se convierten
en una reseña individual ni participan en la media Runscars. Pueden mostrarse
como contexto claramente atribuido.

Esta separación evita mezclar conceptos distintos y contar dos veces reseñas
que también lleguen desde su medio original.

## 4. Predicciones

Las predicciones de nominaciones y las de ganador se calculan por separado.

### 4.1 Métricas de consenso del MVP

Para cada candidatura se muestran:

- número de listas en las que aparece;
- cobertura: apariciones / listas aplicables;
- posición media entre las listas donde aparece;
- posición mediana;
- número de apariciones en el top 5;
- número de primeras posiciones;
- variación respecto al snapshot público anterior.

### 4.2 Puntuación Borda normalizada

Para una lista ordenada con longitud `L` y una candidatura en la posición `p`:

```text
puntos_fuente = (L - p + 1) / L
```

La primera posición recibe `1`; la última, `1/L`; una candidatura ausente
recibe `0`. El consenso es la media aritmética de los puntos obtenidos en todas
las listas ordenadas aplicables. Todas las fuentes tienen el mismo peso.

Esta puntuación ordena el consenso, pero no representa una probabilidad de
nominación o victoria. Siempre se muestra junto a cobertura, posiciones y número
de primeras posiciones.

Los desempates se resuelven por mayor cobertura, mejor posición mediana, mayor
número de primeras posiciones y, finalmente, orden alfabético estable.

### 4.3 Listas comparables

Una lista solo participa si:

- identifica categoría y temporada;
- tiene fecha;
- distingue nominaciones de ganadores o su intención es inequívoca;
- tiene un orden explícito o una selección explícita.

Una selección sin orden contribuye a cobertura, pero no a la puntuación Borda ni
a las posiciones media o mediana.

### 4.4 Fuente activa y cobertura

La unidad de peso y de cobertura es la fuente profesional activa para la
categoría e intención, no cada bloque de una misma publicación. Para un corte se
usa únicamente la publicación elegible más reciente de cada fuente:

- si contiene lista ordenada, aporta una vez al denominador Borda;
- si además contiene una selección sin orden, ambas partes forman una sola
  superficie de la fuente y no duplican su peso ni el denominador de cobertura;
- una candidatura presente en cualquiera de las dos partes cuenta como aparición
  de esa fuente;
- una fuente con solo selección cuenta para cobertura, pero no entra en el
  denominador Borda.

La implementación `runscars-aggregation-v2` representa los puntos decimales con
doce posiciones estables antes de ordenar. Esto elimina artefactos binarios —por
ejemplo `0,65` frente a `0,649999…`— sin redondear para presentación ni alterar
un empate matemático. Su salida usa `candidateId`, película, obra y personas. La
versión v1 permanece disponible exclusivamente para reproducir snapshots
históricos.

La publicación elegible más reciente se elige por fuente, categoría e intención:
si una publicación nueva omite una categoría, no elimina la última lista
elegible anterior de esa categoría. Un medio aporta una sola fuente aunque
publique varios autores, miembros o bloques.

### 4.5 Variación durante la fase 6

Antes de existir snapshots bloqueados, la variación se calcula de forma
determinista entre dos cortes de cálculo consecutivos. Cada corte:

1. limita observaciones por su fecha de publicación, o por captura si aquella no
   consta;
2. elige la última publicación elegible de cada fuente;
3. recalcula toda la clasificación;
4. expresa el movimiento como `posición_anterior - posición_actual`.

Un valor positivo significa subida, uno negativo bajada y cero estabilidad. Una
candidatura sin posición anterior se marca como nueva. Estos cortes no son
snapshots y pueden recalcularse; su bloqueo e inmutabilidad se incorporaron en
la fase 7.

### 4.6 Variación entre snapshots públicos

Desde el mantenimiento previo a la fase 9, una ejecución programada solo crea
un corte público cuando cambia el estado efectivo de al menos una fuente
profesional del mismo alcance. Ese estado se define, por fuente, mediante las
candidaturas presentes, su condición de ranking o selección y, cuando existe,
su posición y longitud de lista. Cambios de hora de captura, URL, extractor o
metadatos que no alteren esa superficie no crean un corte.

Como la cadencia pública es diaria, varias envolventes bloqueadas en una misma
fecha UTC se consolidan en el último estado del día antes de construir la
navegación. Esto absorbe reintentos y ejecuciones manuales parciales: nunca se
compara un corte público con otro de la misma fecha. Después se colapsan también
los días consecutivos cuyo estado efectivo sea equivalente.

La página de una categoría compara el corte seleccionado con el corte real
inmediatamente anterior del mismo alcance y versión metodológica. Los snapshots
históricos consecutivos con el mismo estado efectivo se conservan inmutables,
pero se colapsan en la navegación y no se usan como referencia de movimiento.
La variación mantiene la fórmula
`posición_anterior - posición_actual`: un valor positivo es una subida, uno
negativo una bajada, cero indica estabilidad y una candidatura ausente en el
corte anterior aparece como nueva.

La interfaz permite seleccionar cada corte real mediante una URL estable y
muestra su instante y los proveedores que cambiaron. Si no existe un corte real
anterior, no atribuye movimientos. La comparación se deriva al leer las
envolventes inmutables; no modifica el payload ni el hash de ninguna de ellas.

Los mercados no forman parte de esta identidad: Kalshi y Polymarket mantienen
su cadencia y evolución append-only separadas y nunca provocan un corte Borda.

## 5. Rankings de usuarios

- Se agregan separadamente de los expertos.
- Un usuario puede tener una versión activa por temporada y categoría.
- Los rankings privados no participan en agregados públicos.
- No se asigna una puntuación profesional a partir de un ranking de usuario.
- Los rankings parciales se pueden guardar y mostrar individualmente.
- Su entrada en un consenso público queda fuera de la fase 1 y necesita una
  decisión aceptada antes de implementar la fase 8; no se extrapolarán las
  posiciones ausentes mientras tanto.
- La visibilidad pública de un ranking requiere además que su perfil propietario
  sea público. Esta condición de lectura no cambia las posiciones guardadas.

## 6. Estado de visionado

El estado pertenece al usuario y a la película, no a una candidatura concreta.
Los valores iniciales son `no indicado` y `vista`. La fecha de visionado será
opcional y la visibilidad pública requerirá una preferencia explícita.
La ausencia de una fila representa `no indicado`; desmarcar una película elimina
esa fila. Los visionados solo se publican cuando perfil y preferencia específica
son públicos.

## 7. Snapshots

### 7.1 Tipos

- periódico;
- final de nominaciones;
- final de ganadores;
- resultado oficial.

### 7.2 Contenido mínimo

- instante y zona horaria;
- temporada y categorías;
- observaciones incluidas;
- fuentes activas;
- fórmulas y versión de metodología;
- resultados y desempates;
- exclusiones;
- identificador o hash reproducible;
- persona o proceso que lo bloqueó.

Un snapshot periódico programado solo se bloquea cuando su estado efectivo de
proveedores difiere del puntero periódico vigente. Los cierres finales y las
correcciones explícitas conservan sus reglas propias y no dependen de este
filtro.

La implementación `runscars-snapshot-v2` calcula el SHA-256 sobre una
serialización JSON canónica del contenido metodológico. El proceso y el instante
de bloqueo, el ID y la cadena de corrección se guardan como metadatos, pero no
alteran el hash del agregado. `runscars-snapshot-v1` y sus hashes no se
reinterpretan ni se migran.

Un snapshot periódico no convierte automáticamente las primeras posiciones en
una selección final. El cierre de nominaciones fija y conserva el número de
candidaturas previstas; el cierre de ganador fija una primera posición y
conserva el ranking completo.

### 7.3 Inmutabilidad

Un snapshot bloqueado no se modifica. Si se descubre un error:

1. se conserva el original;
2. se documenta la corrección;
3. se crea un snapshot corregido enlazado;
4. la interfaz indica cuál es oficial y por qué.

La versión vigente vive en un puntero separado. Cambiar ese puntero no modifica
ningún snapshot ni resultado oficial previo.

## 8. Evaluación del acierto

### Nominaciones

Por categoría:

- aciertos;
- falsos positivos;
- nominados no previstos;
- precisión: aciertos / predicciones;
- cobertura: aciertos / nominados oficiales.

### Ganadores

Por categoría:

- ganador en primera posición: sí/no;
- posición del ganador en el snapshot;
- presencia del ganador en la selección: sí/no.

La fórmula no se cambiará después de conocer los resultados sin publicar una
nueva versión metodológica.

La versión genérica es `runscars-evaluation-v2`; compara `candidateId` y conserva
película, obra y personas. La v1 permanece reproducible. Para métricas globales se suman
primero aciertos, predicciones y resultados oficiales de todas las categorías y
después se calculan las razones. No se usa una media simple de porcentajes por
categoría.

## 9. Datos insuficientes

La interfaz mostrará “datos insuficientes” en vez de presentar un agregado
inestable como definitivo. Para recepción crítica se aplica el mínimo de tres
reseñas numéricas independientes de la sección 3. Para predicciones, una
candidatura puede mostrarse desde una lista, pero no se denomina “consenso”
hasta que existan al menos cuatro listas ordenadas automáticas y publicables.
Una fuente manual, un mercado o varios expertos del mismo medio no completan
este mínimo.

## 10. Mercados

Kalshi y Polymarket se capturan por separado en un registro append-only. Se
conservan proveedor, IDs externos, contrato, precio o probabilidad original,
volumen, interés abierto, URL, fechas y payload. No se calcula un consenso entre
proveedores y ninguna captura de mercado puede convertirse en observación
profesional ni entrar en Borda. La ausencia se representa como “sin mercado
disponible”.

El discovery exige que la ceremonia coincida de forma explícita con la temporada
activa y que el contrato siga abierto. Kalshi se consulta por series de
categoría; Polymarket por eventos activos de la ceremonia. La interfaz etiqueta
por separado mercados de nominación y de ganador y muestra, como máximo, los
cuatro de mayor volumen de cada intención y proveedor en una categoría.

## 11. Calibraciones de la fase 1

El dataset capturado el 2026-07-24 fija estas reglas iniciales:

- **Puntuaciones:** mínimo de tres reseñas numéricas independientes.
- **Sindicación:** se deduplica por reseña canónica, autor y película; una copia
  sindicada no añade voto.
- **Rankings parciales de usuarios:** se almacenan, pero su consenso público se
  pospone a fase 8 mediante D-014.
- **Frescura:** una fuente de predicciones activa se marca desactualizada a los
  45 días sin nueva publicación o fecha de actualización. El aviso no borra ni
  excluye automáticamente sus observaciones.
- **Redondeo:** se calcula y desempata con precisión completa. Se muestran dos
  decimales; dos valores que se ven iguales no son un empate si difieren
  internamente. El orden debe poder explicar el valor completo y el desempate.

Estas calibraciones pueden revisarse con una nueva decisión si aumenta la
cobertura. No se reinterpretan snapshots ya bloqueados.
