# Fase 7.1 · Cobertura multcategoría, archivo y mercados

**Estado:** completada y cerrada el 2026-07-25  
**Última revisión:** 2026-08-07

## Alcance implementado

- `CategoryCandidate` representa película u obra y colaboradores ordenados.
- Agregación, snapshots y evaluación v2 operan por `candidateId`; v1 no cambia.
- Las ocho categorías acordadas tienen ruta dinámica y lectura de Supabase.
- Las categorías adicionales detectadas se guardan con `is_public = false`.
- Seis medios automáticos alimentan Mejor película: cinco rankings y una
  selección de The Ringer.
- Dirección y las cuatro categorías interpretativas tienen cinco rankings
  ordenados; Guion original y adaptado tienen cuatro.
- Kalshi y Polymarket usan tablas, proceso y presentación independientes.
- Oscar 2026 tiene un manifiesto oficial de 45 nominados y ocho ganadores.

## Cobertura validada

| Fuente                   | Película | Dirección | Actor | Actriz | Reparto actor | Reparto actriz | Guion original | Guion adaptado |
| ------------------------ | -------: | --------: | ----: | -----: | ------------: | -------------: | -------------: | -------------: |
| AwardsWatch              |        R |         R |     R |      R |             R |              R |              — |              — |
| Awards Daily             |        R |         R |     R |      R |             R |              R |              R |              R |
| Awards Radar             |        R |         R |     R |      R |             R |              R |              R |              R |
| Next Best Picture        |        R |         R |     R |      R |             R |              R |              R |              R |
| Midnight Critics Circle  |        R |         R |     R |      R |             R |              R |              R |              R |
| The Ringer               |        S |         — |     — |      — |             — |              — |              — |              — |
| **Rankings automáticos** |    **5** |     **5** | **5** |  **5** |         **5** |          **5** |          **4** |          **4** |
| **Fuentes aplicables**   |    **6** |     **5** | **5** |  **5** |         **5** |          **5** |          **4** |          **4** |

`R` es ranking ordenado y `S` selección sin Borda. La validación real de
extractores del 2026-07-25 confirmó también categorías adicionales estructuradas
en Awards Daily, Next Best Picture y Midnight Critics Circle.

## Automatización

- Ingesta profesional diaria: `17 4 * * *`.
- Snapshot v2 semanal de cada categoría: lunes a las 04:47 UTC.
- Mercados Kalshi y Polymarket: `17 * * * *`.
- Los fallos se aíslan por conector o proveedor.
- Una publicación nueva conserva la lista anterior de categorías omitidas.
- Cada run descubre primero la publicación vigente y deja evidencia explícita
  de actualización, ausencia de cambios o discovery parcial.
- Las páginas vivas conservan revisiones inmutables por contenido; no mezclan
  posiciones antiguas y nuevas bajo una misma publicación.

## Verificación y puerta de salida

- [x] Fixtures de seis conectores profesionales y dos mercados.
- [x] Casos de HTML cambiado, categoría ausente y ejecución parcial.
- [x] Dos intérpretes de una película, una persona con dos películas y equipo.
- [x] Borda v2 comprobado a mano en película e interpretación.
- [x] Hash y contenido de snapshot v1 conservados.
- [x] Mercados imposibilitados de entrar en observaciones profesionales.
- [x] Ocho páginas, archivo, procedencia, frescura y mercados cubiertos por E2E.
- [x] Ingesta inicial real persistida y todo matching participante resuelto.
- [x] Snapshot semanal v2 real de las ocho categorías.
- [x] Archivo 2026 importado contra el catálogo TMDB real.
- [x] Una ejecución programada real satisfactoria por conector.
- [x] `format`, `lint`, `typecheck`, unitarias, DB, `build`, E2E, `audit` y
      `verify` completos.
- [x] CI en verde.
- [x] Entorno desplegado y comprobado en verde.

La fase 8 queda desbloqueada, pero no se ha iniciado. El objetivo opcional de
cinco fuentes para los dos guiones no bloquea el cierre: hoy no existe una
publicación 2027 de AwardsWatch para esas categorías y no se atribuirá una lista
que la fuente no haya publicado.

La ejecución real de staging del 2026-07-25 terminó sin fallos en los seis
conectores profesionales bajo trigger `scheduled`. La base alcanzó la cobertura
de la tabla, cerró editorialmente todas las incidencias (`0` pendientes) y creó
ocho snapshots v2; repetir el mismo corte devolvió ocho `unchanged`.

Una nueva ejecución programada posterior comprobó el discovery actual de los
seis medios en paralelo y terminó por HTTP 200. Awards Daily seleccionó el
artículo del 24 de julio para todas las categorías, Awards Radar leyó sus ocho
páginas actualizadas en julio y AwardsWatch encontró las publicaciones de julio
para interpretación. Los seis runs registraron `source.unchanged`, insertaron
cero observaciones y mantuvieron la cola editorial en `0`.

Kalshi devolvió cero mercados Oscar abiertos y Polymarket 65 contratos; ambos
procesos terminaron correctamente y crearon cero observaciones profesionales.
El archivo oficial conserva 45 nominaciones y ocho ganadores y su segunda
importación no duplicó sus dos result sets. Los Cron reales quedaron activos a
las 04:17 UTC para profesionales y cada hora al minuto 17 para mercados.

La web está desplegada en
<https://runscars-staging.vercel.app>. Las ocho rutas de 2027 devolvieron datos
reales de Supabase y las ocho rutas de 2026 devolvieron nominados y ganador
oficiales.
El endpoint semanal de snapshots rechaza llamadas sin su secreto y Vercel tiene
la programación del lunes a las 04:47 UTC.

El check `verify` del PR de integración terminó en verde tras reproducir la
instalación, formato, lint, tipos, unitarias, DB, build y auditoría. Con esta
última evidencia queda cumplida la puerta de salida de la fase 7.1.

## Mantenimiento 7.1.1 previo a usuarios

El 2026-08-07 se abrió un corte de mantenimiento sin iniciar la fase 8. El
parser de Awards Daily quedó acotado al contenido editorial y reconoce
`Makeup and Hair`; las filas alternativas, etiquetas y navegación se excluyen
sin modificar su valor original. Un manifiesto versionado documenta las
coincidencias editoriales verificadas de `Rose`, `Ink`, `Elsinore` y
`Possible Love`; las migraciones aplican las identidades y los créditos
necesarios, incluido el de Samantha Morton en `The Odyssey`, con URL, motivo y
actor trazables.

Los runs abandonados se cierran tras 15 minutos con un evento auditable. La
cola editorial conserva todas las revisiones, pero solo mantiene pendiente la
versión semántica más reciente. Estas medidas endurecen la operación ya cerrada
de 7.1 y no cambian la puerta, el alcance ni las decisiones pendientes de
usuarios.

La validación real cerró el run abandonado 153 y ejecutó después los cuatro
conectores afectados sin fallos. Awards Daily generó una revisión completa de
79 observaciones con identidad ligada a contenido y extractor. La cola pasó de
109 revisiones repetidas a siete pendientes únicas, todas en categorías todavía
no públicas; las ocho categorías públicas quedaron en cero.

El snapshot manual de control detectó primero una revisión incompleta de Awards
Daily. Esa versión permanece bloqueada e inmutable. Tras corregir la identidad
de publicación se generó un segundo corte, también bloqueado, y el puntero
vigente quedó en el de las 13:02 UTC: cinco rankings ordenados en seis
categorías, cuatro en los dos guiones y seis fuentes aplicables en Mejor
película. Los ocho consensos son válidos.

El mismo corte confirmó 2 contratos de Kalshi y 65 de Polymarket a las 12:17
UTC, las ocho rutas públicas y la salud de base por HTTP 200, rechazo 401 del
cron sin secreto y 18 recorridos E2E en escritorio y móvil. Staging quedó
desplegado con Next.js 16.3.0 y dependencias auditadas sin vulnerabilidades
conocidas.
