# Fase 8.5 · Integridad, frescura y foco de producto

**Estado:** en implementación
**Última revisión:** 2026-08-10

## Objetivo

Cerrar la distancia entre el prototipo visual y los datos operativos antes de
la administración editorial. El consenso profesional, su historia y su
procedencia son la superficie principal según D-033.

## Contrato público

- Todas las fichas de película leen los snapshots vigentes de las ocho
  categorías; no existen excepciones por título.
- El índice y las fichas de fuente derivan sus publicaciones, capturas, valores
  originales y estados de la base persistida.
- Cada categoría ofrece cortes efectivos con URL estable y compara el
  seleccionado con el corte efectivo anterior.
- Publicación, último cambio efectivo y comprobación correcta se presentan como
  conceptos separados.
- Kalshi y Polymarket siguen separados por proveedor e intención y no participan
  en Borda.
- La crítica solo aparece con observaciones reales y no publica media con menos
  de tres puntuaciones individuales independientes.

## Verificación de cierre

- [x] `npm run verify`.
- [x] `npm run test:e2e` en escritorio y móvil.
- [x] migraciones `20260807180000_real_provider_cuts.sql`,
      `20260810160000_public_source_freshness.sql` y la recarga reproducible de
      esquema `20260810163000_reload_postgrest_schema.sql` aplicadas en staging.
- [x] Vercel configurado con `web/` como raíz, preset Next.js y cron diario a
      las 04:47 UTC.
- [x] invocación autenticada del cron devuelve solo `created`, `unchanged` o un
      `skipped` justificable por alcance.
- [x] salud web y base, ocho categorías, película y fuente verificadas en la URL
      estable de staging.
- [ ] PR hacia `main` con CI en verde.

La comprobación autenticada del 2026-08-10 creó cuatro cortes con cambio
efectivo. Una segunda invocación inmediata devolvió ocho estados `unchanged` y
mantuvo el total de snapshots periódicos en 76. El check de Fase 8 confirmó
aislamiento de cuentas, publicación explícita y exportación autenticada.

La fase no desbloquea la Fase 9 hasta completar todos estos puntos.
