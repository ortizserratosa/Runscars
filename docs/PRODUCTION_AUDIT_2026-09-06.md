# Auditoría de Runscars · 6 de septiembre de 2026

Corte vertical: integridad de publicación, descubrimiento festivalero, interfaz y
SEO bilingüe. No inicia una nueva fase ni publica consenso comunitario. D-053
continúa propuesta. Los resultados locales no sustituyen evidencia de producción.

## Situación inicial

Producción servía `dpl_EY7vDVzy1nYErT2aHZtpPQa739sM` desde un checkout sucio de
`1aa56667fa29286d27d20ca2ef409c3e9637f508`. El crawler completo encontró 348
respuestas 404 entre 2.438 destinos visitados: 130 rutas de película y 218 de
persona. El sitemap tenía 2.242 URLs. Las rutas de festivales no estaban publicadas.
La base sí tenía las migraciones festivaleras, nueve ediciones y 203 entradas.
La cookie inglesa anulaba URLs españolas explícitas. Axe detectó contraste
insuficiente en tarjetas de temporada y atribución cinematográfica.

## Matriz de requisitos

| Requisito | Implementación y evidencia local | Producción inicial / discrepancia | Verificación de publicación |
|---|---|---|---|
| RF-01 navegación pública | Rutas de ocho categorías; E2E bilingüe | Disponible | Crawler + auditoría UI |
| RF-02 Metascore atribuido | Ficha y tests, sin promedio propio | Disponible; contraste del enlace corregido | UI película + procedencia |
| RF-03 procedencia y fechas | Observaciones originales, detalle de fuentes | Disponible | Fuentes y categorías públicas |
| RF-04 fichas canónicas | Catálogo paginado; personas sin captura TMDB siguen resolviendo | 348 destinos 404 | Crawler exhaustivo requerido |
| RF-05 TMDB y corrección | Repositorio, comandos y pruebas reproducibles | Datos persistidos presentes | No se alteran emparejamientos dudosos automáticamente |
| RF-06 importación manual/automática | Parsers con fixtures; aislamiento por fuente | Ocho conectores profesionales y dos mercados recientes | Auditoría de parsers y runs reales |
| RF-07 idempotencia | Tests DB y festival/versiones | Runs exitosos presentes | Repetición festivalera y DB |
| RF-08 snapshots | Tests de inmutabilidad y navegación de cortes | Refresco 06/09 04:48 UTC: 8 categorías, 0 fallos | Historial compartible y auditoría de runs |
| RF-09 resultados oficiales | Importador y archivo versionado | Cinco ceremonias archivadas | Archivo 2022–2026 |
| RF-10 cuenta/ranking/visionado | Dos identidades aisladas; login, guardado privado, exportación y borrado reales | No se prueban mutaciones contra usuarios de producción | OAuth/entrega real de correo pendientes |
| RF-11 aislamiento entre usuarios | Test real Supabase local y 22 tests DB; lectura privada ajena y escritura ajena denegadas | Políticas desplegadas | No se cuenta como prueba mutante en producción |
| RF-12 administración | Allowlist, acciones editoriales y tests DB; usuario normal recibe 404; administrador dedicado accede a 49 formularios editoriales | Consola restringida | Identidad administrativa real de producción no ejercitada |
| RF-13 frescura | Fallo explícito si HTTP válido no contiene entradas reconocibles | Festivales tenían falsos éxitos vacíos | Registrar fallos reales sin borrar último conjunto |
| RF-14 escritorio/móvil | 114 E2E Chromium/Firefox/WebKit; foco y controles; auditoría axe | Ranking desktop empezaba a y=1067px | Screenshots y axe en despliegue |
| RF-15 mercados separados | Proveedores identificados, fuera de Borda | Kalshi y Polymarket actuales | Parsers: 85 y 132 contratos, respectivamente |
| RF-16 ocho categorías/cinco archivos | E2E y fixtures | Disponibles | UI bilingüe y crawler |
| RF-17 metodología/evaluación | Versiones bloqueadas, sin inventar predicciones históricas | Disponible | Rutas bilingües |
| RF-18 comunidad | Filtros, perfiles; sin promedio público de usuarios | Disponible | E2E y lectura pública |
| RF-19 compartir | Metadata bilingüe y OG 1200×630 por quiniela | Rutas compartibles | E2E, imágenes y metadata |
| RF-20 visionado | Tres estados; visibilidad vinculada al ranking | Implementado | E2E y autorización DB; guardado local real |
| RF-21 nueve festivales | Migraciones, manifiestos, enlaces, matching, cron aislado | BD presente pero páginas 404; varios extractores vacíos/bloqueados | Publicar nueve páginas; automatización incompleta queda explícita |
| RF-22 integridad de enlaces | Crawler bounded (6), sitemap paginado, hreflang/canonical | Catálogo truncado a 1000 personas | Cero 404 de sitemap exigido |

## Recorridos esenciales

| Recorrido | Evidencia | Límite |
|---|---|---|
| R1 categoría → candidatura → fuentes | E2E y UI ES/EN, ocho categorías | No combina recepción/mercados/usuarios |
| R2 ficha y contexto | TMDB persistido, atribución y enlaces de festivales | Ausencia de póster usa marca; no fabrica metadata |
| R2b circuito → edición → película | Fixtures, importación y páginas bilingües | Entrada sin matching sigue sin enlace editorial |
| R3 login → ranking → visibilidad → editar/borrar | Supabase local con identidades dedicadas; validación de límites/manual TMDB en unitarias/E2E | Google OAuth y correo real no verificados; validación TMDB externa no se falsea con un test en vivo |
| R4 actualización efectiva anterior | E2E abre disclosure y conserva corte compartible | Snapshots bloqueados no cambian |
| R5 resultados → evaluación | Pruebas DB/importador y archivo público | No inventa evaluación sin snapshot previo |
| R6 comunidad → perfil → compartir | E2E, metadata y OG | Sin consenso comunitario |

## Verificación reproducible

- `npm run verify`: formato, lint, tipos, unitarias, DB, build y dependencias.
- `npm run test:e2e`: Chromium escritorio/móvil y smoke Firefox/WebKit.
- `npm run audit:public`: sitemap completo y enlaces internos alcanzables,
  canonical, título e idiomas. `RUNSCARS_AUDIT_BASE_URL` selecciona despliegue;
  `RUNSCARS_AUDIT_REPORT` fija el JSON de evidencia. No modifica datos.
- `npm run audit:ui`: rutas esenciales ES/EN, escritorio/móvil, axe,
  overflow, imágenes, errores de consola, screenshots y métricas de laboratorio.
  `RUNSCARS_UI_OUTPUT` fija el directorio. LCP/CLS se miden sin throttling, no son
  Core Web Vitals de campo; no se mide INP de campo.
- `RUNSCARS_AUDIT_SKIP_PUBLIC=true npm run audit:production`: parsers y frescura
  con credenciales de servidor suministradas fuera de Git.
- `npm run phase8:staging-check`: dos identidades temporales en Supabase local,
  RLS, lectura pública/privada, exportación y limpieza. Nunca usar el alias
  `runscars-staging.vercel.app` para mutaciones: redirige a producción.

La sesión aislada adicional comprobó login con contraseña, retorno `/en/cuenta`,
usuario normal rechazado en `/en/admin`, ranking privado persistido tras recarga,
y borrado con contraseña y confirmación `ELIMINAR`; la identidad dejó de existir.
No se usaron cuentas personales ni se enviaron mensajes a terceros.
La comprobación de administrador detectó y corrigió grants SELECT ausentes en
el entorno local para snapshots/resultados y una consulta a `market_connectors.name`
(inexistente); se usa el proveedor. Tras corregir, la consola cargó 49 formularios.
Las comprobaciones son de uso normal autorizado, no pruebas de explotación.

## Rendimiento y limitaciones

Baseline Chromium sin throttling (1440×1000 / 390×844): LCP home 1252/1240ms,
categoría 1596/1336ms, ficha 2412/1892ms; CLS 0 en seis muestras. Se conserva
el sistema tipográfico y se desactiva el preload de la fuente mono no principal.
Los screenshots y métricas de la publicación se registran abajo.

No se dispone de Search Console ni de CrUX de campo. No afirmar LCP ≤2,5s,
INP ≤200ms y CLS ≤0,1 para visitantes reales a partir de estas muestras.
La entrega real de correo y Google OAuth requieren acceso dedicado y quedan
sin verificar. Varias fuentes festivaleras bloquean el acceso automatizado o
publican un formato aún no soportado; se conserva su última selección verificada.
Esto impide declarar completada toda la automatización de RF-21.

## Referencia de publicación

Se integraron todos los cambios relacionados preexistentes en `26b1032` y
correcciones verificadas posteriores. Pendiente de añadir despliegue final y
resultados posteriores a la
promoción. Ver [OPERATIONS.md](OPERATIONS.md) para promoción y rollback.

## Incidencia observada durante la verificación

Las auditorías simultáneas y el prefetch de enlaces generaron consultas repetidas
a categorías, snapshots y mercados. Se observó un timeout y se pausaron los
crawlers; la consulta de mercados volvió a 411ms una vez drenadas las peticiones.
No se cambiaron políticas RLS ni se incrementaron privilegios para resolverlo.
Se reduce la demanda con revalidación pública de 60s y prefetch desactivado en
la navegación/categorías. Las mediciones finales deben realizarse por separado
del crawl exhaustivo. Este episodio no se registra como una verificación pasada.
