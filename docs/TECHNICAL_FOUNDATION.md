# Base técnica · fase 3

**Estado:** completada
**Fecha de inicio:** 2026-07-24
**Fecha de cierre:** 2026-07-24

## Objetivo

Convertir el prototipo validado en una base definitiva, reproducible y
desplegable sin adelantar el catálogo TMDB, la ingesta, la agregación, los
snapshots ni los usuarios.

## Estructura

| Ruta | Responsabilidad |
|---|---|
| `web/` | Aplicación Next.js y pruebas de interfaz |
| `supabase/` | Configuración, migraciones y seed |
| `data/phase-1/` | Dataset editorial original e inmutable |
| `prototype/` | Referencia visual descartable de fase 2 |
| `.github/workflows/ci.yml` | Verificación automática en GitHub Actions |

La aplicación conserva la identidad editorial de la fase 2, pero usa Next.js
estándar compatible con Vercel. Todas las apariciones navegables de películas
del fixture enlazan ahora a una ficha canónica. Las fichas que todavía no tienen
datos críticos muestran únicamente los campos verificables y declaran lo que
queda pendiente de TMDB.

## Base de datos

La primera migración crea únicamente entidades de referencia necesarias para
las fases posteriores:

- temporadas, con año de ceremonia y elegibilidad separados;
- ocho categorías configurables;
- películas y su relación con la temporada;
- catálogo de fuentes y sus estados editoriales, técnicos y de publicación.

No se han creado todavía observaciones, conectores, agregados, snapshots,
perfiles ni rankings persistentes.

Todas las tablas públicas tienen RLS activado. Los roles `anon` y
`authenticated` reciben solo lectura; no existe ninguna política pública de
escritura.

El seed es idempotente y carga:

- una temporada;
- ocho categorías;
- veinte películas verificadas;
- diecinueve fuentes necesarias para el fixture y las siguientes fases.

## Desarrollo local

Requisitos:

- Node.js 22 o posterior;
- npm;
- un runtime compatible con la API de Docker para ejecutar Supabase local.

La configuración se ha verificado en macOS con Colima y Docker CLI:

```bash
brew install colima docker
colima start --cpu 4 --memory 8 --disk 30
```

Desde una copia limpia:

```bash
npm ci
cp web/.env.example web/.env.local
npm run db:start
npm run db:reset
npm run db:types
npm run dev
```

`npm run db:start` imprime la URL y la clave pública local que deben copiarse a
`web/.env.local`. Antes de arrancar crea de forma idempotente la red Docker
`runscars-local`, que limita los puertos publicados a `127.0.0.1`. No se guarda
ninguna clave privada en Git.

Analytics local está desactivado porque no forma parte de esta fase y su agente
de logs necesita montar el socket del runtime. PostgreSQL, Auth, API, Storage,
Realtime, Studio y Mailpit permanecen activos. El motor experimental `pg-delta`
también permanece desactivado; las migraciones SQL versionadas siguen siendo la
fuente de verdad.

Para detener los servicios:

```bash
npm run db:stop
```

## Verificación

```bash
npm run verify
npx playwright install chromium
npm run test:e2e
```

`npm run test:db` ejecuta la migración y el seed dos veces sobre PostgreSQL
embebido, comprueba los recuentos y confirma que el rol público puede leer pero
no escribir. Esta prueba rápida no reemplaza `npm run db:reset` sobre Supabase.

Los tipos de `web/src/types/database.generated.ts` se derivan de las migraciones
mediante introspección de PostgreSQL:

```bash
npm run db:types
```

Cuando Supabase local esté disponible también se puede comparar con el
generador oficial:

```bash
npm run db:types:supabase
```

## Staging

La aplicación está desplegada en el proyecto aislado `runscars-staging`:

- URL estable: <https://runscars-staging.vercel.app>;
- despliegue verificado el 2026-07-24;
- portada, ficha de película y `/api/health` responden con HTTP 200;
- `/api/health/database` responde con HTTP 200 y confirma que la base es
  alcanzable;
- el proyecto Supabase `runscars-staging` está en `eu-west-3` y contiene los
  recuentos esperados del seed.

El proyecto de Vercel usa `web/` como raíz de despliegue y el preset Next.js.
Como el lockfile y el parche de compatibilidad están en la raíz del monorepo,
su instalación reproducible es `cd .. && npm ci --include=dev`; el build se
ejecuta dentro de `web/` y lee `web/vercel.json`. Configura estas variables
públicas:

- `NEXT_PUBLIC_SITE_URL`;
- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

El proyecto Supabase de staging se enlaza sin guardar credenciales:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push --include-seed
```

`--include-seed` solo se usa en el proyecto desechable de staging. No se debe
usar para producción.

## Puerta de salida

- [x] Aplicación definitiva inicializada.
- [x] Migración y seed versionados.
- [x] Fixture reproducible verificado sin red.
- [x] Tipos derivados del esquema.
- [x] Formato, lint, tipos, pruebas, compilación y E2E definidos.
- [x] Integración continua declarada.
- [x] `supabase db reset` ejecutado sobre el stack local oficial.
- [x] CI ejecutada correctamente desde el remoto público.
- [x] Base de datos de staging creada y migrada.
- [x] Aplicación desplegada y comprobada en Vercel staging.
- [x] Instalación limpia completa repetida y documentada.

### Evidencia de cierre

- `supabase db reset` recreó la base local, aplicó la migración y cargó el seed;
- `supabase db lint --local --level warning` no encontró errores;
- local y staging contienen 1 temporada, 8 categorías, 8 relaciones de
  categoría, 20 películas, 20 relaciones de película y 19 fuentes;
- los historiales local y remoto contienen la misma migración y el último
  `db push --dry-run` confirma que staging está actualizado;
- el rol público puede leer los 20 registros de películas y una escritura
  anónima en staging es rechazada;
- la CI remota incluye instalación limpia, regeneración de tipos, build,
  pruebas de base de datos y seis recorridos E2E;
- el despliegue Vercel conectado devuelve HTTP 200 en sus dos endpoints de
  salud y en todas las superficies principales.
