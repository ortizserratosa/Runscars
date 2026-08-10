# Prototipo visual · fase 2

**Estado:** completado
**Fecha:** 2026-07-24

## Objetivo

Validar la comprensión del producto antes de construir su base técnica. El
prototipo se mantiene en [`prototype/`](../prototype/README.md) y no es la
aplicación definitiva de la fase 3.

## Dirección visual

La interfaz adopta una mesa editorial de temporada: papel cálido, tinta oscura,
acentos de color por señal y tipografía de publicación cultural. Evita el
lenguaje de un dashboard genérico y no usa imágenes o metadatos de TMDB antes
de la fase correspondiente.

Código de color:

- chartreuse para predicciones y acciones;
- violeta para consenso y jerarquía;
- coral para comunidad;
- papel e tinta para contexto y trazabilidad.

El color siempre se acompaña de texto, posición o etiqueta.

## Superficies navegables

| Ruta | Función validada |
|---|---|
| `/` | Portada, líder actual y separación de las tres señales |
| `/temporadas/2027` | Estado de temporada y ocho categorías configurables |
| `/temporadas/2027/mejor-pelicula` | Consenso, respaldo por fuente, evolución y ranking simulado |
| `/peliculas/the-odyssey` | Predicciones, valores críticos originales, agregados contextuales y reseñas |
| `/fuentes/[slug]` | Autor, publicación, captura, lista original y efecto metodológico de cada fuente activa |

## Datos y estados

- Los rankings se calculan a partir de las cuatro listas ordenadas del fixture.
- El selector temporal usa los cortes efectivos persistidos y conserva su ID en
  `?corte=<snapshot-id>`; los cortes redundantes no se presentan como cambios.
- Los cortes con una o dos listas muestran `datos insuficientes`.
- Rotten Tomatoes y Metacritic aparecen como contexto y no como votos.
- Las categorías sin observaciones muestran `Pendiente de ingesta`.
- El ranking y el estado de visionado son simulaciones locales sin
  persistencia.
- La ficha cinematográfica ampliada queda explícitamente pendiente de TMDB.

## Adaptación

La misma arquitectura se adapta a escritorio y móvil. En pantallas estrechas se
apilan módulos, se simplifican columnas secundarias y se mantienen disponibles
el selector temporal, las fuentes y los controles del ranking.

## Puerta de salida

- [x] Encontrar el líder de Mejor película.
- [x] Abrir las fuentes que sostienen una posición.
- [x] Ver valor original y normalización sin mezclar agregadores.
- [x] Recorrer cuatro cortes temporales reales.
- [x] Reordenar un ranking simulado y marcar películas vistas.
- [x] Navegar entre portada, temporada, categoría, película y fuente.
- [x] Mantener crítica, predicciones y comunidad en módulos separados.
- [x] Tener una versión móvil y otra de escritorio mediante diseño adaptable.

## Límites conscientes

El prototipo no añade persistencia, cuentas, conectores, administración,
catálogo TMDB ni cálculos de producción. Esas capacidades siguen en sus fases
correspondientes.
