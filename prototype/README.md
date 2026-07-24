# Prototipo visual de Runscars

Prototipo navegable y descartable de la fase 2. Valida la jerarquía, la
separación de señales, la trazabilidad y los recorridos principales antes de
inicializar la aplicación definitiva en la fase 3.

No contiene base de datos, autenticación, conectores ni persistencia. Los datos
proceden del fixture versionado de `../data/phase-1/`.

## Superficies

- `/`: portada y estado actual de la carrera.
- `/temporadas/2027`: temporada y ocho categorías previstas.
- `/temporadas/2027/mejor-pelicula`: consenso, selector temporal y ranking
  simulado.
- `/peliculas/the-odyssey`: predicciones, recepción, reseñas y comunidad
  separadas.
- `/fuentes/awardswatch`: procedencia y efecto de una publicación.

## Comandos

```bash
npm install
npm run dev
npm run build
npm run lint
node --test tests/rendered-html.test.mjs
```

El prototipo usa Next.js sobre el runtime local de Sites únicamente para
revisión de fase 2. No reemplaza la arquitectura aceptada para la aplicación
definitiva.
