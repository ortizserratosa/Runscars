# Auditoría visual de rutas

**Fecha:** 2026-09-01

**Viewports:** escritorio `1440 × 1000`, móvil `390 × 844`

**Evidencia automatizada:**
[`route-audit.json`](implementation/route-audit.json)

La auditoría automatizada recorre 38 estados de interfaz en ambos viewports y la
portada inglesa: 77 comprobaciones, más 12 recursos HTTP. En cada página valida
estado o redirección esperada, un único `main`, marca vectorial, idioma,
ausencia de la imagen del tablero, ausencia de errores de página y ausencia de
desbordamiento horizontal.

## Rutas de interfaz

| Ruta o patrón                     | Estado revisado                             | Aplicación del sistema                              |
| --------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| `/`                               | temporada con fixture reproducible; ES y EN | héroe editorial, tablero, podio, señales y recibos  |
| `/temporadas/2027`                | temporada activa                            | héroe, navegación de categorías y snapshots         |
| `/temporadas/2027/[categorySlug]` | las ocho categorías                         | ranking, cobertura, consenso, procedencia y mercado |
| `/temporadas/2026`                | temporada anterior                          | mismos patrones sin reinterpretar el dato           |
| `/temporadas/2026/[categorySlug]` | las ocho categorías                         | ranking y estados históricos compatibles            |
| `/peliculas/[slug]`               | `the-odyssey`                               | ficha editorial, señales separadas y fuentes        |
| `/peliculas/[slug]`               | estado no encontrado                        | error compartido y retorno seguro                   |
| `/personas/[slug]`                | estado sin fixture público                  | estructura compartida y estado 404                  |
| `/fuentes`                        | índice con seis fuentes                     | héroe Blue y módulos de procedencia                 |
| `/fuentes/[slug]`                 | fuente publicada                            | cronología, captura y recibos                       |
| `/metodologia`                    | contenido completo                          | jerarquía editorial y módulos explicativos          |
| `/evaluacion`                     | estado disponible/sin corte                 | métricas separadas y aviso explícito                |
| `/archivo`                        | índice histórico                            | navegación por temporadas y keylines                |
| `/archivo/[year]`                 | ceremonia 2025                              | resultados oficiales y procedencia                  |
| `/comunidad`                      | estado vacío reproducible                   | filtros, llamada Acid y ausencia explícita          |
| `/usuarios/[slug]`                | perfil no encontrado                        | privacidad y error compartido                       |
| `/usuarios/[slug]/[categorySlug]` | quiniela no encontrada                      | error compartido sin inventar ranking               |
| `/acceso`                         | formulario de entrada                       | controles, foco y mensajes de sesión                |
| `/cuenta`                         | frontera sin sesión                         | redirección a acceso                                |
| `/admin`                          | frontera sin sesión                         | redirección a acceso                                |
| `/privacidad`                     | contenido legal                             | tipografía y ancho de lectura                       |
| `/terminos`                       | contenido legal                             | tipografía y ancho de lectura                       |
| `/creditos`                       | atribuciones                                | enlaces y excepciones de proveedor                  |
| `/critica`                        | ruta retirada                               | redirección permanente a temporada activa           |
| ruta inexistente                  | 404 global                                  | marca, navegación y recuperación                    |

`[categorySlug]` cubre `mejor-pelicula`, `direccion`, `actor-protagonista`,
`actriz-protagonista`, `actor-de-reparto`, `actriz-de-reparto`, `guion-original`
y `guion-adaptado`.

No hay un fixture público estable para una persona, perfil o quiniela real. La
auditoría usa sus estados 404 y revisa los componentes compartidos por
compilación, tipos y pruebas. No se crean personas ni datos comunitarios
ficticios en la base de datos.

## Superficies no visuales

| Archivo de ruta                 | Contrato revisado                                         |
| ------------------------------- | --------------------------------------------------------- |
| `/api/comunidad/verificar-tmdb` | POST autenticado y validación de entrada manual           |
| `/api/cron/snapshots`           | cron protegido, aislamiento y evidencia diaria            |
| `/api/cuenta/exportar`          | exportación autenticada                                   |
| `/api/health`                   | salud del proceso                                         |
| `/api/health/database`          | salud de base de datos y degradación segura               |
| `/api/locale`                   | cambio de idioma y retorno seguro; usado por la prueba EN |
| `/auth/callback`                | callback de autenticación y redirección validada          |
| `/manifest.webmanifest`         | iconos y color de tema de la identidad                    |
| `/robots.txt`                   | reglas de indexación                                      |
| `/sitemap.xml`                  | inventario público sin la ruta retirada de Crítica        |
| `opengraph-image` de quiniela   | tarjeta dinámica con paleta y señales v1                  |

Estas rutas no reciben una captura de página. Sus contratos se cubren mediante
pruebas unitarias/end-to-end, typecheck y build; manifest, robots y sitemap se
comprueban además como recursos HTTP en la validación de producción.

## Evidencia principal

- [comparación con el tablero](implementation/brand-board-comparison.png)
- [portada de escritorio](implementation/home-desktop.png)
- [portada móvil](implementation/home-mobile.png)
- [categoría de escritorio](implementation/category-desktop.png)
- [categoría móvil](implementation/category-mobile.png)
- [ficha de película](implementation/film.png)
- [fuentes](implementation/sources.png)
- [comunidad](implementation/community.png)
- [administración](implementation/admin.png)
- [tarjeta social dinámica](implementation/social-dynamic.png)

La ruta real de administración permanece protegida. Su captura usa la página de
acceso, la cabecera y el pie reales, y reemplaza solo `#contenido` por un
fixture estático con las clases de producción. No usa sesión ni datos externos y
se identifica como fixture en la imagen; la frontera de autenticación se audita
por separado en `/admin`.

## Regla para rutas nuevas

Toda ruta visual nueva debe reutilizar `SiteHeader`, `SiteFooter`, tokens y
patrones documentados, añadirse a `audit-brand-routes.mjs` con estado desktop y
móvil, y demostrar que conserva cobertura y procedencia antes de considerarse
cerrada.
