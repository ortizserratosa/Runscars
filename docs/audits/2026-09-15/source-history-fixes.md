# Correcciones de fuente, historial e indicador · 2026-09-15

**Estado:** implementadas y verificadas localmente; pendientes de despliegue e
importación en producción.

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
- Enlaces relativos de los cinco documentos modificados y `git diff --check`:
  correctos.
- Inspección visual con el servidor local y lecturas públicas de producción:
  sin pantalla de error; historia y semana antiguas accesibles; indicador legible.

## Aplicación en producción pendiente

1. Seguir las copias de seguridad de [Operación](../../OPERATIONS.md).
2. Aplicar `20260915100000_awards_daily_directing_alias.sql` y desplegar
   `run-ingestion` con el extractor v7.
3. Desplegar la web corregida.
4. Ejecutar el conector `awards-daily-predictions` y el refresco autenticado de
   snapshots. Comprobar que la candidatura recibe la contribución de la nueva
   revisión y que repetir la importación no duplica observaciones.
5. Verificar en la web pública el indicador, la procedencia de Dirección y el
   historial anterior al 9 de septiembre. No editar snapshots bloqueados.
