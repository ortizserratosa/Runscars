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

## HTML anónimo en verificación

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
La regresión final y la comprobación de Vercel siguen pendientes de publicación.
