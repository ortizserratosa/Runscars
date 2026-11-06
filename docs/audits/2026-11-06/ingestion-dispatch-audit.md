# Despacho diario e integridad de extractores · 6 de noviembre de 2026

## Hallazgos comprobados

La definición previa disparaba todos los conectores activos simultáneamente a
las 04:17 UTC. El pool de tres workers de `runConnectorSet` solo limita una
invocación; el Cron enviaba una invocación por ID y cada una abría hasta seis
workers de persistencia. Diecinueve invocaciones podían multiplicar la carga de
PostgREST aunque sus fallos estuvieran aislados por fuente.

Las lecturas de `ingestion_runs` muestran intentos abandonados el 04/11 en
Ankler, Rolling Tape, Radar, NBP y otros conectores. El 05/11 volvieron a quedar
incompletos Radar, Rolling Tape y NBP; el 06/11 persistían trece intentos
`running` sin cierre. El registro conserva el momento en que el intento siguiente
marca el anterior como abandonado; ese cierre tardío no mide la duración real
del worker. Sin logs de la plataforma no se atribuye su terminación a una causa
específica de CPU, memoria o red.

La expansión TMDB dispone de un presupuesto de sesenta segundos para comenzar
peticiones externas, pero ese presupuesto no incluye toda la persistencia. No
es evidencia suficiente para atribuirle las terminaciones. El matching local
del lote público actual de Radar resolvió 50/50 películas con el catálogo
existente; una captura remota con solo seis observaciones no era una lista
original de seis películas ni una ausencia general de identidades.

## Reparación del despacho

`supabase/schedules/run-ingestion-daily.sql` instala un job por ID activo, en
orden estable, separado por un minuto desde las 04:17 UTC. Los diecinueve
conectores actuales llegan hasta las 04:35 UTC. El corte de snapshots de las
04:47 no se mueve.

Cada comando comprueba de nuevo `is_active`, obtiene el secreto vigente desde
Vault y envía un único conector. Reaplicar el archivo elimina el job monolítico
anterior y los jobs de conectores anteriores antes de reinstalarlos; conserva
los jobs ajenos, incluidos mercados y festivales. Añadir una fuente o activar
un ID sin job requiere reaplicar la programación y comprobar el margen antes
del corte. Un job instalado conserva las pausas y reactivaciones dinámicas.

No se promete exclusión mutua: dos conectores pueden solaparse si el primero
tarda más de un minuto. La nueva barrera de publicación de capturas completas
protege el consenso aunque un intento posterior vuelva a interrumpirse.

## Regresiones de extracción reparadas

- Awards Daily publicaba `Christian Mungiu, Fjord,`: la última coma producía
  una identidad vacía y abortaba todo el lote. Se conserva el original y se
  interpreta la película como `Fjord`. Las identidades vacías residuales van a
  revisión sin abortar el resto, incluida la corroboración TMDB.
- El artículo de Awards Daily del 30/10 declara inmediatamente antes de Mejor
  película que ordena los títulos por su fortaleza. `awards-daily-v10` conserva
  esa evidencia y atribuye orden solo a ese bloque; las demás categorías
  permanecen como selecciones sin orden demostrado. El lote contiene ochenta
  observaciones y diez posiciones de Mejor película.
- The Movie State cerraba un título con otra comilla de apertura. El extractor
  `movie-state-v2` conserva el rótulo y recupera las cuarenta y cinco
  observaciones. Su publicación original del 14/09 continúa vencida; una
  modificación del CMS no la renueva.
- Variety añadió una quinta columna `Type` a guion original y una quinta
  columna sin nombre a adaptado. `variety-datawrapper-v3` conserva esos campos
  sin desplazar `Rank`, títulos ni créditos. Ambos guiones del 05/11 vuelven a
  producir treinta posiciones completas. Las identidades no corroboradas se
  mantienen en revisión.
- Awards Radar rechaza fechas editoriales imposibles o futuras; Radar y
  The Ringer detectan también la temporada expresada como «Oscar Predictions
  for 2028» y no la incorporan a Oscar 2027.

Los recibos estructurados de las fuentes contrastadas cumplen la barrera de
integridad: suma de categorías, `ranking_rows.length` o `rows.length` coincide
con el número de observaciones extraídas. NEXT y alternativas de AwardsWatch se
guardan fuera de sus categorías participantes.

## Verificación reproducible

La prueba `web/tests/database/ingestion-schedule.test.ts` ejecuta el SQL real
dos veces sobre adaptadores PGlite de Cron, `pg_net` y Vault. Comprueba
diecinueve jobs y minutos únicos, retirada del job anterior, conservación de
mercados/festivales, una fuente por payload, lectura de un secreto rotado,
pausas inmediatas y alta de nuevas fuentes tras reaplicar el archivo.

Los tests de extracción usan fixtures locales y prueban comas finales,
comillas tipográficas, columnas adicionales verificadas, orden explícito
adyacente, temporadas incompatibles y fechas inválidas. No dependen de páginas
ni de TMDB en tiempo real. El despliegue y la reingesta de comprobación se
registran en la auditoría principal de este encargo.
