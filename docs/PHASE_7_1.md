# Fase 7.1 · Cobertura multcategoría, archivo y mercados

**Estado:** integrada y verificada en staging; validación de CI pendiente
**Última revisión:** 2026-07-25

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
- [ ] CI en verde.
- [x] Entorno desplegado y comprobado en verde.

La fase 8 permanece bloqueada. El objetivo de cinco fuentes para los dos guiones
también queda abierto: hoy no existe una publicación 2027 de AwardsWatch para
esas categorías y no se atribuirá una lista que la fuente no haya publicado.

La ejecución real de staging del 2026-07-25 terminó sin fallos en los seis
conectores profesionales bajo trigger `scheduled`. La base alcanzó la cobertura
de la tabla, cerró editorialmente todas las incidencias (`0` pendientes) y creó
ocho snapshots v2; repetir el mismo corte devolvió ocho `unchanged`.

Kalshi devolvió cero mercados Oscar abiertos y Polymarket 65 contratos; ambos
procesos terminaron correctamente y crearon cero observaciones profesionales.
El archivo oficial conserva 45 nominaciones y ocho ganadores y su segunda
importación no duplicó sus dos result sets. Los Cron reales quedaron activos a
las 04:17 UTC para profesionales y cada hora al minuto 17 para mercados.

La web está desplegada en
<https://runscars-staging.vercel.app>. Las ocho rutas de 2027 devolvieron datos
`DATABASE` y las ocho rutas de 2026 devolvieron nominados y ganador oficiales.
El endpoint semanal de snapshots rechaza llamadas sin su secreto y Vercel tiene
la programación del lunes a las 04:47 UTC.
