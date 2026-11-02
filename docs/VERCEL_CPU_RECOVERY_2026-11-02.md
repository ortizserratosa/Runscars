# Recuperación gratuita de Vercel · 2 de noviembre de 2026

## Servicio recuperado

El equipo Hobby `nazzozzo-s-projects` quedó pausado el 31/10 a las
11:33:03 UTC por `fluidCpuDuration`. El 02/11, antes de la intervención,
los cuatro proyectos devolvían HTTP 402 `DEPLOYMENT_DISABLED`, aunque sus
artefactos continuaban `READY`. La pausa indicada terminaba el 30/11.

Con el permiso del usuario para contactar con Vercel, se aplica la cortesía
gratuita mediante `Unblock My Account` en Vercel Help. Esta vez la acción
termina correctamente. La [API del equipo](audits/2026-11-02/team-recovery.json)
confirma `softBlock: null`, plan `hobby`, `trial: null` y un multiplicador
`self-serve` de **3**, desde el 02/11 a las 11:10:02 UTC hasta el
**02/12 a las 11:10:02 UTC**. No se compra ningún plan ni complemento.

La confirmación efectiva es un límite temporal triple; no una inmunidad
ilimitada a nuevas pausas. Corrige la explicación inicial del asistente del
30/10, que no constituía un cambio de cuenta. La cortesía es única.

Las [comprobaciones HTTP posteriores](audits/2026-11-02/project-recovery.json)
confirman Runscars 200, su endpoint de salud 200, Criter 307 → 200,
Criter Writing Studio 200 y Q3 Daily 200. Se usa `vercel curl` autenticado para
los proyectos protegidos, conservando su SSO. Son pruebas de entrada y salud,
no recorridos completos de escritura de las otras aplicaciones.

El caso abierto el 30/10 seguía sin respuesta humana. Se actualiza con el
desbloqueo y los resultados comprobados. Su referencia y la conversación de
recuperación permanecen fuera de Git en el recibo privado citado en la
[auditoría inicial](VERCEL_CPU_AUDIT_2026-10-30.md).

## Riesgo de recurrencia con el código del 30/10

La [muestra ampliada del panel](audits/2026-11-02/post-release-23h.json) cubre
desde el 30/10 a las 12:20 hasta el 31/10 a las 11:20 UTC: veintitrés horas
posteriores a las optimizaciones publicadas y anteriores a la pausa.
Runscars registra **8 min 14 s** y **3.586 invocaciones**, el 99,9 % de la
CPU mostrada. Los otros proyectos presentan una contribución muy pequeña;
una cifra redondeada a cero no prueba consumo absoluto cero.

Cuatro horas por treinta días permiten 8 min/día para todo el equipo, o
7 min 40 s durante esas veintitrés horas. Si el ritmo observado se mantuviera,
Runscars solo equivaldría a unos **8,6 min/día** o **4,30 h/30 días**.
Es aritmética condicional, no una predicción mensual: la muestra incluye
verificaciones y cambios de tráfico, rutas y errores. Aun así, no acredita
margen suficiente con el límite normal. La pausa actual está resuelta;
la sostenibilidad del consumo requiere más trabajo y observación.

Se descarta un prototipo de memoización de las predicciones en memoria:
eliminaba deserializaciones, pero el ahorro local medido era aproximadamente
0,44 ms por petición. No justifica añadir otra capa de caché como remedio a
una media de unos 138 ms de CPU por invocación en la muestra ampliada.

## HTML anónimo publicado

El corte separa HTML público anónimo de portada, películas y personas mediante
ISR de 60 segundos. Recibe idioma y contenido explícitos; las cookies Supabase
seleccionan las rutas dinámicas anteriores, que mantienen la validación real.
Las URLs visibles y canónicas se conservan. El resto de páginas, las acciones,
los datos privados y las consultas con significado propio no entran en ISR.

El [smoke con Next real](audits/2026-11-02/html-cache-smoke.json) pasa treinta
casos mediante 32 peticiones HTTP a un backend local reproducible. Las seis
rutas ES/EN pasan de `MISS` a `HIT`; las repeticiones no consultan DB ni Auth.
Una identidad local válida recibe su estado privado mediante SSR y el anónimo
posterior conserva HTML sin ese estado. Se comprueban cookies completas y
fragmentadas, Flight/prefetch, consultas, POST, idioma, enlaces y metadata.
El 307 que normaliza un hash `_rsc` incorrecto es comportamiento de Next 16.4,
no una visita fallida: se sigue con los mismos encabezados hasta Flight 200.

La comprobación normal `npm run verify` pasa formato, lint, tipos, 484 pruebas
unitarias, 53 de base de datos y compilación. La auditoría actual no detecta
vulnerabilidades altas ni críticas; registra dieciséis avisos moderados en la
cadena de herramientas de ESLint/minimatch. No se fuerza un cambio de major
del linter como parte de este corte de CPU.

ISR puede servir el último HTML válido mientras regenera. No cambia las fechas
ni la caducidad guardadas de TMDB, pero no garantiza que el HTML se sustituya
en el instante exacto de su vencimiento. Tampoco elimina todo el trabajo del
proxy. El HIT acredita render reutilizado, no un porcentaje de ahorro mensual.
La regresión final pasa las **142 pruebas end-to-end**, incluidas navegación
en escritorio y móvil y los smoke de Firefox y WebKit. Se conserva la ruta
histórica de la imagen Open Graph de los perfiles. Tras cambiar los grupos de
rutas, se aparta la salida generada antigua de `.next/dev` y se repite la suite
completa desde un arranque limpio. El [recibo de verificación](audits/2026-11-02/verification.json)
identifica las comprobaciones y sus límites.

El código `5519ac6002170e2983642f8ca30f6fb1362058c6` se construye remotamente
con el entorno de producción, sin `--prebuilt`, en
`dpl_FVYRrGiurveMFfDH5CsS99ZCVCcE`. Antes de promoverlo pasan las
[27 comprobaciones de rutas](audits/2026-11-02/release-staged.json) y el
[verificador de caché](audits/2026-11-02/staged-html-cache-swr.json): las seis
páginas ES/EN regeneran de `STALE` a `HIT` y repiten `HIT`; las cookies de sesión
quedan en SSR privado y Flight no contiene estado privado. La regeneración
observada tarda varios segundos: las primeras pruebas con espera de 1,25 s
eran insuficientes. Se conserva la exigencia de un HIT real y un presupuesto
máximo de 36 peticiones.

Se promueve ese mismo artefacto a `runscars.app` el 02/11 hacia las 12:08 UTC.
En el dominio principal pasan otras [27 comprobaciones de rutas](audits/2026-11-02/release-production.json)
y [30 peticiones del verificador de caché](audits/2026-11-02/production-html-cache.json),
sin reintentos. No se modifican bases de datos, importaciones ni los otros
tres proyectos. El fallback anterior es `dpl_DPkhjBuZ9vq4e87Uw9nR4wieMpG8`;
tras promover cualquier fallback hay que repetir salud y aislamiento de sesión.

La recuperación y la publicación están comprobadas. **El ahorro mensual aún
no está medido.** Como siguiente puerta se requiere una ventana completa de
24 h posterior al despliegue, sin pausa y con las tareas programadas normales,
sumando la CPU de los cuatro proyectos. El objetivo de ingeniería es no
superar 6 min/día (25 % de margen frente a 8 min/día); una muestra de 48–72 h
con tráfico representativo daría mayor confianza. La cortesía temporal no
demuestra que el equipo quepa en su límite normal.

## Visitantes: medición gratuita desde el 02/11

Web Analytics estaba desactivado. La vista inicial de demostración no contenía
un histórico del proyecto; no permite reconstruir cuántas personas visitaron
Runscars antes de esta fecha. La aplicación ya incluía el componente Analytics.

Con autorización explícita del usuario se activa **Web Analytics en Hobby**,
incluido en el plan. El script público devuelve HTTP 200 y una visita real de
comprobación aparece en el panel de **Production**, con **1 visitante y
1 página vista**. Esa cifra corresponde a la comprobación, no a audiencia
orgánica ni a todas las visitas anteriores. El [recibo](audits/2026-11-02/analytics-enabled.json)
no almacena identificadores de visitantes.

El plan incluye 50.000 eventos mensuales compartidos por el equipo y treinta
días de histórico. Al agotar la cuota se detiene la recogida; no se activan
cargos adicionales ni un plan de pago. Los eventos personalizados de quiniela
no se consideran operativos en Hobby. Fuentes oficiales:
[límites de Analytics](https://vercel.com/docs/analytics/limits-and-pricing) y
[eventos personalizados](https://vercel.com/docs/analytics/custom-events).

El contador de visitantes de Vercel usa identificadores que se renuevan cada
día; no equivale a una deduplicación de personas durante todo un mes. Tampoco
debe confundirse con las invocaciones de funciones. Véase
[cómo determina visitantes](https://vercel.com/docs/analytics#how-visitors-are-determined).
