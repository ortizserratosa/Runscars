# Fase 9.5 · Cierre funcional público

**Implementada:** 2026-08-25.

Esta fase recoge las funciones del contrato original que seguían parciales o
sin superficie pública después de la administración editorial.

## Metodología

`/metodologia` explica las tres señales separadas, la normalización crítica, el
consenso Borda, el mínimo profesional, la temporalidad de proveedor, la
inmutabilidad y la procedencia. Enlaza directamente a la evaluación.

## Archivo 2022–2026

`/archivo` y `/archivo/[year]` ofrecen las cinco ceremonias anteriores acordadas
en D-007. Cada edición contiene nominados y un ganador por cada una de las ocho
categorías. Los manifiestos conservan fuente Academy y fecha de captura. No se
reconstruye especulación histórica.

## Evaluación

`/evaluacion` deriva métricas v2 únicamente cuando existe un snapshot final y un
result set oficial compatibles:

- aciertos, precisión y cobertura de nominaciones por categoría y globales;
- acierto del ganador y posición final;
- IDs exactos del snapshot y resultado utilizados;
- estado pendiente explícito cuando el evento todavía no permite evaluar.

## Recepción crítica

`/critica` convierte la señal crítica en una superficie de descubrimiento sin
mezclarla con predicciones. Solo ordena películas con tres puntuaciones
individuales independientes; las películas con menor cobertura permanecen
visibles sin posición agregada.

## Evidencia

- El archivo exige cinco ediciones, ocho categorías y un ganador por categoría
  en `web/tests/unit/archive.test.ts`.
- Los recorridos públicos y el bloqueo anónimo de `/admin` se cubren en
  `web/tests/e2e/navigation.spec.ts`.
- La evaluación reutiliza `runscars-evaluation-v2`, ya cubierta con ejemplos
  manuales en la suite de snapshots.
