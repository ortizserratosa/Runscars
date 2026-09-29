# Revisión de avisos de Vercel · 29 de septiembre de 2026

## Alcance y estado inicial

Revisión de los avisos recientes de Vercel y mantenimiento de Runscars, sin
iniciar una fase nueva. Se conservan los cambios locales previos en
`OPERATIONS.md` y la auditoría de indexación del 17 de septiembre.

| Aviso | Comprobación | Resolución |
|---|---|---|
| 28/09: completar DNS de `runscars.app` | Vercel devuelve `verified: true`, `misconfigured: false`, sin conflictos. Los A `216.198.79.1` y `64.29.17.1` coinciden con los recomendados; `www` usa `92dbbddb750e1971.vercel-dns-017.com`. HTTPS responde y `www` redirige con 308. | No hay avería: Name.com sigue siendo el DNS autoritativo. No es necesaria la migración opcional de nameservers propuesta por el correo. |
| 26/09: 100% de Fluid Active CPU | El panel atribuye 4 h 6 min a Runscars en los últimos 30 días; el conjunto del equipo muestra 4 h 7 min. La web sigue disponible. | Optimización de la lectura de predicciones descrita en D-062; el consumo acumulado permanece sujeto a los límites de Vercel. |
| 19/09 y 05/09: cuota de transformaciones de imágenes | El despliegue vigente `e3ecd3e` ya desactiva el optimizador (D-038). El panel del 29/09 muestra cero transformaciones, lecturas y escrituras en los últimos 30 días. | Mantener la entrega directa desde TMDB y la prueba de regresión existente. |
| 19/09: nuevo acceso | El propietario reconoce expresamente el acceso consultado. | No requiere recuperación de cuenta. No se registran IP ni datos personales en este informe. |
| 01/09: despliegue de producción fallido | `dpl_BM7rYPQ3QYAtzTaR5VAYuwseBDnp`: `The specified Root Directory "web" does not exist`. Despliegues posteriores están `READY`, incluido el vigente `dpl_DiazDXbbKLugiaR9UnmgriaHsVVr`. | Incidencia histórica superada. Publicar desde la raíz del repositorio, cuyo proyecto Vercel tiene `rootDirectory: web`. |

El correo de DNS describe explícitamente una alternativa A/CNAME compatible.
La [documentación de DNS de Vercel](https://vercel.com/docs/domains/working-with-dns)
y su API de configuración confirman que no hace falta cambiar el proveedor
autoritativo para servir el dominio.

## Evidencia de consumo y errores

En Observability, las últimas 12 horas anteriores al cambio mostraban 1.200
invocaciones y 0% de errores HTTP y timeouts de función. Los grupos principales
eran categorías (234 invocaciones, 47 s de CPU), personas (810, 39 s), películas
(63, 26 s) y portada (52, 9 s). Son medidas agregadas del panel, no un perfil
exclusivo del cálculo de históricos.

El grupo de errores de revalidación registra nueve errores de PostgreSQL
`canceling statement due to statement timeout`, con último evento el 28/09 a
las 23:29:40 UTC. Afecta a `public-predictions-v1`: una consulta sin paginar
recupera los payloads históricos de ocho categorías y después los proyecta de
nuevo cada 60 segundos. Las vistas de categoría repiten ese trabajo para cada
selección de corte. Los fallos de revalidación pueden servir datos previamente
cacheados y por ello no equivalen a errores HTTP.

Las consultas detalladas mediante `vercel metrics` exigen Observability Plus;
se usaron las cifras disponibles en el panel existente y los logs del conector.
No se contrató el complemento ni se modificó el plan. La
[guía de uso de Vercel](https://vercel.com/docs/pricing/manage-and-optimize-usage)
describe el seguimiento por equipo y proyecto.

Una lectura anónima de control recuperó 194 snapshots completos (7.841.347
bytes de JSON) y 810 fechas de captura (aproximadamente 49 KB). La salida de
las ocho categorías ocupó 170.712 bytes. El historial no estaba truncado en
esa lectura; la paginación previene el problema cuando crezca. La consulta
grande tardó 345 ms y el parseo consumió 18,3 ms de CPU en el equipo local.
Son mediciones puntuales, distintas de la CPU facturada por Vercel.

La comparación posterior conserva exactamente el JSON de las ocho categorías.
Los índices compactos ocupan entre 51.772 y 70.159 bytes por categoría
(459.217 bytes en total), por debajo del límite de una entrada de caché de
Next.js. Esta comparación verifica equivalencia y tamaño; la reutilización
real de caché se comprueba por separado con `next start`.

## Corrección

La decisión [D-062](DECISIONS.md#d-062--lectura-pública-de-predicciones-reutilizable-por-corte)
separa los punteros y estados volátiles del historial inmutable. La consulta
paginada elimina el riesgo de truncar la temporada al alcanzar el máximo de
filas de PostgREST. La proyección compartida evita reconstruir el mismo
historial desde películas, fuentes, categorías y ediciones semanales.

No requiere migraciones SQL, cambios de funciones Edge, importaciones ni nuevos
permisos. No modifica observaciones ni snapshots.

`.vercelignore` excluye del paquete de despliegue la documentación, el prototipo
retirado y la configuración local de agentes. `vercel deploy --dry --json`
confirma que mantiene la aplicación y sus módulos compartidos, excluye los
entornos locales y reduce la carga de aproximadamente 39 MB a 10 MB. Los
documentos y sus evidencias permanecen en el repositorio.

## Verificación y publicación

Pendiente de registrar las comprobaciones y el artefacto final de este corte.

La auditoría viva de parsers (`RUNSCARS_AUDIT_SKIP_PUBLIC=true npm run
audit:production`) pasó los seis parsers profesionales y ambos mercados.
El grafo público completo se sustituye en este corte por una muestra funcional
ES/EN para evitar añadir miles de renders a una cuota ya agotada. El entorno
local de desarrollo no contiene credenciales de servidor; la credencial
administrativa del archivo local de producción tampoco resultó válida, por lo
que no se certifica desde ese archivo el estado privado de todos los cron.

La vista pública de frescura confirmó comprobaciones del 29/09 para siete
fuentes automáticas; AwardsWatch conserva como último éxito el 17/09 y registra
un fallo posterior el 29/09. Esta incidencia del conector es independiente de
los avisos de Vercel y no se declara resuelta por optimizar la lectura web.

## Límite operativo

Reducir trabajo futuro no recupera la cuota consumida. El correo de Vercel
advierte de posible pausa al exceder la cuota Hobby. La disponibilidad observada
durante esta revisión no garantiza que el proveedor mantenga esa tolerancia.
No se atribuirá una reducción mensual de CPU a pruebas puntuales: debe
contrastarse con la siguiente ventana de consumo.
