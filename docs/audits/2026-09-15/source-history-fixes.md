# Correcciones de fuente, historial e indicador · 2026-09-15

**Estado:** desplegadas en producción y comprobadas en `https://runscars.app`.

## Resultados

- Awards Daily publica `Los Javis, La Bola Negra` en el puesto 5 de Dirección en
  [su artículo del 11 de septiembre](https://www.awardsdaily.com/2026/09/11/2027-oscar-predictions-a-muted-festival-season-as-the-odyssey-and-project-hail-mary-light-the-way/).
  El extractor anterior reconocía `Javiers` y `Los Jovis`, pero no `Los Javis`.
  `awards-daily-v7` conserva el original y resuelve ambas personas contra los
  créditos existentes: `Javier Ambrossi, Javier Calvo — La Bola Negra`, candidatura
  `candidate-c5df046000e71a85fc6c3d50`. La comprobación viva fue de solo lectura.
- La consulta de historial restringía los resultados al método del corte vigente.
  Al pasar de agregación v2 a v3 el 9 de septiembre, ocultaba julio y agosto.
  Los registros siguen intactos. La lectura corregida mostró 17 cortes de Mejor
  película y 15 de Dirección, y permitió abrir el corte y la semana del 24 de
  agosto. Cada agregado conserva su método; la transición no inventa movimientos.
- La navegación semanal conserva todas las semanas capturadas, sin los límites
  de ocho enlaces y doce semanas que ocultaban las más antiguas.
- El valor `100,0` invadía la barra en escritorio y el borde en móvil. La columna
  del número ahora respeta su ancho real y la celda móvil dispone de 92 píxeles.

## Verificación

- `npm run format`, `npm run lint` y `npm run typecheck`: correctos.
- `npm test`: 170 pruebas correctas, incluidas variantes del alias, matching
  conservador, idempotencia y navegación entre métodos y semanas.
- `npm run test:db`: 22 pruebas correctas; migración, seed, RLS e inmutabilidad.
- `npm run build`: compilación de producción correcta.
- `npm run test:e2e`: 124 pruebas correctas en escritorio, móvil, Firefox y WebKit.
  El nuevo caso comprueba `100,0` y `100.0` sin colisión entre número y barra.
- `npm run audit`: cero vulnerabilidades.
- CI de GitHub del commit `eb30eb3`:
  [correcta](https://github.com/ortizserratosa/Runscars/actions/runs/34950161675),
  incluidas instalación limpia, tipos SQL regenerados y pruebas end-to-end.
- Enlaces relativos de los cinco documentos modificados y `git diff --check`:
  correctos.
- Inspección visual con el servidor local y lecturas públicas de producción:
  sin pantalla de error; historia y semana antiguas accesibles; indicador legible.

## Aplicación en producción

- Código: `eb30eb3`. Deployment Vercel `dpl_A5WTz6SoDzCKyN9RaSpAXx9eBUMg`,
  promovido a `https://runscars.app` tras verificar salud, base de datos y el
  corte histórico del 24 de agosto. Reversión de web: deployment anterior
  `dpl_4hPhbsmTkk843SyHbZE1xUcxK8xn`.
- Copia lógica previa fuera de Git en
  `/Users/nacho/Documents/Side/Runscars-backups/2026-09-15-source-history`:
  roles, esquema y 104.851.342 bytes de datos, directorio 0700 y SQL 0600.
  No se ensayó una restauración nueva; aplicar el procedimiento documentado en
  [Operación](../../OPERATIONS.md), incluidas las referencias circulares.
- Migración `20260915100000_awards_daily_directing_alias.sql` aplicada y
  `run-ingestion` desplegada con el extractor v7.
- Run profesional 497: HTTP 200, una captura y 80 observaciones nuevas. La
  repetición 498 terminó con 80 duplicadas, cero insertadas y cero revisiones
  editoriales nuevas.
- Refresco de snapshots 19: correcto, un corte nuevo de Dirección y siete
  categorías sin cambios. Corte nuevo:
  `periodic-oscars-2027-directing-nomination-2026-09-15-0782c684a204`.
- Los 155 snapshots anteriores mantienen el registro de hashes
  `99eade150733c696e67c3fa2f881397d` antes y después del release.
- La observación 6643 conserva `Los Javis, La Bola Negra`, puesto 5 de 5, y
  aporta 0,2 puntos de Awards Daily. La candidatura aparece públicamente en
  el puesto 3, con 55,0 puntos y cobertura 4/4. Dirección muestra 16 cortes,
  Mejor película 17, y la navegación semanal conserva las nueve semanas
  disponibles desde el 20 de julio.
- Se corrigió mediante `candidate:match` la observación 6692 de Cinematografía:
  `La Bolla Negra` → candidatura existente de `La Bola Negra`, con motivo,
  procedencia e identidad original preservada. No amplía las categorías públicas.
- Verificación viva: salud y base de datos correctas; portada, película, acceso,
  Comunidad y festivales responden en ES/EN; robots, sitemap y tarjeta social de
  Dirección responden correctamente. Indicador 100,0 comprobado visualmente en
  escritorio y móvil. La exploración no incluyó un nuevo inicio de sesión Google.
- Escaneo de errores del deployment tras la promoción: sin entradas de error.
- Auditoría pública completa: 3.568 URLs de sitemap, 3.842 URLs visitadas y cero
  fallos de rutas, canonicals, alternates o JSON-LD. Los seis parsers
  profesionales pasaron; Kalshi validó 91 contratos y Polymarket 132.
- `audit:production` termina con código 1 por cinco conectores festivaleros con
  incidencias previas al release: Locarno (403), TIFF, Telluride y NYFF (sin
  selección reconocible), y Venecia (404). Se conservan sus últimos conjuntos;
  estas incidencias no se dan por resueltas en el corte de predicciones.
  [Resumen operativo](production-verification.json).
