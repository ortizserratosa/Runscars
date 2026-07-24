# Agregación · fase 6

**Estado:** completada

**Versión:** `runscars-aggregation-v1`

**Corte de referencia:** Oscar 2027 · Mejor película · 2026-07-23

## Resultado

La aplicación calcula recepción crítica y predicciones profesionales desde
observaciones publicadas, sin mezclarlas entre sí ni con la comunidad. La salida
no se guarda como un agregado mutable: la fase 7 persistirá snapshots junto con
sus observaciones, versión y hash.

El módulo puro vive en `web/src/lib/aggregation/`. No consulta red ni base de
datos y puede recibir observaciones de cualquier repositorio. El fixture
ejecutable de `web/src/data/phase6-reference.ts` es un subconjunto exacto del
CSV de fase 1:

| Tipo                           | Observaciones |
| ------------------------------ | ------------: |
| Predicción ordenada            |            40 |
| Selección sin orden            |             8 |
| Puntuación individual          |             2 |
| Agregado crítico contextual    |             5 |
| **Total utilizado por fase 6** |        **55** |

Las otras catorce observaciones del dataset son enlaces de reseña sin nota
numérica y, por diseño, no participan en estos cálculos.

## Recepción crítica

Una puntuación participa únicamente si es individual, está publicada, tiene
participación activa y su escala numérica parte de cero:

```text
normalizada_5 = valor_original / máximo_original × 5
```

Los ejemplos manuales que fijan la referencia son:

| Original | Operación      | Esperada |
| -------: | -------------- | -------: |
|     8/10 | `8 / 10 × 5`   |   4,0000 |
|   75/100 | `75 / 100 × 5` |   3,7500 |
|      3/4 | `3 / 4 × 5`    |   3,7500 |

Con las tres notas, la media esperada es `11,5 / 3 = 3,833333…`, la mediana
`3,75` y el rango `3,75–4,00`. Una nota no numérica no se convierte y un
agregado de terceros queda como contexto.

En el fixture real, The Odyssey y Project Hail Mary tienen una sola puntuación
individual cada una. La web muestra valor original y normalización, pero no
publica una media ni un orden crítico porque el mínimo aceptado es tres.

## Consenso de predicciones

Para cada lista ordenada de longitud `L`, una posición `p` aporta
`(L - p + 1) / L`. La ausencia aporta cero. La puntuación de consenso es la
media de todas las fuentes ordenadas activas y se muestra sobre 100.

La unidad aplicable es la fuente. El bloque “On the Radar” de AwardsWatch forma
parte de la misma publicación que su top 10: amplía la presencia de una película
sin crear una quinta fuente ni aportar puntos.

### Referencia manual actual

| Pos. | Película                      | Rangos publicados | Puntos / 100 | Cobertura | Mediana |
| ---: | ----------------------------- | ----------------- | -----------: | --------: | ------: |
|    1 | The Odyssey                   | 2, 1, 1, 1        |        97,50 |       4/4 |       1 |
|    2 | Project Hail Mary             | 1, 2, 4, 5        |        80,00 |       4/4 |       3 |
|    3 | Wild Horse Nine               | 4, 3, 3, 3        |        77,50 |       4/4 |       3 |
|    4 | Fjord                         | 3, 5, 6, 4        |        65,00 |       4/4 |     4,5 |
|    5 | Dune: Part Three              | 6, 4, 2, 6        |        65,00 |       4/4 |       5 |
|    6 | La Bola Negra                 | 7, —, 5, 2        |        47,50 |       3/4 |       5 |
|    7 | Digger                        | 8, 6, 7, 8        |        37,50 |       4/4 |     7,5 |
|    8 | The Debut                     | 10, 8, 8, 9       |        22,50 |       4/4 |     8,5 |
|    9 | The Adventures of Cliff Booth | 5, 9, 10, —       |        22,50 |       3/4 |       9 |
|   10 | Behemoth!                     | —, —, 9, 7        |        15,00 |       2/4 |       8 |

El orden de rangos de la tabla es Awards Daily, Awards Radar, AwardsWatch y Next
Best Picture. Fjord y Dune empatan a `65,00`; la mejor mediana coloca a Fjord
por delante. The Debut y Cliff Booth empatan a `22,50`; la cobertura `4/4`
resuelve el segundo empate.

The Social Reckoning prueba la selección no ordenada: aparece en el radar de
AwardsWatch y en el puesto 7 de Awards Radar. Su cobertura es `2/4`, pero solo
Awards Radar aporta `0,4`; dividido entre cuatro listas ordenadas produce
`0,10`, mostrado como `10,00 / 100`.

## Evolución recalculable

Las fechas distintas del fixture producen cuatro cortes acumulados:

| Fecha      | Listas ordenadas | Observaciones incluidas | Etiqueta            |
| ---------- | ---------------: | ----------------------: | ------------------- |
| 2026-07-04 |                1 |                      10 | datos insuficientes |
| 2026-07-15 |                2 |                      28 | datos insuficientes |
| 2026-07-20 |                3 |                      38 | primer consenso     |
| 2026-07-23 |                4 |                      48 | consenso actual     |

Entre los dos últimos cortes, Fjord sube del 5 al 4 y Dune baja del 4 al 5. El
movimiento se obtiene con `posición_anterior - posición_actual`. Estos cortes se
recalculan desde las observaciones y se identifican expresamente en la interfaz
como no bloqueados.

## Explicación en producto

- La categoría permite abrir cualquier película y cada fila.
- Una fila expandida muestra ID de observación, URL, posición, fórmula y puntos
  de las cuatro fuentes, incluidos los ceros.
- El selector recalcula el estado hasta cada fecha y avisa cuando no llega al
  mínimo de tres listas.
- Todas las fichas de película muestran posición, cobertura y contribuciones.
- The Odyssey muestra además original, normalización crítica y la exclusión
  explícita de Metacritic y Rotten Tomatoes.
- La simulación de comunidad permanece en su módulo y no interviene en ningún
  cálculo profesional.

## Verificación de la puerta

`web/tests/unit/aggregation.test.ts` comprueba:

1. las tres normalizaciones manuales;
2. media, mediana, rango y mínimo crítico;
3. las métricas y desempates de Mejor película;
4. cobertura sin Borda para selecciones;
5. los cuatro cortes y su variación;
6. que los 55 IDs del fixture ejecutable coinciden exactamente con el CSV de
   fase 1.

Los recorridos Playwright validan el cambio de corte, la explicación completa y
una ficha con presencia ordenada, selección y ausencia. Ninguna prueba consulta
fuentes externas.

Con estos ejemplos coincidentes y la trazabilidad visible, la puerta de salida
de la fase 6 queda cumplida. La inmutabilidad, correcciones de snapshots y
evaluación contra resultados siguen reservadas a la fase 7.
