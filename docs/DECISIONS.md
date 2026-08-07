# Registro de decisiones

**Última revisión:** 2026-08-07

## Cómo usar este registro

Estados:

- `Propuesta`: necesita confirmación.
- `Aceptada`: gobierna el proyecto.
- `Reemplazada`: otra decisión posterior la sustituye.
- `Descartada`: se decidió no aplicarla.

Las nuevas decisiones se añaden al final con un ID estable. No se reescribe el
pasado para ocultar cambios de criterio.

## Resumen

| ID | Decisión | Estado |
|---|---|---|
| D-001 | Nombre de trabajo Runscars | Aceptada |
| D-002 | Proyecto personal durante prototipo | Aceptada |
| D-003 | TMDB para metadatos | Aceptada |
| D-004 | Tres señales separadas | Aceptada |
| D-005 | Año de ceremonia como etiqueta principal | Aceptada |
| D-006 | Ocho categorías iniciales | Aceptada |
| D-007 | Cinco ceremonias históricas en el MVP | Aceptada |
| D-008 | Comentarios fuera del MVP | Aceptada |
| D-009 | Actualización diaria y snapshot semanal | Aceptada |
| D-010 | Stack web gestionado | Aceptada |
| D-011 | Consenso Borda normalizado | Aceptada |
| D-012 | Agregadores críticos solo como contexto | Aceptada |
| D-013 | Umbrales y deduplicación profesionales de fase 1 | Aceptada |
| D-014 | Consenso de rankings parciales de usuarios | Propuesta |
| D-015 | Catálogo de fuentes sin máximo rígido | Aceptada |
| D-016 | Aplicación definitiva separada del prototipo | Aceptada |
| D-017 | Validación SQL portable además del flujo Supabase | Aceptada |
| D-018 | Catálogo TMDB desacoplado del runtime web | Aceptada |
| D-019 | Ingesta append-only con matching conservador | Aceptada |
| D-020 | Agregados derivados y snapshots diferidos | Aceptada |
| D-021 | Snapshots como envolventes inmutables con puntero vigente | Aceptada |
| D-022 | Evaluación versionada sobre cierres explícitos | Aceptada |
| D-023 | Compatibilidad explícita para `brace-expansion` corregido | Aceptada |
| D-024 | Candidatura genérica y contratos v2 compatibles | Aceptada |
| D-025 | Cobertura profesional mínima por medio y categoría | Aceptada |
| D-026 | Mercados separados y append-only | Aceptada |
| D-027 | Archivo oficial sin predicciones históricas | Aceptada |
| D-028 | Discovery diario y revisiones inmutables de páginas vivas | Aceptada |
| D-029 | Recuperación de runs y revisión editorial vigente | Aceptada |

## D-001 · Nombre de trabajo Runscars

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** usar `Runscars` como nombre del proyecto y del repositorio.
- **Consecuencia:** identidad visual, dominio y posibles conflictos de marca se
  evaluarán más adelante; el nombre puede revisarse antes de publicar.

## D-002 · Proyecto personal durante prototipo

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** el discovery y el prototipo no se bloquearán esperando permisos
  de todas las fuentes.
- **Consecuencia:** cada fuente conservará un estado de publicación y habrá una
  revisión específica antes de hacer pública la web.
- **Reabrir si:** se monetiza, se comparte públicamente o se reciben peticiones
  de una fuente.

## D-003 · TMDB para metadatos

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** usar TMDB para fichas de películas y personas, fechas e imágenes.
- **Consecuencia:** guardar `tmdb_id`, mantener caché y correcciones locales, no
  exponer el token y añadir atribución antes de publicar.
- **Límite:** TMDB no es fuente de predicciones ni resultados de premios.

## D-004 · Tres señales separadas

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** crítica, predicciones y usuarios se almacenan y presentan por
  separado.
- **Motivo:** responden a preguntas diferentes y no existe una unidad común
  interpretable.
- **Consecuencia:** no habrá una “nota Runscars” que mezcle las tres.

## D-005 · Año de ceremonia como etiqueta principal

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** llamar a una temporada por el año de ceremonia y
  mostrar también el año o periodo de elegibilidad.
- **Ejemplo:** “Oscar 2027 · películas de 2026”.

## D-006 · Ocho categorías iniciales

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** película, dirección, cuatro categorías interpretativas
  y dos categorías de guion.
- **Reabrir si:** el discovery revela que otra categoría es esencial para probar
  el modelo.

## D-007 · Cinco ceremonias históricas en el MVP

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** temporada activa completa y cinco ceremonias previas
  solo con nominados y ganadores confirmados.
- **Alternativas:** una ceremonia previa; todo el archivo histórico.

## D-008 · Comentarios fuera del MVP

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** incluir reseñas enlazadas, pero posponer comentarios de
  usuarios.
- **Motivo:** validan poco del núcleo agregador y añaden moderación, denuncias y
  control antispam.

## D-009 · Actualización diaria y snapshot semanal

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** conectores automáticos una vez al día y snapshot
  público una vez por semana, además de los dos cierres finales.
- **Reabrir si:** la frecuencia real de las fuentes exige otro ritmo.

## D-010 · Stack web gestionado

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** Next.js con TypeScript; Supabase para PostgreSQL, autenticación y
  Row Level Security; Vercel para la web; Supabase Edge Functions y Cron para
  importaciones; Vitest y Playwright para pruebas.
- **Motivo:** minimizar operación para un proyecto personal.
- **Consecuencia:** usar migraciones SQL y tipos generados; no añadir inicialmente
  un ORM adicional.

## D-011 · Consenso Borda normalizado

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** cada fuente ordenada aporta
  `(longitud - posición + 1) / longitud`; una candidatura ausente aporta cero y
  el consenso es la media entre fuentes aplicables.
- **Presentación:** mostrar además cobertura, posición media, mediana y primeras
  posiciones; no presentar el resultado como probabilidad.
- **Motivo:** producir un orden único, transparente y sin ponderar el prestigio
  de las fuentes.
- **Reabrir si:** las pruebas con el dataset de fase 1 muestran sesgos claros por
  diferencias de longitud o cobertura.

## Cierre de la fase 0

El 2026-07-24 se aceptaron expresamente las decisiones D-005 a D-011. Con ello,
las decisiones D-001 a D-011 quedan aceptadas y la fase 0 se considera cerrada.

## D-012 · Agregadores críticos solo como contexto

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** conservar Tomatometer, Metascore y agregados equivalentes como
  valores originales atribuidos, pero no normalizarlos ni introducirlos en la
  media de reseñas individuales.
- **Motivo:** miden conceptos distintos y ya incorporan críticas que Runscars
  puede recibir desde su publicación canónica; incluir ambos duplicaría voces.
- **Consecuencia:** el contrato de observación distingue `score_aggregate` de
  `score_individual`.

## D-013 · Umbrales y deduplicación profesionales de fase 1

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** exigir tres reseñas numéricas independientes para ordenar por
  recepción y tres listas ordenadas para llamar “consenso” a una predicción;
  deduplicar sindicaciones por reseña canónica, autor y película; marcar una
  fuente de predicción desactualizada tras 45 días.
- **Presentación:** los cálculos y desempates usan precisión completa aunque se
  muestren dos decimales.
- **Motivo:** el dataset de fase 1 contiene suficiente cobertura de predicciones
  para probar consenso, pero evidencia lo inestable que sería ordenar recepción
  con una o dos críticas.
- **Reabrir si:** fixtures posteriores muestran demasiadas películas bloqueadas
  o una cadencia editorial distinta.
- **Revisión posterior:** D-025 reemplaza únicamente el mínimo profesional de
  tres listas por cuatro rankings automáticos y publicables por categoría. La
  deduplicación, el mínimo crítico y la ventana de frescura de esta decisión
  siguen vigentes.

## D-014 · Consenso de rankings parciales de usuarios

- **Fecha:** 2026-07-24
- **Estado:** Propuesta
- **Propuesta:** decidir en fase 8, con pruebas de comportamiento reales, cómo
  agregan los rankings parciales y qué mínimo de posiciones deben contener.
- **Mientras tanto:** pueden guardarse y mostrarse individualmente, pero no se
  infieren posiciones ausentes ni se publica un consenso de usuarios.
- **Motivo:** el discovery de fuentes profesionales no aporta evidencia de
  comportamiento de usuarios; cerrar ahora una fórmula sería especulativo.

## D-015 · Catálogo de fuentes sin máximo rígido

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** eliminar el máximo de 12 fuentes y admitir toda candidata que
  supere una puerta explícita de autoridad, trazabilidad, muestras, método
  viable y separación semántica.
- **Resultado del corte:** 28 de 31 candidatas quedan `selected`; BBC Culture
  sigue `sampled`, y Empire y Gold Derby siguen `paused`.
- **Consecuencia operativa:** selección no significa activación inmediata. Las
  fuentes se incorporan por oleadas y cada snapshot registra las activas.
- **Límite metodológico:** fuentes oficiales, festivales y precursores no se
  cuentan como predicciones; un paywall no autoriza copiar contenido ni estimar
  valores ocultos.
- **Reabrir si:** el coste de mantenimiento impide sostener trazabilidad o si
  una fuente deja de superar la puerta de calidad.

## Cierre de la fase 1

El 2026-07-24 se aceptaron D-012 y D-013 a partir del dataset verificable. D-014
queda explícitamente como `Propuesta` y no gobierna todavía el producto. La
segunda revisión aceptó D-015 y amplió el catálogo de 12 a 28 fuentes sin
iniciar la fase 2.

## D-016 · Aplicación definitiva separada del prototipo

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** mantener el prototipo descartable en `prototype/` y construir la
  aplicación definitiva como workspace npm en `web/`, con Supabase y la
  automatización compartida en la raíz.
- **Motivo:** conservar la referencia visual sin convertir el runtime temporal
  de Sites en una dependencia de producción ni mezclarlo con el stack aceptado.
- **Consecuencia:** Vercel usa `web/` como directorio raíz del proyecto y los
  comandos canónicos se ejecutan desde la raíz del repositorio.

## D-017 · Validación SQL portable además del flujo Supabase

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** ejecutar migraciones y seeds en PGlite durante pruebas y
  generación de tipos, además de mantener Supabase CLI como flujo canónico
  local y remoto.
- **Motivo:** verificar sintaxis, relaciones, RLS, permisos e idempotencia sin
  depender de red ni de un daemon de contenedores en cada ejecución.
- **Límite:** PGlite es infraestructura de prueba, no ORM ni base de datos de
  producción. La puerta de fase 3 sigue exigiendo una ejecución real de
  `supabase db reset` antes del cierre.

## D-018 · Catálogo TMDB desacoplado del runtime web

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** limitar las llamadas a TMDB a un importador de servidor y hacer
  que las páginas públicas lean exclusivamente snapshots persistidos en
  Supabase.
- **Persistencia:** una respuesta reducida a los campos necesarios se identifica
  por hash, conserva valor original, locale, URL y captura, y caduca a los 180
  días. Una segunda captura idéntica actualiza la comprobación sin duplicar el
  snapshot.
- **Matching:** `films.tmdb_id` contiene el match activo; una función
  transaccional exige usar `correction` para reemplazarlo y añade una entrada
  append-only con ID anterior, motivo y actor.
- **Motivo:** la web sigue funcionando durante una caída de TMDB, el token no
  entra en el runtime público y las decisiones editoriales son auditables.
- **Límite:** la importación programada y su interfaz administrativa pertenecen
  a fases posteriores; en fase 4 el importador es una herramienta de CLI.

## D-019 · Ingesta append-only con matching conservador

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** persistir publicaciones, capturas y observaciones originales
  por separado; deduplicarlas con hashes estables y aceptar automáticamente
  solo matches exactos contra títulos principales o alternativos.
- **Revisión:** una identidad ausente o ambigua crea una observación pendiente
  sin participación y una entrada privada e idempotente en la cola editorial.
- **Ejecución:** cada conector dispone de su propio run y log. Guardian JSON,
  RogerEbert RSS y AwardsWatch HTML forman el primer corte; un error no detiene
  el siguiente conector.
- **Seguridad:** la función programada usa un secreto propio compartido entre
  Edge Functions y Vault; la configuración versionada no contiene
  credenciales.
- **Motivo:** preservar evidencia, impedir matches plausibles pero falsos y
  permitir correcciones futuras sin destruir el historial.

## D-020 · Agregados derivados y snapshots diferidos

- **Fecha:** 2026-07-24
- **Estado:** Aceptada
- **Decisión:** calcular normalización, recepción crítica y consenso mediante la
  función determinista versionada `runscars-aggregation-v1`; no persistir un
  resultado mutable antes de la fase 7.
- **Fuente activa:** para cada categoría e intención participa la publicación
  elegible más reciente de cada fuente. Una lista ordenada y su selección
  complementaria forman una sola unidad de cobertura y nunca duplican el peso de
  la fuente.
- **Temporalidad:** durante la fase 6 la evolución son cortes recalculables
  acumulados por fecha de publicación. No se presentan como snapshots ni
  prometen inmutabilidad.
- **Precisión:** los términos Borda se estabilizan a doce decimales para evitar
  falsos desempates por representación binaria; cálculo y desempate siguen
  separados del redondeo visual a dos decimales.
- **Motivo:** cualquier cifra puede reconstruirse directamente desde sus
  observaciones y la fase 7 podrá bloquear exactamente esa entrada, versión de
  método y salida sin mantener dos agregados competidores.

## Cierre de la fase 6

El 2026-07-24 los ejemplos de normalización y consenso de la fase 1 coincidieron
con los resultados manuales. La interfaz expone observaciones, términos Borda,
cobertura, desempates y cortes temporales. Los snapshots bloqueados permanecen
fuera de alcance hasta la fase 7.

## D-021 · Snapshots como envolventes inmutables con puntero vigente

- **Fecha:** 2026-07-25
- **Estado:** Aceptada
- **Decisión:** persistir cada snapshot como una envolvente append-only con
  agregado completo, evidencia, fuentes, versión, zona horaria y SHA-256
  canónico. Los triggers impiden modificar o borrar la envolvente y sus enlaces.
- **Correcciones:** una corrección crea otra envolvente con referencia y motivo;
  un puntero separado identifica la versión vigente sin reescribir el historial.
- **Periodicidad:** Vercel Cron invoca semanalmente el mismo motor TypeScript que
  usa la aplicación. La programación solo bloquea observaciones publicadas de
  fuentes `publishable` y omite de forma explícita un alcance sin evidencia.
- **Motivo:** conservar exactamente entrada y salida, evitar duplicar el motor
  de agregación en SQL o en una Edge Function y permitir publicar correcciones
  sin convertir el snapshot original en un registro mutable.

## D-022 · Evaluación versionada sobre cierres explícitos

- **Fecha:** 2026-07-25
- **Estado:** Aceptada
- **Decisión:** usar `runscars-evaluation-v1` solo contra snapshots finales. El
  cierre de nominaciones fija el tamaño y los IDs previstos; el cierre de
  ganador fija la primera posición y conserva el ranking completo.
- **Resultados:** nominaciones y ganadores oficiales son capturas append-only
  con fuente, URL, publicación, captura, original y correcciones enlazadas.
- **Agregado global:** sumar aciertos, predicciones y resultados oficiales entre
  categorías antes de dividir; no promediar porcentajes de categorías.
- **Límite:** un snapshot periódico sirve para evolución, pero nunca se evalúa
  como cierre final. Mientras los Oscar 2027 no publiquen resultados, la
  interfaz indica “pendiente” en lugar de usar datos inventados.

## D-023 · Compatibilidad explícita para `brace-expansion` corregido

- **Fecha:** 2026-07-25
- **Estado:** Aceptada
- **Decisión:** fijar la versión corregida `5.0.8` de `brace-expansion` mediante
  `overrides` y aplicar tras cada instalación un parche local mínimo que expone
  tanto la API CommonJS histórica como la actual. El código de expansión sigue
  procediendo íntegramente del paquete oficial.
- **Motivo:** el ecosistema ESLint instalado todavía consume la exportación
  histórica, mientras que la corrección de seguridad solo está disponible en la
  API actual. El parche mantiene `npm audit` y `npm ls` limpios sin ocultar
  dependencias de desarrollo ni copiar la implementación de terceros.
- **Retirada:** eliminar el parche cuando todos los consumidores transitivos
  admitan directamente la API corregida.

## Cierre de la fase 7

El 2026-07-25 PostgreSQL conservó un snapshot byte a byte tras una importación
posterior, rechazó su mutación y mantuvo original y corrección enlazados. Los
ejemplos manuales de nominaciones y ganador coincidieron con
`runscars-evaluation-v1`. La fase 8 no se ha iniciado.

## D-024 · Candidatura genérica y contratos v2 compatibles

- **Fecha:** 2026-07-25
- **Estado:** Aceptada
- **Decisión:** identificar cada candidatura mediante temporada, categoría,
  película u obra y conjunto de personas; conservar además el orden de
  presentación de los colaboradores.
- **Versionado:** `runscars-aggregation-v2`, `runscars-snapshot-v2` y
  `runscars-evaluation-v2` exponen `candidateId`, película, obra y personas. Los
  contratos v1 y todos sus snapshots permanecen inmutables y reproducibles.
- **Motivo:** soportar sin excepciones interpretaciones, guiones y equipos, así
  como dos intérpretes de una película o una persona con varias películas.

## D-025 · Cobertura profesional mínima por medio y categoría

- **Fecha:** 2026-07-25
- **Estado:** Aceptada
- **Decisión:** una categoría pública necesita al menos cuatro rankings
  ordenados automáticos y publicables; el objetivo operativo inicial es cinco.
  Una fuente manual, un mercado o varios expertos del mismo medio cuentan cero,
  cero y una fuente respectivamente a efectos del mínimo.
- **Temporalidad:** se usa la publicación elegible más reciente por fuente,
  categoría e intención. Una publicación posterior que omite una categoría no
  borra la última lista elegible de esa categoría.
- **Consecuencia:** las categorías adicionales se ingieren si el formato es
  estructurado, pero permanecen no públicas hasta alcanzar su propia cobertura.

## D-026 · Mercados separados y append-only

- **Fecha:** 2026-07-25
- **Estado:** Aceptada
- **Decisión:** Kalshi y Polymarket se capturan cada hora en contratos y
  snapshots append-only por proveedor. Se conserva el valor original y no se
  calcula consenso entre mercados.
- **Límite:** un precio o probabilidad de mercado nunca se convierte en una
  observación profesional ni participa en Borda. La falta de mercado no bloquea
  una categoría ni la fase.

## D-027 · Archivo oficial sin predicciones históricas

- **Fecha:** 2026-07-25
- **Estado:** Aceptada
- **Decisión:** importar nominaciones y ganadores oficiales de Oscar 2026 para
  las ocho categorías, con sus películas, obras y personas, sin reconstruir
  predicciones anteriores a Runscars.
- **Motivo:** ofrecer una temporada cerrada verificable sin fabricar una serie
  temporal que no fue capturada en su momento.

## D-028 · Discovery diario y revisiones inmutables de páginas vivas

- **Fecha:** 2026-07-25
- **Estado:** Aceptada
- **Decisión:** cada ejecución profesional consulta primero el índice, archivo
  o página viva de su fuente. Awards Daily descubre artículos mediante su API
  pública de WordPress; AwardsWatch y The Ringer recorren sus archivos; Awards
  Radar consulta una página actualizable por categoría; Next Best Picture y
  Midnight Critics comprueban directamente sus páginas vivas.
- **Selección:** se ingieren las publicaciones elegibles recientes y el
  agregado conserva, por categoría e intención, la de fecha más reciente. Una
  publicación que omite una categoría no invalida la lista anterior de esa
  categoría. Entre URLs distintas tiene prioridad la fecha de publicación; una
  URL histórica sin fecha no puede desplazar una publicación fechada. Dentro de
  una misma URL viva tiene prioridad la revisión capturada más recientemente.
- **Páginas vivas:** cuando una URL conserva su dirección pero cambia el
  ranking, cada contenido estructurado genera una publicación inmutable
  distinta. Repetir contenido idéntico reutiliza la revisión y no duplica
  observaciones. La identidad de revisión incorpora también la versión del
  extractor, para que una corrección de parsing no mezcle filas antiguas y
  nuevas bajo la misma publicación.
- **Auditoría:** toda ejecución satisfactoria registra `discovery.checked` o
  `discovery.partial` y después `source.updated` o `source.unchanged`. Así, la
  ausencia de cambios también queda demostrada.
- **Ejecución:** los conectores se ejecutan en paralelo y conservan runs,
  eventos y fallos independientes. Esto mantiene el conjunto dentro del tiempo
  máximo de la Edge Function sin convertir el fallo de una fuente en un fallo
  global.
- **Motivo:** una URL fijada a mayo o abril no representa la predicción vigente,
  y mezclar varias revisiones de una página mutable dentro de una sola
  publicación produciría rankings inválidos.

## D-029 · Recuperación de runs y revisión editorial vigente

- **Fecha:** 2026-08-07
- **Estado:** Aceptada
- **Decisión:** antes de iniciar un conector, cerrar como `failed` cualquier run
  suyo que siga `running` después de 15 minutos y registrar
  `connector.abandoned`. La migración de mantenimiento aplica la misma regla a
  runs ya abandonados.
- **Cola editorial:** las observaciones y revisiones históricas permanecen
  trazables, pero solo la revisión más reciente de un mismo conector, tipo,
  temporada, categoría y rótulo normalizado queda `pending`; las anteriores se
  marcan `dismissed` como sustituidas.
- **Motivo:** una terminación forzada de Edge no ejecuta el cierre normal, y una
  página viva puede generar revisiones inmutables repetidas del mismo problema.
  Ninguno de esos casos debe aparentar actividad eterna ni multiplicar trabajo
  editorial.
- **Límite:** el cierre por abandono no reintenta por sí solo ni altera
  observaciones; el siguiente run conserva el aislamiento normal por fuente.
