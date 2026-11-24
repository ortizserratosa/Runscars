# Mantenimiento de CPU y visitas · 24 de noviembre de 2026

## Visitas antes de intervenir

El [panel de Production](https://vercel.com/nazzozzo-s-projects/runscars/analytics?period=30d)
mostró 247 visitantes, 902 páginas vistas y un 42 % de rebote en el intervalo
25/10–24/11. La recogida empezó el 02/11. Móvil representa 52 %, escritorio 48 %;
Estados Unidos 59 %, España 12 % y Reino Unido 6 %. La portada española registra
75 visitantes, la inglesa 49 y Mejor película inglesa 45. El
[recibo agregado](audits/2026-11-24/analytics-baseline.json) conserva los límites:
identificadores diarios, páginas con visitantes solapados e imposibilidad de
separar comprobaciones propias de audiencia orgánica. No contiene identidades.

## Diagnóstico y objetivo

La ventana semanal 16–23/11 mostró aproximadamente 65 minutos de CPU para
Runscars: 9,3 min/día. El equipo ordinario admite cuatro horas cada treinta días
(8 min/día); el objetivo de ingeniería es 6 min/día. La ampliación temporal
triple vence el 02/12 a las 11:10 UTC. Reducir consumo futuro no borra el
contador móvil ya acumulado.

El desglose gratuito de Production limita la inspección por ruta a doce horas.
La muestra 23/11 12:05–24/11 00:05 mostró categorías con 391 ejecuciones y unos
dos minutos de CPU, películas 21 s, fuentes 14 s, personas 12 s y ocho ediciones
semanales con 8 s. Una generación del RSS gastó 4,77 s. Son cifras redondeadas;
no incluyen el cron diario de las 04:47 y no permiten atribuir CPU a visitantes
humanos ni extrapolar un ahorro mensual.

## Cambios

D-080 amplía el HTML anónimo a categorías, fuentes y semana manteniendo las
sesiones y los selectores de corte en SSR. La comunidad revocable se solicita
por separado sin caché de respuesta; nunca se incorpora al HTML compartido.
Las personas pasan a cinco minutos y las páginas profesionales siguen en 60 s.
El informe semanal reutiliza historia/punteros sin consultar mercados ni salud
por cada corte; el índice y detalle de fuentes reutilizan hojas independientes.

Los formatos Intl se reutilizan por idioma y perfil, sin guardar datos de
usuario. La prueba local de 200 fechas pasó de 4,451 a 0,144 ms y 200 números de
1,717 a 0,039 ms; hubo variabilidad de GC en fechas. Se midió Node 26/ICU 78.3
en macOS, mientras producción usa Node 24. No es CPU facturada por Vercel.

La compilación detectó avisos de Next 16.4.3. Se incorpora el parche 16.4.6 y su
configuración ESLint correspondiente, conservando la versión mayor. La
[publicación oficial de seguridad](https://nextjs.org/blog/november-2026-security-release)
identifica los problemas corregidos desde 16.4.5. No se adopta una nueva
arquitectura ni se usa el asistente de actualización para alterar el alcance.

## Lecturas SQL e integridad

La migración `20261124120000` conserva las vistas públicas y sus columnas,
permisos y barreras. Acota las firmas históricas por fuente y captura elegida y
pospone los resúmenes de candidatos hasta conocer la cabeza completa. En la
muestra local inicial, evidencia pasó de 321 a 150 ms y estado de 83 a 77 ms;
son tiempos indicativos, sin aserciones de velocidad ni equivalencia con CPU de
Vercel. Las esperas de PostgreSQL no son CPU activa facturada de la web.

La revisión independiente detectó una ambigüedad anterior en fechas mixtas de
capturas legadas. D-081 alinea el representante de la captura con el resumen de
estado, conservando fechas originales por fila. El control con fechas uniformes
mantiene equivalencia exacta para ambos roles y filtros; el caso contradictorio
se corrige deliberadamente. La consulta de producción anterior a la migración
no detectó grupos públicos completos con fechas mixtas.

## Verificación y publicación

La instalación reproducible y `npm run verify` pasan con entorno local
explícitamente sin backend: formato, lint, tipos, 565 pruebas unitarias, 64 de
base, compilación Next 16.4.6 y auditoría sin avisos altos/críticos. Permanecen
siete moderados de herramientas ESLint. La configuración `.env.local` apunta a
un backend local no disponible; no se altera ese archivo del usuario. La
construcción publicada se hará remotamente con el entorno real de producción.

Pasan 146 pruebas E2E en escritorio/móvil, Firefox y WebKit desde un arranque
limpio. Una repetición de desarrollo tuvo recargas Fast Refresh y navegación
interrumpida; se apartó únicamente `.next/dev` y la suite completa pasó sin
cambios de aplicación. La comprobación de red permite solo la cancelación
intencionada del endpoint vivo y exige que su resultado final cargue.

El [smoke con Next real](audits/2026-11-24/html-cache-smoke.json) pasa 68 casos,
76 peticiones HTTP, HIT ES/EN y cero lecturas DB/Auth en repeticiones. Comprueba
sesiones, identidad local válida con estado privado, Flight, queries y acciones.
Personas anuncia `s-maxage=300`; las otras familias permanecen en 60 segundos.
El [recibo de verificación](audits/2026-11-24/verification.json) conserva el
alcance. No se incluyen credenciales ni cuerpos de usuarios reales.

Se construye remotamente el commit `1eda3038366854706fd512b46adc7fb294fdc2ae`
desde un archivo Git limpio, excluyendo los cambios ajenos y los archivos
locales de hosting. El artefacto `dpl_EN4zvtjkV3vRuL1y158598wGfDNk` alcanza
`READY` con el entorno de producción. Pasan catorce rutas de salud, idiomas,
Comunidad, festivales, robots, sitemap, imagen social y resumen revocable; el
[verificador staged](audits/2026-11-24/staged-html-cache.json) pasa 58 peticiones.
Se promueve ese mismo artefacto a `https://runscars.app` el 24/11 hacia las
09:45 UTC. En el dominio pasan otras [catorce rutas](audits/2026-11-24/production-routes.json)
y [58 peticiones de caché](audits/2026-11-24/production-html-cache.json), sin
reconstruir. La lectura de logs filtrada por este deployment no devuelve avisos
ni errores en la ventana registrada; no acredita ausencia futura de errores.

La migración se aplica antes de publicar la web. Las once consultas PostgREST
reales mantienen todos los valores y hashes: 73 estados y 819 observaciones de
evidencia. Los 400 snapshots, sus hashes, 614 capturas, 440 certificados y los
recuentos de observaciones/membresía permanecen iguales. La muestra HTTP de
estado pasa de 1.163 a 654 ms; las diez consultas de evidencia también responden
más rápido en esa pasada. Red/cachés influyen: no se infiere ahorro facturado.
El [recibo de migración](audits/2026-11-24/migration-production.json) conserva la
comparación. La copia lógica previa y el rollback exacto de vistas permanecen
fuera de Git en `/Users/nacho/Documents/Side/Runscars-backups/2026-11-24-cpu`,
con directorio 0700 y archivos 0600. No se ensayó una restauración nueva.

## Auditoría operativa y límites previos

El [recibo operativo](audits/2026-11-24/operational-audit.json) distingue los
resultados de cada transporte. El comando canónico de auditoría devuelve exit 1
porque una exportación local antigua no contiene una credencial de servidor
usable. No se copian Production Secrets ni se cambian credenciales. Mediante
Management API se recupera la configuración real y la salud de tareas; los
mismos conectores/validadores pasan las diecisiete fuentes de predicciones.
El grafo público pasa 32 páginas con 33/64 peticiones y cero fallos; los parsers
de mercados reconocen 92 contratos Kalshi y 295 Polymarket. El último refresco
de snapshots terminó `succeeded` a las 04:48:13 UTC con cero fallos; no hay
runs profesionales abandonados.

Persisten dos incidencias anteriores al artefacto publicado: Guardian tiene su
último éxito el 05/11 y volvió a fallar el 24/11 a las 04:21; Kalshi registra su
último éxito el 21/11 y un run `running` desde el 24/11 a las 09:17:01 sin cierre.
La recuperación de esas ingestas queda pendiente. No se declaran resueltas por
este cambio de CPU. Festivales conserva cero conectores activos tras su archivo.
El dominio no dispone de quinielas públicas para una muestra real de perfil;
la retirada y visibilidad se verifican con fixtures, RLS y recorridos E2E.

## Medición posterior

El ahorro mensual no se declara alcanzado al publicar. Medir la CPU conjunta de
los cuatro proyectos durante al menos 24 horas completas y preferiblemente
48–72 h con el cron habitual. Conservar el intervalo, tráfico, rutas, errores e
invocaciones; comparar 480 s/día de techo y 360 s/día de objetivo. No contratar
Observability Plus para esta medición.
