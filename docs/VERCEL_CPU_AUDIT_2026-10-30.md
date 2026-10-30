# CPU activa de Vercel · 30 de octubre de 2026

## Resultado del diagnóstico

El aviso recibido declara agotadas las cuatro horas de CPU activa incluidas en
el equipo gratuito `nazzozzo-s-projects` y anuncia una pausa para el 31/10/2026.
La revisión del equipo completo identifica a Runscars como origen principal:
concentra el 99,6 % del consumo mostrado. Optimizar únicamente los otros
proyectos no resolvería esta incidencia.

La consulta de la API realizada el 30/10 todavía devuelve `plan: hobby`,
`blocked: null` y `softBlock: null`. Los despliegues revisados de los cuatro
proyectos figuran `READY`. Es el estado observado durante la auditoría; no
prueba que Vercel haya retirado la pausa anunciada ni que las páginas sean
accesibles para cualquier visitante.

## Evidencia del equipo completo

El panel autenticado de Vercel, con el intervalo de últimos treinta días que la
interfaz muestra del **30/09 a las 05:00 al 30/10 a las 06:00**, presenta:

| Proyecto | CPU activa mostrada | Porcentaje mostrado |
| --- | --- | --- |
| Runscars | 4 h 3 min | 99,6 % |
| `criter` | 52 s | 0,4 % |
| `criter-writing-studio` | 8 s | 0,1 % |
| `q3-daily` | Sin serie visible en ese desglose | No determinado |
| Total del equipo | 4 h 4 min | — |

Son las cifras redondeadas que muestra el panel; los porcentajes no deben
sumarse como medidas exactas. La ausencia de una serie visible de `q3-daily` no permite
afirmar consumo absoluto cero. Se conservan las horas tal como se observaron,
sin atribuirles una zona horaria que el recibo no especifica.

Se conserva un [recibo compacto del panel](audits/2026-10-30/team-usage-baseline.json).

En la misma revisión, el equipo registra aproximadamente **149.000 invocaciones
de runtime** y **94.625 peticiones de CDN**, mostradas también como unas 95.000.
Las invocaciones y las peticiones de CDN son métricas diferentes; no se suman
ni se usan para deducir visitas humanas. El gráfico diario muestra consumo de
CPU persistente, sin evidencia suficiente para atribuirlo a bots o a un actor
concreto.

La muestra de las últimas doce horas de Runscars presenta unas **1.700
invocaciones**. Entre las familias de rutas visibles destacan:

| Familia de ruta en el panel | Invocaciones | CPU activa mostrada |
| --- | --- | --- |
| Películas | 252 | 2 min |
| Categorías | 376 | 1 min |
| Fuentes | 84 | 31 s |
| Portada | 168 | 28 s |
| Feed | 13 | 23 s |
| Personas | 290 | 18 s |

Este desglose es una muestra del panel, no una enumeración de todas las rutas
ni un perfil de cada petición. Sus cifras están redondeadas y no predicen el
ahorro de un cambio todavía no medido en producción.

En las últimas doce horas, el panel AI Traffic muestra **58** en el grupo
`crawler` y **506** en `assistant`, de los cuales **482** corresponden a
`oai-searchbot`. Son contexto de tráfico: su clasificación y su unidad no son
equivalentes a las 1.700 invocaciones de runtime ni a la CPU activa. No se
deduce de estas cifras un porcentaje de CPU ni una causa del agotamiento. La
evidencia no justifica bloquear rastreadores o perjudicar SEO como remedio.

## Otros proyectos y límites de observación

`criter`, `criter-writing-studio` y `q3-daily` conservan protección SSO de Vercel con el modo
`all_except_custom_domains`. No se ha desactivado esa protección para realizar
la auditoría. Un estado `READY` certifica el estado del despliegue, pero no una
comprobación pública de sus recorridos ni de sus dominios personalizados.

La consulta de métricas mediante CLI requiere Observability Plus en esta
cuenta. No se contrata ese complemento. El desglose anterior procede del panel
autenticado y el estado del equipo/despliegues procede de las consultas de API;
no se presenta una descarga de métricas CLI inexistente.

La consulta de grupos de errores también muestra incidencias previas de
Supabase: revalidaciones con `statement timeout`, `upstream request timeout`
y peticiones agotadas a los 300 segundos, con eventos del 30/10 anteriores a
este despliegue. No se atribuyen a este mantenimiento ni se declaran resueltas
por reducir CPU. La consulta reciente de logs de aplicación de treinta minutos
no devuelve entradas de error/advertencia; una ventana vacía no invalida los
grupos históricos.

## Contribución posible de las auditorías propias

Antes de este mantenimiento, `npm run audit:production` invoca
[`audit-public.mjs`](../web/scripts/audit-public.mjs), que parte del sitemap
completo y sigue enlaces internos, incluidas variantes con parámetros. No era
una comprobación limitada a las rutas esenciales.

Los recibos del 07/10 registran
[4.418 URLs en la primera pasada](audits/2026-10-07/public-before.json) y
[5.218 en la segunda](audits/2026-10-07/public-after.json): **9.636 páginas
recorridas entre ambas ejecuciones**, además de las consultas de sitemap y los
posibles reintentos. Ese tráfico propio puede contribuir al trabajo del
servidor. Los recibos no permiten cuantificar su CPU ni demostrar que esas
auditorías se ejecutaran cada día; tampoco explican por sí solos el total
mensual.

Se acuerda que la auditoría pública use por defecto una muestra explícita y
acotada. El recorrido exhaustivo se reserva a `--full`, con presupuesto de
peticiones y User-Agent identificable para seguir su contribución. La implementación supera cuatro pruebas HTTP locales: catálogo bilingüe grande,
presupuesto físico con redirecciones/reintentos y reanudación con alcance
explícito. Su publicación se comprueba por separado.

## Qué permite recuperar servicio sin pagar

La documentación vigente del [plan Hobby](https://vercel.com/docs/plans/hobby#hobby-billing-cycle)
indica que no existe un ciclo de facturación y que, normalmente, al agotar un
recurso hay que esperar treinta días. No hay base para prometer que el contador
se restablezca el 1 de noviembre. Una [respuesta de Vercel Staff](https://community.vercel.com/t/vercel-account-paused/45523/2)
describe una ventana móvil de treinta días y la petición de reactivación cuando
el uso vuelva a estar dentro de los límites.

La [guía actual de Vercel Staff para equipos pausados](https://community.vercel.com/t/what-to-do-when-your-team-is-paused-or-blocked/45069)
ofrece otra vía: el asistente de [Vercel Help](https://vercel.com/help) puede
conceder un aumento de cuota **por una sola vez** para reactivar los proyectos.
Su disponibilidad en esta cuenta y la concesión efectiva siguen pendientes.
Comunicar la petición a soporte requiere autorización del usuario; esta
auditoría no envía mensajes ni afirma que se haya concedido el aumento.

La [documentación de planes](https://vercel.com/docs/plans) advierte que Hobby
se pausa al exceder los recursos incluidos. La página de
[Functions con precios legacy](https://vercel.com/docs/functions/usage-and-pricing/legacy-pricing#hobby)
explicita que pausar el equipo Hobby afecta a despliegues nuevos y existentes.
Aunque esa página describe el runtime anterior, no se ha encontrado una
excepción actual que garantice continuidad a los proyectos estáticos cuando se
bloquea el equipo. El aviso recibido afecta al equipo y se trata como riesgo
para los cuatro proyectos.

La [CPU activa de Fluid](https://vercel.com/docs/functions/usage-and-pricing)
mide ejecución efectiva de código; esperar una consulta externa no consume esa
CPU. Cachear lecturas, evitar comprobaciones Auth innecesarias y prerenderizar
puede reducir consumo futuro. Esas medidas no borran el uso acumulado ni
acreditan que el proveedor vaya a cancelar la pausa anunciada. El estado de
Vercel y el ahorro de la aplicación se verifican por separado.

## Mantenimiento de Runscars

[D-076](DECISIONS.md#d-076--catálogo-público-reutilizable-y-sesión-anónima-sin-trabajo-auth)
registra un corte de mantenimiento del coste, sin abrir una fase nueva:

- Reutilizar entre peticiones las fichas públicas de películas y personas
  durante sesenta segundos, con claves de entidad, idioma y backend y con
  memoización React dentro de la petición.
- Evitar crear clientes Auth y comprobar sesiones cuando no existe cookie
  Supabase. Las cookies completas o fragmentadas existentes continúan pasando
  por la validación de Supabase; la presencia de una cookie no autentica al
  visitante.
- Mantener privados la sesión, el visionado, los rankings restringidos y la
  administración. Se conservan RLS, autorización y expiración de metadatos.
- Acotar la auditoría pública ordinaria y exigir `--full` para recorrer el
  grafo completo, con presupuesto de peticiones y User-Agent trazable.

Archivos principales:
[catálogo](../web/src/lib/repositories/catalog.ts),
[sesión](../web/src/lib/auth/session.ts),
[detección de cookie](../web/src/lib/auth/session-cookie.ts) y
[proxy de Supabase](../web/src/lib/supabase/proxy.ts).
El mantenimiento está publicado; su efecto sobre el consumo mensual sigue
pendiente de una ventana comparable.

## Verificación local

- `npm ci`: instalación reproducible; cero vulnerabilidades conocidas.
- `NEXT_PUBLIC_SUPABASE_URL='' NEXT_PUBLIC_SUPABASE_ANON_KEY='' npm run verify`:
  formato, lint, tipos, 433 pruebas unitarias, 53 de base de datos, compilación
  de producción y auditoría de dependencias correctos.
- [Smoke de catálogo con Next real](audits/2026-10-30/catalog-cache-smoke.json):
  dos peticiones HTTP independientes reutilizan la caché persistente. Persona
  pasa de tres lecturas a cero y película elimina las tres lecturas de catálogo;
  la consulta de Metacritic sigue independiente. ES/EN tienen claves distintas
  y las peticiones anónimas no llaman a Auth.
- `npm run test:e2e`: 142 recorridos correctos en escritorio y móvil, incluidos
  Chromium, Firefox, WebKit y accesibilidad.
- Las muestras de CPU local incluyen renderizado y runtime: no equivalen a CPU
  facturada por Vercel y no acreditan un ahorro mensual.

La instalación inicial detectó cinco vulnerabilidades, incluida una crítica
de Next.js. Se actualizan Next.js y su configuración ESLint a 16.4.3, Zod a
4.6.7 y Vitest a 4.1.12, con el parche transitivo de Vite. La instalación final
con `npm ci` y `npm run audit` devuelve cero vulnerabilidades conocidas.

## Publicación y comprobación

Se publica el commit `c5d826aaa7982356ba0e887e6c86a43edc64f937`, con autor y
committer GitHub `noreply`, desde la raíz enlazada al proyecto `runscars` del
equipo auditado. El artefacto de producción
[`dpl_6dm2GGypZYXLPMYSYZ2JtDnXnUWA`](https://vercel.com/nazzozzo-s-projects/runscars/6dm2GGypZYXLPMYSYZ2JtDnXnUWA)
queda `READY`. Supera las [27 comprobaciones previas](audits/2026-10-30/release-staged.json)
antes de promover ese mismo URL a `https://runscars.app`.

Las [27 comprobaciones públicas](audits/2026-10-30/release-public.json) pasan:
salud y base de datos, portada, categoría, película, fuente, acceso, comunidad,
festivales, edición y semana, en ES/EN, además de robots, sitemap e imagen
social. Sin sesión, cuenta y administración redirigen al acceso en su idioma.
El [muestreo público nuevo](audits/2026-10-30/public-sample.json) recorre 32 de
las 4.950 URLs del sitemap con 33 solicitudes y cero hallazgos; declara
`mode: sample` y `fullGraphComplete: false`.

La consulta de errores/advertencias del artefacto nuevo realizada a las
12:18 UTC no devuelve logs. Es una comprobación inmediata, no una garantía de
salud continua ni una resolución de los grupos históricos de Supabase.
No se modifica la base de datos, no hay migraciones ni funciones Edge que
desplegar, y se conservan los cuatro proyectos y el plan Hobby.

## Pendiente de recuperación de cuota

- Resolver con el usuario la comunicación a soporte para comprobar el aumento
  único gratuito y, si se concede, verificar la retirada efectiva de la pausa.
- Medir CPU e invocaciones posteriores con una ventana comparable; separar
  tráfico, duración y lecturas evitadas antes de atribuir un ahorro.
- Confirmar el estado del equipo y los proyectos después de la fecha anunciada.

La publicación y sus pruebas están terminadas. No se declara recuperada la
cuota ni cancelada la pausa mientras Vercel no lo confirme.
