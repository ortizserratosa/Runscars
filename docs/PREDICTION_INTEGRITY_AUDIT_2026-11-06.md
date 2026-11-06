# Auditoría de integridad de predicciones · 6 de noviembre de 2026

**Estado:** correcciones en verificación; publicación pendiente.

## Causa del falso líder

El corte de Mejor película del 04/11/2026 a las 04:47 situó a Dune: Part Three
primera con 81 puntos frente a 79 de The Odyssey. Ninguna de sus cinco fuentes
ordenadas había situado a Dune primera. De The Ankler solo se habían persistido
una de diez observaciones (Dune, sexta); The Rolling Tape conservaba once de
veinte. El cálculo trató los registros faltantes como ausencias reales y penalizó
artificialmente a sus rivales. La fórmula Borda v4 no era el fallo.

Antes de intervenir, el corte del 06/11 ya mostraba The Odyssey primera y Dune
séptima. Ese estado no acredita que la importación sea segura: seguían existiendo
trece runs profesionales abandonados desde las 04:17, capturas parciales y cuatro
conectores con fallos de formato o preparación. Los snapshots y recibos iniciales
se conservan en [la evidencia](audits/2026-11-06/).

## Alcance y reparación

- Auditoría de extracción, fuentes originales, persistencia, selección de
  publicaciones, caducidad, matching, cálculo, cortes y lecturas públicas de las
  ocho categorías.
- Certificación transaccional de todas las observaciones únicas de una captura;
  incluye pendientes y excluidas, conserva filas duplicadas en el recibo original
  y enlaza observaciones reutilizadas. Una interrupción no publica un prefijo.
- Lecturas profesionales y fichas de fuente limitadas a capturas completas.
  Se conserva la última revisión completa mientras falla otra.
- Reintentos idempotentes, con atajo para capturas completas y resueltas; las
  identidades pendientes siguen reintentándose.
- Recencia coherente entre la publicación que puntúa y la que explica su ficha:
  una URL legada sin fecha no desplaza una publicación editorial fechada.
- Corrección aditiva de cortes afectados, sin reemplazar payloads ni hashes ni
  reconstruir datos retrospectivos.
- Control de runs abandonados en la auditoría operativa y escalonado de los
  conectores para reducir la carga simultánea.

## Fuentes originales y formatos

El [contraste de fuentes](audits/2026-11-06/source-research.md) y el
[recibo inicial](audits/2026-11-06/live-source-extraction.json) documentan las
diecisiete extracciones. The Odyssey encabeza Awards Radar, Variety, Christopher
Rosen y Danny Jarabek; Matt Neglia sitúa La Bola Negra primera y The Odyssey
segunda. Dune aparece entre los puestos segundo y octavo, según el medio.

Variety añadió una quinta columna a los CSV de guiones; se aceptan exclusivamente
las variantes verificadas y se conserva la fila original. Movie State usa una
comilla de apertura como cierre. Awards Daily termina una etiqueta de dirección
con una coma; su artículo del 30/10 declara orden explícito solo para la lista
adyacente de Mejor película. Las reparaciones no convierten al resto de sus
selecciones en rankings. Los nombres dudosos permanecen en revisión editorial.

Movie State, Midnight Critics y The Ringer pueden conservar capturas técnicamente
correctas y seguir caducados. No se rejuvenece una predicción al arreglar el
extractor. No se cambian pesos, ventana20/10, frescura de treinta días ni umbral
de cuatro rankings.

## Verificación y publicación

Pendiente de completar con los resultados finales de pruebas, importaciones,
integridad histórica y publicación. La copia previa de roles, esquema y datos
públicos/Auth/Storage está fuera de Git en
`/Users/nacho/Documents/Side/Runscars-backups/2026-11-06-prediction-integrity`,
con directorio0700 y SQL0600. No se ha ensayado una restauración nueva.
