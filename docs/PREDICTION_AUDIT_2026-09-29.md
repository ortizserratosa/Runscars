# Auditoría de predicciones Oscar · 29 de septiembre de 2026

## Resultado y alcance

El catálogo necesitaba más cobertura independiente y, antes de sumar votos,
corregir qué se estaba considerando un ranking. Se incorpora The Movie State
(Ben Sears) en las ocho categorías, se recupera AwardsWatch y se corrigen
extracción, matching, agregación, retirada por caducidad y presentación pública.
Este es un corte de mantenimiento del MVP, no una fase nueva.

La investigación de fuentes y sus muestras están en
[el informe de discovery](audits/2026-09-29/source-research.md).
Las decisiones duraderas son D-063 a D-067 en [DECISIONS.md](DECISIONS.md).
Los cambios locales previos de `OPERATIONS.md` y la auditoría de indexación del
17/09 se conservan ajenos a esta entrega.

## Estado inicial observado

La [lectura administrativa inicial](audits/2026-09-29/prediction-audit-before.json)
confirmó seis conectores de predicciones y tres rankings vigentes por categoría:
Awards Daily, Awards Radar y Next Best Picture. AwardsWatch llevaba fallando
desde el 17/09; el último dato conservado era de agosto. Midnight Critics
conservaba la captura de julio, y The Ringer una publicación de marzo. Que sus
conectores respondieran correctamente no convertía esas predicciones en actuales.

El refresco diario del 29/09 había terminado correctamente sin nuevos cortes.
Había como máximo 834 observaciones publicadas por categoría: la consulta sin
paginar todavía no había superado 1.000 en ese alcance. La corrección de
paginación previene un fallo al crecer el historial; no se atribuye a este límite
una corrupción retrospectiva que no se ha observado.

## Hallazgos y correcciones

| Hallazgo | Consecuencia | Corrección |
|---|---|---|
| AwardsWatch pasó a artículos con varias categorías y paneles de cuatro autores | El discovery no encontraba las categorías requeridas y conservaba datos vencidos | Descubrir cada categoría dentro de artículos combinados y seleccionar por nombre la columna de Erik Anderson, manteniendo una voz por medio |
| Awards Daily asignaba `index + 1` a párrafos sin orden declarado | Posiciones y puntos Borda inventados | Guardar selección sin puesto; mantener autora, fecha, valores y alternativas excluidas |
| Los paneles actuales de interpretación y guion de AwardsWatch no están numerados | Un índice de fila no prueba orden editorial | Top cinco como selección; `NEXT` conservado en la captura, fuera del voto |
| Awards Radar cortaba a diez una lista de 50 películas o 20 candidatos | Longitud original incorrecta, puntos y cobertura alterados | Capturar ranking completo, comprobar posiciones y conservar el último válido ante estructura rota |
| NBP no atribuía la lista del perfil a Matt Neglia y podía leer el reloj de cabecera | Autoría incompleta o falsa fecha de actualización | Identificar al autor desde el título del perfil; ninguna fecha de reloj se usa como publicación; conservar identidad/captura ante corrección solo de metadatos |
| Artificial estaba emparejada al homónimo de Tyler Woods, TMDB 1586108 | Ficha y créditos ajenos a las predicciones; actores/director pendientes | Corrección editorial al TMDB 1492198, recibo NYFF, créditos nuevos e historial conservado; autoimport exige corroboración personal |
| Guiones con autores secundarios sin matching quedaban pendientes | Una película inequívoca perdía su voto | La identidad de guion usa película; solo se incorporan créditos comprobados |
| Comparación de revisiones y URLs distintas en un único comparador | Elección dependiente del orden de filas | Resolver primero cada URL y después comparar publicaciones |
| Ranking inválido y selección válida podían compartir votos descartados | Cobertura y candidatos incoherentes con sus contribuciones | Derivar apariciones y candidatos únicamente de las contribuciones válidas |
| Consulta de observaciones sin paginación | Riesgo de truncar al superar el límite de API | Páginas estables de 500 y referencias en lotes de 200 |
| Si vencían todas las fuentes, no se podía guardar un corte vacío | El puntero retenía un ranking vencido | Corte periódico vacío con evidencia excluida; finales vacíos siguen rechazados; portada e histórico soportan retirada |
| Auditor vivo omitía reglas de categorías requeridas | Podía informar éxito con el conector real roto | Compartir validación con ingesta, cargar configuración real y comprobar frescura del refresco de snapshots |
| Una corrección de créditos en fotografía de NBP renovaba todas las categorías de la página | Listas sin cambios parecían más recientes | Derivar la frescura de cada lista completa sin alterar la captura real ni el hash original |
| Siete conectores compartían un worker que agotó recursos en la prueba real | Dos importaciones quedaban interrumpidas | Una invocación autenticada por conector activo, manteniendo el cron diario |
| Una importación podía vincular una película a la temporada antes de guardar sus créditos | El reintento omitía una ficha incompleta | Completar créditos de identidades automáticas ya corroboradas y vincular la temporada al terminar; conservar los IDs canónicos de personas |

La [extracción de control](audits/2026-09-29/prediction-extraction.json) compara
los parsers con el catálogo anterior a la importación. Comprueba 55 observaciones
de AwardsWatch, 80 de Awards Daily, 190 de Awards Radar, 110 de NBP, 150 de
Midnight Critics, tres de The Ringer y 45 de The Movie State. Incluye también
categorías no públicas ya capturadas por los adaptadores anteriores; no se
activan por esta auditoría. Los casos sin identidad inequívoca quedan pendientes.

Las protecciones de formato usan fixtures reducidos reproducibles. Un cambio de
estructura, temporada, autor esperado, longitud, posiciones duplicadas o huecos
no se interpreta como éxito parcial. Los límites defensivos restantes fallan
explícitamente al rebasarse, en vez de truncar listas silenciosamente.

## Cálculo y límites

Se conserva la fórmula Borda aceptada `(L − p + 1) / L`, media sobre medios con
ranking elegible y cero para ausencias. Las selecciones aportan cobertura, no
posiciones ni denominador Borda. No se añaden pesos por fama, usuarios, mercados,
crítica o número de autores de un panel. La regla de frescura sigue siendo de
30 días por publicación/revisión, no por última comprobación de red.

La longitud afecta a los puntos: el puesto 10 vale 0,10 en una lista de diez y
0,82 en una de cincuenta. Conservar la longitud real corrige la extracción, pero
no hace de Borda una probabilidad ni elimina esa característica del método.
Cambiar a un horizonte común o calibrar probabilidades exigiría otra versión y
una evaluación histórica comparable. No se presenta esa alternativa como una
mejora ya demostrada ni se cambia la fórmula para obtener un favorito concreto.
La metodología pública explica ahora el promedio, las ausencias y este límite.

Para las páginas sin fecha de NBP y Midnight Critics, una revisión del CMS no
prueba un cambio de todas las predicciones. El cálculo deriva `freshnessAt` de
capturas completas por categoría, antes del matching, y mantiene `capturedAt`
real. Los créditos secundarios no cambian esa edad. También se exige que la
evidencia ya estuviera capturada en la fecha del corte. Los formatos legados sin
estructura reconocible conservan el criterio anterior; no se reconstruyen
transiciones que nunca dejaron una captura. Ver D-067 y el
[recibo de frescura por categoría](audits/2026-09-29/prediction-freshness.json).

Con las muestras verificadas, AwardsWatch aporta ranking en película y dirección,
y selección en las otras seis categorías. Awards Daily aporta selección. Radar,
NBP y The Movie State aportan rankings. Los ocho cortes publicados y la
[comprobación posterior](audits/2026-09-29/prediction-audit-after.json) confirman
cuatro rankings en película/dirección y tres en las otras seis, con cinco medios
que aportan cobertura. Midnight Critics y The Ringer quedan fuera por caducidad.
Las categorías por debajo de cuatro muestran predicciones provisionales; no se
rebaja el umbral ni se contabilizan selecciones como rankings para cumplirlo.

## Nuevas fuentes

The Movie State supera la puerta de calidad con el artículo firmado de 2027,
un archivo de predicciones y la temporada anterior. Publicación original 14/09,
modificación del CMS del 21/09 conservada solo como metadato, ocho categorías y
45 puestos explícitos. La frescura parte del 14/09: el cambio del timestamp de
modificación no prueba un cambio de ranking ni renueva el voto. Se
comprueba diariamente, aunque su frecuencia editorial observada es irregular.
Solo se publican valores, metadatos y enlaces atribuidos, sin cuerpo editorial.

Variety y THR merecen prioridad editorial, pero el ranking embebido de Variety
devuelve 403 y THR declara su forecast como contenido de pago. No se ha eludido
ninguna barrera. Los resúmenes de Variety, IndieWire, Filmotomy y Cinema Sight
revisados son selecciones alfabéticas o niveles; no resuelven la falta de otro
ranking ordenado. The Ankler aún no ofrecía un panel Oscar 2027 utilizable.

## Operación

Copia de roles, esquema y datos creada fuera de Git en
`/Users/nacho/Documents/Side/Runscars-backups/2026-09-29-prediction-audit`, con
permisos 0700/0600. Los avisos de claves foráneas circulares del dump de datos
son los contemplados por el procedimiento de restauración existente.

El comando `npm run audit:predictions` verifica exclusivamente esta señal:
parsers reales, categorías requeridas, estado de conectores y refresco de cortes.
Usa configuración remota con credenciales de servidor. Sin ellas lo advierte y
usa la configuración versionada; ese modo no certifica la salud de los cron.
No necesita recorrer todo el sitemap ni consumir miles de renders de Vercel.

Las correcciones crean revisiones nuevas. Las capturas y snapshots bloqueados
anteriores permanecen intactos, también los que contienen interpretaciones
anteriores: no se reescribe evidencia histórica para hacerla pasar por la nueva
extracción. La lectura del corte actual publica la evidencia corregida.

### Prueba de ejecución real y recuperación

La invocación conjunta `pg_net` 1299 devolvió HTTP 546
`WORKER_RESOURCE_LIMIT`: cinco fuentes acabaron y dos quedaron interrumpidas.
Se registraron los fallos confirmados de los runs 613/616 y se retomaron por
separado sin borrar sus datos. Radar completó 190 observaciones y NBP 110.
La fase incompleta había creado *The Drama* (TMDB 1325734) sin créditos: se
completaron por el flujo editorial, conservando la identidad ya corroborada con
Zendaya y la captura original. La reanudación automática queda protegida para
este caso y no modifica un matching editorial.

El nuevo cron despacha una petición por conector activo. Su prueba real
[1302–1310](audits/2026-09-29/prediction-isolated-imports.json) dio nueve respuestas
HTTP 200 y nueve runs correctos, entre 1,3 y 35,6 segundos por fuente. Las siete
fuentes de predicciones procesaron 633 observaciones sin nuevas capturas ni
observaciones: repetición idempotente. Guardian guardó dos observaciones de
crítica nuevas; se conservan separadas de las predicciones. La
[repetición con la función definitiva, versión 40](audits/2026-09-29/prediction-isolated-final-imports.json),
peticiones 1312–1320, vuelve a confirmar nueve respuestas HTTP 200 y las 633
observaciones de predicciones sin duplicados.

## Corrección editorial de Artificial

Se verificaron el [programa oficial NYFF](https://www.filmlinc.org/nyff2026/films/artificial/)
y [TMDB 1492198](https://www.themoviedb.org/movie/1492198-artificial): Luca
Guadagnino, Andrew Garfield y Yura Borisov corresponden a la película de las
predicciones. El enlace anterior, TMDB 1586108, correspondía a otro largometraje,
dirigido por Tyler Woods. La corrección `tmdb:match artificial 1492198` ya se
aplicó al catálogo vivo: registró el cambio con motivo en
`film_tmdb_match_history`, conservó los snapshots originales y reemplazó los
créditos actuales. No se cambian las
posiciones originales de los expertos ni se infiere elegibilidad Oscar.

Los [recibos editoriales](audits/2026-09-29/editorial-matches.json) documentan
además las erratas de Awards Radar `Artifical` y `Guy Peace` en Ink. Los alias
están implementados y probados solo para matching de esa fuente; el texto
original permanece intacto. Los créditos de [Ink, TMDB 1532610](https://www.themoviedb.org/movie/1532610)
se renovaron en el catálogo vivo, incluyendo Guy Pearce como Rupert Murdoch. Las
ambigüedades restantes no se resuelven por semejanza de nombres.

La ampliación automática omite consultas cuando no hay personas para corroborar
la identidad. Tiene timeout de 15 segundos, dos intentos y 60 segundos para
iniciar solicitudes; un `Retry-After` largo deja el título pendiente sin
reintentar anticipadamente. Las pruebas simulan tanto conexiones colgadas como
limitación de frecuencia, sin depender de TMDB en vivo.

## Identidades pendientes revisadas

Se revisaron 17 observaciones públicas de Radar correspondientes a diez obras.
El [recibo de investigación](audits/2026-09-29/pending-editorial-review.json)
contrasta distribuidoras, productores y festivales, descarta los homónimos de
*Bunker* y *Mr. Irrelevant* y conserva la incertidumbre sobre fechas.
El [manifiesto editorial](../data/audits/2026-09-29-tmdb-editorial.json) se importó
con el CLI canónico: diez emparejamientos manuales, créditos completos e historial
auditable. La [activación en temporada](audits/2026-09-29/editorial-activation.json)
se hizo después de comprobar esas diez identidades y sus créditos.

La inclusión representa el pronóstico explícito del experto para Oscar 2027,
sin certificar elegibilidad oficial. IFC Center documenta exhibición de *Omaha*
en Nueva York en abril/mayo de 2026 y Sony anuncia estreno estadounidense de
*I Swear* en abril de 2026, aunque TMDB conserve fechas iniciales de 2025.
*The Liberation* y *Cry to Heaven* mantienen revisión de elegibilidad pendiente:
en la primera no se verificó un pase calificante anterior al estreno amplio de
enero; en la segunda solo se confirmó producción, sin fecha de estreno.

La [lectura de las observaciones reconciliadas](audits/2026-09-29/editorial-observations.json)
confirma la publicación de los 17 casos, *The Drama* y las correcciones de
Artificial/Ink, conservando las erratas originales. No quedan observaciones de
esta auditoría pendientes de identidad en las ocho categorías públicas.
Permanecen cinco pendientes en categorías no públicas (fotografía y canción),
fuera de este corte; no se incorporan al cálculo actual.

## Verificación local y estado de entrega

La verificación conjunta pasó **263 pruebas unitarias y 25 pruebas de base de
datos**. También pasaron formato, lint, tipos, build, auditoría de dependencias (cero
vulnerabilidades) y las 124 pruebas E2E en escritorio y móvil. La suite de The
Movie State incluye 15 pruebas reproducibles sobre
formato, identidad, integridad, idempotencia y conservación de la publicación
original frente a cambios de fecha del CMS.

La entrega está aplicada en [runscars.app](https://runscars.app):

- Web del commit `fd677cf`, deployment `dpl_DnKhnFADoPR9QfvEgZFdPncAPfrq`,
  promovido al dominio público; 34 rutas correctas
  [antes de promover](audits/2026-09-29/prediction-release-protected.json) y
  [en el dominio público](audits/2026-09-29/prediction-release-public.json).
- Cinco migraciones nuevas aplicadas; las 43 migraciones locales y remotas
  coinciden. Edge `run-ingestion` versión 40 activa, y cron diario de las 04:17
  UTC con una petición por conector. No se cambia la hora del refresco Vercel,
  04:47 UTC.
- [Primer refresco autenticado](audits/2026-09-29/prediction-refresh-final.json):
  ocho cortes nuevos, cero fallos, 22,9 segundos.
  [Repetición](audits/2026-09-29/prediction-refresh-repeat.json): ocho cortes
  `unchanged`, cero fallos, 15,1 segundos. Los hashes de los ocho cortes
  bloqueados que estaban publicados al comenzar siguen intactos.
- `npm run audit:predictions` correcto contra las siete fuentes reales y el
  estado remoto de los cron. Nueve conectores activos sin `last_error`.
- Comprobación visual pública en escritorio y móvil: película muestra 50
  candidaturas, cinco medios y cuatro rankings; actriz, 20 candidaturas, cinco
  medios y tres rankings, con aviso provisional. Sin desbordamiento horizontal
  ni errores JavaScript observados. Se esperó la revalidación normal de 60
  segundos del puntero; no fue necesario purgar la caché.
- La consulta de logs de error del deployment durante la última hora no devolvió
  entradas. Esta comprobación se limita a este despliegue y a predicciones; no
  certifica otros subsistemas ajenos al encargo.

El [recibo operativo final](audits/2026-09-29/prediction-release-summary.json)
registra las versiones, checks, ausencia de runs interrumpidos y cron activo.
La [lectura pública de las ocho categorías](audits/2026-09-29/prediction-public-categories.json)
confirma que cada página muestra el nuevo snapshot, sus recuentos, The Movie
State y el estado de consenso que corresponde.

Sigue siendo útil incorporar otro ranking independiente, accesible y mantenido
para las seis categorías con solo tres fuentes ordenadas. Esta auditoría no
encontró un segundo conector nuevo que superase esas condiciones; no se rebaja
la puerta de calidad para completar un recuento.
