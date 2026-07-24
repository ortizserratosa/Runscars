# Metodología

**Estado:** metodología de señales profesionales e ingesta original operativas
**Última revisión:** 2026-07-24

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
- película, persona y categoría aplicables;
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
editorial. La fase 6 no podrá agregar observaciones pendientes.

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

La implementación `runscars-aggregation-v1` representa los puntos decimales con
doce posiciones estables antes de ordenar. Esto elimina artefactos binarios —por
ejemplo `0,65` frente a `0,649999…`— sin redondear para presentación ni alterar
un empate matemático. Después se aplican los desempates de la sección 4.2.

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
snapshots y pueden recalcularse; su bloqueo e inmutabilidad empiezan en la
fase 7.

## 5. Rankings de usuarios

- Se agregan separadamente de los expertos.
- Un usuario puede tener una versión activa por temporada y categoría.
- Los rankings privados no participan en agregados públicos.
- No se asigna una puntuación profesional a partir de un ranking de usuario.
- Los rankings parciales se pueden guardar y mostrar individualmente.
- Su entrada en un consenso público queda fuera de la fase 1 y necesita una
  decisión aceptada antes de implementar la fase 8; no se extrapolarán las
  posiciones ausentes mientras tanto.

## 6. Estado de visionado

El estado pertenece al usuario y a la película, no a una candidatura concreta.
Los valores iniciales son `no indicado` y `vista`. La fecha de visionado será
opcional y la visibilidad pública requerirá una preferencia explícita.

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

### 7.3 Inmutabilidad

Un snapshot bloqueado no se modifica. Si se descubre un error:

1. se conserva el original;
2. se documenta la corrección;
3. se crea un snapshot corregido enlazado;
4. la interfaz indica cuál es oficial y por qué.

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

## 9. Datos insuficientes

La interfaz mostrará “datos insuficientes” en vez de presentar un agregado
inestable como definitivo. Para recepción crítica se aplica el mínimo de tres
reseñas numéricas independientes de la sección 3. Para predicciones, una
candidatura puede mostrarse desde una lista, pero no se denomina “consenso”
hasta que existan al menos tres listas ordenadas aplicables.

## 10. Calibraciones de la fase 1

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
