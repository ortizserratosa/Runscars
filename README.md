<p align="center">
  <img src="web/public/og.png" alt="Runscars · La carrera, con los recibos" width="1200">
</p>

<h1 align="center">Runscars</h1>

<p align="center">
  <strong>La carrera a los Oscar, con los recibos.</strong><br>
  Predicciones profesionales, evolución y procedencia en un mismo lugar, sin
  convertirlas en una señal opaca.
</p>

<p align="center">
  <a href="https://runscars-staging.vercel.app"><strong>Explorar el staging →</strong></a>
  ·
  <a href="docs/PRODUCT.md">Producto</a>
  ·
  <a href="docs/METHODOLOGY.md">Metodología</a>
  ·
  <a href="docs/ROADMAP.md">Roadmap</a>
</p>

<p align="center">
  <a href="https://github.com/ortizserratosa/Runscars/actions/workflows/ci.yml">
    <img src="https://github.com/ortizserratosa/Runscars/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
</p>

## ¿Qué es Runscars?

La conversación sobre los Oscar vive repartida entre listas de predicciones,
reseñas, mercados y rankings personales. Runscars hace transparente el consenso
profesional para mostrar cómo cambia la carrera durante la temporada y cuánto
acertó cuando llegan las nominaciones y los premios.

La aplicación no busca fabricar una nota definitiva. Busca que cualquier
posición se pueda entender, contrastar y rastrear hasta su fuente.

| Señal                          | Qué responde                                            | Regla                                              |
| ------------------------------ | ------------------------------------------------------- | -------------------------------------------------- |
| **Recepción crítica**          | ¿Cómo está siendo recibida la obra?                     | Conserva la puntuación original y su normalización |
| **Predicciones profesionales** | ¿Quién aparece con más fuerza en la carrera?            | Expone medio, autor, fecha y lista original        |
| **Comunidad**                  | ¿Qué ha visto y cómo ordena sus favoritas cada usuario? | Nunca altera los agregados profesionales           |

> Cada señal conserva su medida y procedencia. Nunca se promedian entre sí.

## El proyecto, en cifras

| Fuentes evaluadas | Seleccionadas por calidad | Películas del fixture | Observaciones trazables | Categorías MVP |
| ----------------: | ------------------------: | --------------------: | ----------------------: | -------------: |
|                31 |                        28 |                    20 |                      69 |              8 |

El dataset inicial es reproducible, conserva URLs y fechas de captura y permite
desarrollar y probar sin consultar fuentes externas en tiempo real.

## Qué puedes explorar ahora

El staging actual conserva la identidad editorial validada en el prototipo y
permite recorrer:

- la [portada, el consenso y su evolución](https://runscars-staging.vercel.app);
- la
  [temporada Oscar 2027](https://runscars-staging.vercel.app/temporadas/2027);
- el
  [consenso de Mejor película](https://runscars-staging.vercel.app/temporadas/2027/mejor-pelicula);
- una
  [ficha de película](https://runscars-staging.vercel.app/peliculas/the-odyssey);
- una
  [ficha de persona](https://runscars-staging.vercel.app/personas/tmdb-30614);
- el
  [índice de fuentes y recibos](https://runscars-staging.vercel.app/fuentes);
- los [créditos y atribución de TMDB](https://runscars-staging.vercel.app/creditos).

Todas las apariciones de películas del fixture enlazan a una ficha canónica. El
catálogo TMDB se sirve desde snapshots locales versionados. El primer sistema de
ingesta profesional ya incorpora Guardian, RogerEbert y AwardsWatch con fixtures
offline, revisión editorial y ejecuciones aisladas. El consenso se recalcula
desde 48 observaciones, expone el término aportado por cada fuente y conserva el
corte vigente como un snapshot inmutable con hash reproducible.

## Estado

| Fase | Resultado                                          | Estado        |
| ---- | -------------------------------------------------- | ------------- |
| 0    | Contrato, metodología y decisiones                 | ✅ Completada |
| 1    | Discovery y dataset verificable                    | ✅ Completada |
| 2    | Prototipo visual navegable                         | ✅ Completada |
| 3    | Aplicación definitiva, base técnica y staging      | ✅ Completada |
| 4    | Catálogo TMDB versionado y fichas cinematográficas | ✅ Completada |
| 5    | Ingesta profesional idempotente y programada       | ✅ Completada |
| 6    | Agregación reproducible y evolución temporal       | ✅ Completada |
| 7    | Snapshots inmutables y evaluación versionada       | ✅ Completada |
| 8    | Usuarios y privacidad                              | ✅ Completada |
| 8.5  | Integridad, frescura y foco de producto             | ✅ Completada |
| 9–10 | Administración y lanzamiento                        | ⏳ Pendientes |

La fase 7 queda cerrada con bloqueo transaccional, correcciones enlazadas,
snapshots diarios solo ante cambios efectivos, resultados oficiales versionados y métricas reproducibles. La
temporada activa indica correctamente que sus resultados aún están pendientes.
El detalle verificable está en [SNAPSHOTS.md](docs/SNAPSHOTS.md).

## Principios de datos

- Todo valor externo conserva fuente, URL, autor cuando existe, publicación,
  captura y valor original.
- Una normalización acompaña al dato original; nunca lo sustituye.
- Crítica, predicciones y comunidad permanecen separadas.
- Las importaciones deben ser idempotentes.
- Los snapshots bloqueados son inmutables.
- El fallo de una fuente no bloquea las demás.
- Los emparejamientos dudosos requieren revisión editorial.

## Stack

- **Web:** Next.js 16, React 19 y TypeScript.
- **Datos y autenticación:** PostgreSQL, Supabase y Row Level Security.
- **Despliegue y tareas:** Vercel; Supabase Edge Functions/Cron para ingesta y
  Vercel Cron para cortes diarios condicionados a cambios efectivos.
- **Calidad:** ESLint, Prettier, Vitest, PGlite y Playwright.
- **Automatización:** GitHub Actions.

No se usa ORM: el esquema vive en migraciones SQL y genera tipos verificables.

## Desarrollo local

Requisitos: Node.js 22 o posterior y npm.

```bash
git clone https://github.com/ortizserratosa/Runscars.git
cd Runscars
npm ci
npm run verify
npx playwright install chromium
npm run test:e2e
npm run dev
```

La interfaz y las pruebas portables funcionan sin servicios externos. Para
levantar también Supabase local se necesita un runtime compatible con Docker.
En macOS se ha verificado Colima:

```bash
brew install colima docker
colima start --cpu 4 --memory 8 --disk 30
```

Después:

```bash
cp web/.env.example web/.env.local
npm run db:start
npm run db:reset
npm run db:types
npm run dev
```

El arranque crea de forma idempotente una red Docker que limita los servicios
locales a `127.0.0.1`.

Consulta la [guía técnica de fase 3](docs/TECHNICAL_FOUNDATION.md) para enlazar
las variables públicas locales, la [guía del catálogo](docs/TMDB_CATALOG.md)
para TMDB y la [guía de ingesta](docs/INGESTION.md) para conectores y cargas
manuales. La [guía de agregación](docs/AGGREGATION.md) documenta fórmulas,
ejemplos esperados y evolución. La
[guía de snapshots](docs/SNAPSHOTS.md) cubre bloqueo, resultados y evaluación.

## Estructura

```text
Runscars/
├── web/                 Aplicación Next.js definitiva
├── supabase/            Configuración, migraciones y seed
├── data/phase-1/        Fixture editorial verificable
├── prototype/           Referencia visual aislada de fase 2
├── docs/                Producto, metodología, fuentes y decisiones
└── .github/workflows/   Integración continua
```

## Documentación

| Documento                                   | Contenido                                      |
| ------------------------------------------- | ---------------------------------------------- |
| [PRODUCT.md](docs/PRODUCT.md)               | Visión, usuarios, recorridos y alcance del MVP |
| [METHODOLOGY.md](docs/METHODOLOGY.md)       | Normalización, agregación y snapshots          |
| [DATA_SOURCES.md](docs/DATA_SOURCES.md)     | Puerta de calidad y métodos de obtención       |
| [SOURCE_MATRIX.md](docs/SOURCE_MATRIX.md)   | Evaluación de las 31 fuentes candidatas        |
| [Dataset de fase 1](data/phase-1/README.md) | Películas, observaciones y checksums           |
| [DECISIONS.md](docs/DECISIONS.md)           | Decisiones aceptadas y propuestas              |
| [ROADMAP.md](docs/ROADMAP.md)               | Fases y puertas de salida                      |
| [INGESTION.md](docs/INGESTION.md)           | Conectores, observaciones, revisión y Cron     |
| [AGGREGATION.md](docs/AGGREGATION.md)       | Cálculos, ejemplos manuales y evolución        |
| [SNAPSHOTS.md](docs/SNAPSHOTS.md)           | Bloqueo, resultados oficiales y evaluación     |
| [AGENTS.md](AGENTS.md)                      | Reglas persistentes de trabajo                 |

## Participar

Runscars se construye por fases y cada una tiene una puerta de salida. Antes de
proponer un cambio, revisa el [contrato de producto](docs/PRODUCT.md), las
[decisiones vigentes](docs/DECISIONS.md) y las
[reglas del repositorio](AGENTS.md).

Las correcciones de fuentes, problemas reproducibles e ideas acotadas pueden
abrirse como [issues](https://github.com/ortizserratosa/Runscars/issues).

---

Runscars es un proyecto independiente y no está afiliado con la Academy of
Motion Picture Arts and Sciences.
