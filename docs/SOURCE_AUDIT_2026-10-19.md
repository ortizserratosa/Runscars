# Auditoría y corrección de predicciones · 19 de octubre de 2026

**Estado:** implementación en verificación; publicación pendiente de comprobación.

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
operación y la auditoría de indexación de septiembre. Los resultados finales de
pruebas, importaciones y publicación se añadirán una vez verificados.
