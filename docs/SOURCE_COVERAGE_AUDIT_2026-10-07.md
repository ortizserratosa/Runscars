# Integridad y cobertura de fuentes · 7 de octubre de 2026

**Estado:** implementación y verificación en curso.

## Alcance y diagnóstico

Este mantenimiento responde a la petición de recuperar órdenes originales,
ampliar información oficial estática de festivales, incluir premios precursores
y evitar descartes indebidos por categoría. La ampliación explícita incluye
enlaces IMDb de películas festivaleras ausentes de las predicciones. Conserva
las ocho categorías públicas actuales y la separación de señales. Las decisiones
nuevas están en D-068 a D-071 de [DECISIONS.md](DECISIONS.md).

La [lectura inicial de producción](audits/2026-10-07/production-before.json)
confirma conectores profesionales y refresco diario correctos. Cada categoría
cuenta con cinco medios vigentes; película y dirección tienen cuatro rankings,
y las otras seis, tres. Las [86 observaciones excluidas](audits/2026-10-07/prediction-exclusions-before.json)
pertenecen a Midnight Critics (83) y The Ringer (3), ambas vencidas: no hay una
exclusión de los cinco medios actuales por categoría. La
[cobertura por categoría](audits/2026-10-07/prediction-coverage-before.json)
conserva fechas, longitudes y diferencia entre ranking y selección.

La [cobertura festivalera inicial](audits/2026-10-07/festival-coverage-before.json)
carece de las selecciones de Sundance, Berlinale, Locarno y TIFF y de los
palmarés de Venecia, TIFF y San Sebastián. Cannes solo incluye competición;
San Sebastián y NYFF no representan un programa completo. El
[rastreo público inicial](audits/2026-10-07/public-before.json) no detectó
destinos rotos en 4.418 rutas visitadas de un sitemap de 3.816 URLs.

## Correcciones y ampliaciones

- Awards Daily deja de exigir Mejor película en artículos válidos de categorías
  aisladas. AwardsWatch y Awards Daily reconocen listas HTML ordenadas y
  mantienen el original al retirar marcas editoriales del sujeto de matching.
- Variety aporta una voz, Clayton Davis, mediante ocho conectores aislados.
  Se conserva `Rank`, longitud completa, fecha editorial, artículo y tabla/CSV.
  No se inventa un nombre oculto ni un matching dudoso.
- Los programas y premios festivaleros recuperados se importan como suplementos
  nuevos, sin volver a activar los conjuntos iniciales ni modificar originales.
  Los manifiestos actuales reúnen 1.061 hechos frente a los 313 iniciales. La
  lectura web pagina los conjuntos y sus correspondencias; el límite REST de
  1.000 filas ya no oculta entradas al crecer el circuito.
- `/premios` incorpora seis calendarios 2027 y un archivo parcial de 25 ganadores
  2026 de Actor Awards/SAG-AFTRA, DGA, PGA, WGA, Critics Choice y BAFTA. La fecha
  futura de anuncio no se interpreta como nominaciones ya publicadas.
- Los enlaces IMDb se verifican por título y dirección en TMDB, incluidos
  homónimos. Tienen historial independiente y vista pública mínima; no crean
  películas ni candidaturas. Los años de producción y estreno se contrastan
  separadamente, sin usar el año del festival como año de película.

## Seguridad y verificación

Han pasado `npm ci`, formato, lint, TypeScript, 330 pruebas unitarias, 41 pruebas
de base de datos y compilación. Los tipos se generaron a partir de 48 migraciones.
Se validaron 12 conjuntos precursores y los dos manifiestos festivaleros nuevos.
Los 140 recorridos E2E han pasado en escritorio, móvil y smoke WebKit. La
compilación local usa fixtures reproducibles; el artefacto se comprobará además
contra Supabase real. Los datos de producción se añadirán tras completar la
publicación.

La revisión de identidad confirmó mediante lecturas reales los enlaces de
Bedford Park, Carousel, A Common Story y Tear Gas, fuera de las predicciones.
Los tests cubren Unicode, homónimos con IMDb ausente, RLS, retirada de fuentes,
inmutabilidad, idempotencia y conservación de un enlace previo frente a fallos o
recibos anteriores. Ver [evidencia IMDb](audits/2026-10-07/festival-imdb-research.md).

La auditoría detectó avisos nuevos de dependencias. Se aplicaron parches a Next
16.3.8, sharp 0.35.5, brace-expansion 5.0.12 y source-map-js 1.2.2. La auditoría
de dependencias de ejecución tiene cero vulnerabilidades conocidas. La auditoría
total sigue fallando por un aviso alto sin versión corregida de `braces` 3.0.3,
arrastrado por ESLint/Next: cinco nodos del mismo árbol de herramientas de
desarrollo. No se ejecuta el downgrade incompatible sugerido por `npm audit
fix --force`. El [recibo de avisos](audits/2026-10-07/dependency-advisories.json)
conserva el alcance y el enlace del aviso.

## Operación

Se creó copia lógica de roles, esquema completo y datos fuera de Git en
`/Users/nacho/Documents/Side/Runscars-backups/2026-10-07-source-coverage`,
con directorio 0700 y SQL 0600. Los avisos de referencias circulares del dump de
datos son los previstos por el procedimiento de
[OPERATIONS.md](OPERATIONS.md). No se ensayó otra restauración en este corte.

Los cambios locales previos de `OPERATIONS.md` y la auditoría de indexación del
17/09 se conservan ajenos a la entrega.
