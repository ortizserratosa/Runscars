# Auditoría de Runscars · 6 de septiembre de 2026

Publicado en [runscars.app](https://runscars.app) desde el commit limpio
`d429f5431efb4fcf4887c6e03ddfa36eaf6a6920`, deployment
`dpl_EFLqrExb7d8megwCadVV5c8VdzoJ`. Se han reparado los destinos públicos,
publicado el circuito festivalero y refinado interfaz y SEO ES/EN. **El plan no
se declara completamente cerrado:** cuatro feeds festivaleros siguen degradados,
el acceso Google completo en producción no se ha ejercitado y faltan métricas de
campo. D-053 permanece `Propuesta`; no se publica consenso comunitario.

## Resultado y alcance de la evidencia

- Crawl completo: **3.538 URLs de sitemap, 3.742 destinos públicos, cero
  hallazgos finales**. La primera pasada tuvo 12 fallos de transporte; se
  reintentaron los doce y todos resolvieron. Se conservan ambos informes. No se
  cuentan los fallos transitorios como 404 ni se ocultan los reintentos.
- UI de producción final: **132 casos, cero fallos**, 33 rutas × dos idiomas ×
  escritorio/móvil. Cero violaciones axe serias/críticas, imágenes rotas,
  overflow o errores de consola en esa muestra.
- Commit desplegado: `npm run verify` pasó formato, lint, tipos, **151
  unitarias, 22 pruebas DB**, build y auditoría con **cero vulnerabilidades**.
  `npm run test:e2e`: **114 pruebas** Chromium escritorio/móvil y smoke
  Firefox/WebKit. No implica que cada recorrido se haya probado en los tres
  motores.
- Las pruebas mutantes de cuentas se ejecutaron con identidades efímeras y
  Supabase **local aislado**. El alias staging redirige a producción y no se usó
  para estas mutaciones. No equivalen a autenticación completa en producción.

El crawl exhaustivo verificó el código funcional de `d3fd0d1` publicado antes
del último ajuste de preload/pesos de fuente. El release final `d429f54` solo
añadió ese ajuste, soporte de reintento al auditor y evidencias. La UI de 132
casos, health y comprobaciones focalizadas posteriores corresponden al release
final.

Evidencia versionada: [crawl final](audits/2026-09-06/public-crawl.json),
[primera pasada](audits/2026-09-06/public-crawl-first-pass.json),
[UI final](audits/2026-09-06/after/ui.json),
[categorías persistidas](audits/2026-09-06/categories.json),
[operación](audits/2026-09-06/operations.json) y
[referencia de release](audits/2026-09-06/release.json).

## Situación inicial

Producción servía `dpl_EY7vDVzy1nYErT2aHZtpPQa739sM` desde un checkout sucio de
`1aa56667fa29286d27d20ca2ef409c3e9637f508`. El crawl inicial encontró **348
respuestas 404** entre 2.438 destinos: 130 rutas de película y 218 de persona.
El sitemap tenía 2.242 URLs. Las rutas festivaleras devolvían 404 aunque su base
ya tenía migraciones, nueve ediciones y 203 entradas. La cookie inglesa anulaba
URLs españolas explícitas. Había contraste insuficiente y el encabezado del
ranking empezaba a 1.067px en escritorio.

## Matriz RF-01–RF-22

| Requisito                            | Implementación y evidencia local                                                  | Producción inicial / defecto                                             | Resultado desplegado y límites                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| RF-01 navegación pública             | Ocho categorías, E2E ES/EN                                                        | Disponible                                                               | Ocho categorías y navegación directa verificadas en crawl/UI                                                                      |
| RF-02 Metascore atribuido            | Tests de presentación; sin promedio propio                                        | Contraste de atribución insuficiente                                     | Enlace corregido, contexto separado y ficha verificada                                                                            |
| RF-03 procedencia y fechas           | Observaciones originales y detalle de fuentes                                     | Disponible                                                               | Fuentes/categorías con recibo y fechas; las comprobaciones sin cambios no alteran `lastmod`                                       |
| RF-04 fichas canónicas               | Catálogo paginado; persona sin captura TMDB sigue resolviendo                     | 348 rutas 404, límite implícito de 1.000 personas                        | Cero destinos rotos en crawl; 85 películas y 1.612 personas en catálogo                                                           |
| RF-05 TMDB y corrección              | Importador y validación manual reproducibles; matching editorial                  | Metadata persistida                                                      | Fichas/posters verificados; no se fuerza matching dudoso ni se prueba una nueva corrección editorial en producción                |
| RF-06 importación manual/automática  | Parsers con fixtures; aislamiento por fuente                                      | Ocho conectores profesionales y dos mercados recientes                   | Runs reales saludables de esos diez conectores; cuatro feeds festivaleros degradados                                              |
| RF-07 idempotencia                   | Tests DB/importadores                                                             | Runs anteriores presentes                                                | Repetición festivalera devuelve unchanged; no crea versiones duplicadas                                                           |
| RF-08 snapshots                      | Inmutabilidad y cortes en tests DB/unitarios                                      | Refresco diario presente                                                 | 06/09 04:47–04:48 UTC: 8 scopes, 5 nuevos, 3 sin cambio, 0 fallos; cortes públicos navegables                                     |
| RF-09 resultados oficiales           | Importador/archivo versionado                                                     | Cinco ceremonias archivadas                                              | Rutas 2022–2026 verificadas; sin inventar predicciones históricas                                                                 |
| RF-10 cuenta/ranking/visionado       | Login, ranking privado persistido, exportación y borrado con identidades aisladas | Google habilitado; altas por email pausadas según D-045                  | Arranque OAuth llega a Google; consentimiento, alta y retorno autenticado de producción sin verificar                             |
| RF-11 aislamiento entre usuarios     | RLS real local y 22 tests DB; lectura privada y escritura ajenas denegadas        | Políticas desplegadas                                                    | Sin mutaciones contra cuentas reales; evidencia aislada, no pase de producción                                                    |
| RF-12 administración                 | Usuario normal recibe 404; admin dedicado accede a 49 formularios                 | Consulta a `market_connectors.name` inexistente; grants locales ausentes | Consulta/grants corregidos y desplegados; mutaciones editoriales de producción no ejercitadas por identidad administrativa        |
| RF-13 frescura                       | Respuesta sin entradas reconocidas falla explícitamente                           | Falsos éxitos festivaleros vacíos                                        | Fallos registrados conservan último conjunto válido; una revalidación web agotó tiempo y queda como riesgo operativo              |
| RF-14 escritorio/móvil               | 114 E2E; foco y objetivos táctiles; labels ES/EN                                  | Contraste y exceso de espacio antes del ranking                          | 132 casos live sin fallos serios/críticos; encabezado de consenso desktop a 779px                                                 |
| RF-15 mercados separados             | Kalshi/Polymarket fuera de Borda, fixtures y tests                                | Dos proveedores actuales                                                 | Señales separadas y runs recientes; no se reinterpretan como consenso                                                             |
| RF-16 ocho categorías/cinco archivos | Fixtures y rutas persistidas                                                      | Disponibles                                                              | Las ocho tienen consenso publicable, cuatro o cinco fuentes ordenadas; archivos ES/EN verificables                                |
| RF-17 metodología/evaluación         | Versiones bloqueadas y tests                                                      | Disponible                                                               | Rutas bilingües verificadas; no se fabrica evaluación sin snapshot anterior                                                       |
| RF-18 comunidad                      | Filtros y perfiles; tests unitarios/E2E                                           | Disponible                                                               | Lectura pública, enlaces y metadata verificados; no se crea consenso comunitario                                                  |
| RF-19 compartir                      | Enlace y OG 1200×630, metadata ES/EN                                              | Rutas compartibles                                                       | E2E, crawl y tarjetas existentes; nueva publicación autenticada solo cubierta aisladamente                                        |
| RF-20 visionado                      | Tres estados, permisos y persistencia local                                       | Implementado                                                             | UI pública y límites de visibilidad verificados; mutación real local, no en cuenta de producción                                  |
| RF-21 nueve festivales               | Migraciones, manifiestos, enlaces, matching y cron                                | Páginas 404; extractores vacíos/bloqueados                               | Nueve ediciones públicas ES/EN, ocho conjuntos actuales; Locarno sin conjunto verificado, cuatro feeds no saludables. **Parcial** |
| RF-22 integridad de enlaces          | Crawler con concurrencia 6; canonical/hreflang/JSON-LD                            | Sitemap truncado y destinos válidos 404                                  | 3.538 URLs de sitemap y 3.742 destinos resueltos, cero hallazgos finales                                                          |

## Todos los recorridos esenciales de PRODUCT.md

| Recorrido                                           | Evidencia                                                                                                                                        | Límite explícito                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| R1 categoría → candidatura → fuentes                | E2E, crawl y UI ES/EN de ocho categorías                                                                                                         | Recepción, mercados y usuarios permanecen separados                              |
| R2 película → metadata/recepción/contexto           | Ficha persistida, atribución y enlaces de festivales                                                                                             | Branded placeholder cuando falta póster; no se fabrica metadata                  |
| R2b circuito → edición → película                   | Nueve páginas ES/EN, importación oficial, fixtures                                                                                               | Entradas pendientes de matching siguen sin enlace; cuatro feeds degradados       |
| R3 cuenta → ranking → visibilidad → edición/borrado | Dos identidades Supabase local; login real, ranking privado tras recarga, RLS, exportación y borrado; límites/manual TMDB en tests reproducibles | Alta Google completa, callback y edición autenticada de producción sin verificar |
| R4 evolución y corte anterior                       | E2E y URL de corte real; disclosure abierto al elegir histórico                                                                                  | Snapshots bloqueados no cambian                                                  |
| R5 resultados → evaluación                          | Tests DB/importador, archivo y evaluación pública ES/EN                                                                                          | No se inventa un snapshot previo a una ceremonia                                 |
| R6 comunidad → perfil → quiniela compartida         | E2E, metadata, OG y controles de lectura pública/privada aislados                                                                                | No se prueba una nueva quiniela publicada por una identidad real de producción   |

La sesión aislada confirmó retorno de login a `/en/cuenta`, rechazo de usuario
normal en `/en/admin`, ranking privado persistido y borrado mediante contraseña
más `ELIMINAR`. La identidad dejó de existir. El test de RLS devolvió cero filas
privadas ajenas, cuatro públicas y cero escrituras ajenas; exportación
autenticada HTTP 200. Se limpiaron las identidades y membresías administrativas
temporales. La consola administrativa cargó 49 formularios tras corregir la
consulta al proveedor de mercado y los grants SELECT. No se enviaron mensajes a
terceros.

## Frontend, SEO y rendimiento

Se conserva logo, paleta y tipografía editorial. Inicio y categorías son más
compactos; hay navegación directa, descubrimiento de festivales, posters
persistidos y resumen del corte actual con historial accesible bajo demanda. Se
corrigen contraste, labels de pósters por idioma y objetivos táctiles de 44px.

La URL manda sobre la cookie de idioma; cambio de idioma y retornos de acceso
conservan ruta/query internos validados. Origen canónico único, alternates
recíprocos ES/EN/x-default, metadata y tarjetas localizadas. Filtros y cortes
canonicalizan a su landing. Superficies privadas y autenticación usan noindex;
el sitemap no las publica. JSON-LD describe contenido visible sin presentar
consenso como rating o probabilidad. Los errores de catálogo/fuentes en
producción se propagan y no se convierten en falsos 404 o colecciones vacías.

Referencias aplicadas:
[localización de Google](https://developers.google.com/search/docs/specialty/international/localized-versions),
[sitemaps de Google](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
y [distinción entre laboratorio y campo](https://web.dev/articles/vitals). La
validación estructurada comprueba sintaxis y correspondencia de templates; no
equivale a aprobación de resultados enriquecidos por Google.

Mediciones Chromium sin throttling, escritorio 1440×1000 / móvil 390×844. Cada
valor siguiente es una muestra de carga, no un percentil de visitantes.

| Página / dispositivo      | LCP antes → después (ms) | CLS después |
| ------------------------- | -----------------------: | ----------: |
| Inicio escritorio         |              1252 → 1856 |     0,00059 |
| Inicio móvil              |              1240 → 1112 |           0 |
| Mejor película escritorio |               1596 → 648 |           0 |
| Mejor película móvil      |               1336 → 580 |           0 |
| Fjord escritorio          |              2412 → 1192 |           0 |
| Fjord móvil               |              1892 → 1020 |           0 |

El inicio desktop no mejoró su LCP en esa muestra, aunque quedó dentro del
objetivo de laboratorio. En los 132 casos finales: máximo LCP **1904ms**, máximo
CLS **0,00123** (redondeado al alza). INP no medido. El encabezado de consenso
pasó de 1067 a 779px desktop y de 1241 a 1058px móvil.

[Capturas antes](audits/2026-09-06/before/ui.json) y
[después](audits/2026-09-06/after/ui.json) enlazan sus PNG relativos. La prueba
intermedia de desactivar preload mono produjo CLS móvil 0,173; se conserva como
[evidencia intermedia](audits/2026-09-06/intermediate/ui-before-font-fix.json).
Se restauró preload crítico con solo pesos 400/700. Tres cargas móviles frescas
adicionales dieron CLS 0 y LCP 2296/968/924ms.

Se desactiva prefetch masivo y se comparten datos **públicos** de categorías,
consenso y festivales con revalidación de 60s; no se cachean sesiones, rankings,
visionado ni administración. La proyección festivalera pasó de 1.915.968 a 2.808
bytes al omitir recibos que la vista no necesita; se conservan íntegros en BD.

## Operación y limitaciones pendientes

Migraciones `20260906160000`, `20260906170000` y `20260906180000` aplicadas en
local/producción; `run-festivals` v5 desplegada. `run-ingestion` v37 y
`run-markets` v6 corresponden al código actual (una diferencia de formato en
profesionales, sin cambio semántico). Cron: profesionales 04:17 UTC, festivales
05:17 UTC, mercados cada hora :17; snapshots Vercel 04:47 UTC.

La llamada real a Edge `run-festivals` devolvió HTTP 200 con **status partial,
cuatro fallos, sin timeout global**. Fue una invocación manual del mismo
endpoint protegido que usa cron; no se etiqueta como una ejecución programada
nueva. Berlín v3 conserva 21 entradas de largometraje; Venecia 91 y San
Sebastián 25. Las versiones anteriores permanecen inmutables. La repetición no
duplicó conjuntos.

| Feed                                                | Estado observado 06/09                                              | Pendiente                                              |
| --------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| Sundance, Berlinale, Cannes, Venecia, San Sebastián | Verificación oficial satisfactoria                                  | Mantener fixtures/versiones ante cambios externos      |
| Locarno                                             | HTTP 403; sin conjunto actual verificado                            | Fuente oficial accesible o carga editorial verificable |
| NYFF                                                | Bloqueo/HTML no reconocido (403 local; respuesta Edge sin entradas) | Captura oficial válida y parser probado                |
| TIFF                                                | Respuesta vacía/no reconocida                                       | Fuente oficial y formato verificables                  |
| Telluride                                           | Guía en formato PDF no soportado por el parser HTML                 | Extracción PDF con fixture y revisión editorial        |

Durante la última UI se registró un timeout de revalidación del consenso público
en `/peliculas/fjord` a 21:43:37 UTC. La página sirvió el último valor válido y
pasó sus checks. Tres lecturas anónimas posteriores de los 129 snapshots
respondieron en 418/728/312ms, sin error; el payload completo es 5,73MB, de los
que 5,63MB son agregado necesario para los cortes. No se atribuye una causa
concluyente ni se afirma que los logs estén limpios. La frescura bajo carga
sigue siendo un riesgo: si se repite, perfilar/paginar ese historial conservando
la semántica de cortes.
[Lecturas posteriores](audits/2026-09-06/prediction-read-check.json).

Google está habilitado y las altas email deshabilitadas conforme a D-045. El
[arranque OAuth](audits/2026-09-06/oauth-launch.json) alcanza
`accounts.google.com`; consentimiento, creación de cuenta y retorno autenticado
completos quedan **sin verificar**. No hay Search Console, CrUX ni INP de campo:
no se afirma el cumplimiento de Core Web Vitals de visitantes reales.

## Reproducción y rollback

- `npm run verify` y `npm run test:e2e`: validación canónica reproducible.
- `npm run audit:public`: sitemap/enlaces, títulos, canonical, alternates,
  JSON-LD y errores de render enviados con HTTP 200; concurrencia por defecto 6.
  `RUNSCARS_AUDIT_BASE_URL` selecciona URL, `RUNSCARS_AUDIT_REPORT` el informe;
  `RUNSCARS_AUDIT_RESUME` reintenta hallazgos conservando evidencia anterior.
- `npm run audit:ui`: rutas esenciales ES/EN, axe, layout, imágenes, consola y
  métricas de laboratorio; `RUNSCARS_UI_OUTPUT` fija salida.
- `RUNSCARS_AUDIT_SKIP_PUBLIC=true npm run audit:production`: parsers/frescura,
  con secretos suministrados fuera de Git.
- `npm run phase8:staging-check`: solo en entorno aislado, nunca en el alias
  staging que redirige al sitio real.

El primer commit integrado fue `26b1032`; las correcciones posteriores quedan
trazadas en la misma rama `codex/festival-integrity-2027`. Las evidencias de
cierre se añaden en un commit documental posterior al código publicado, sin
cambiar el artefacto desplegado. Ver [OPERATIONS.md](OPERATIONS.md) para
referencias, rollback web, migraciones y límites de la copia de respaldo.
