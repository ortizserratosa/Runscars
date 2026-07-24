# Base técnica · fase 3

**Estado:** en curso
**Fecha de inicio:** 2026-07-24

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
| `.github/workflows/ci.yml` | Verificación automática propuesta para GitHub |

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
`web/.env.local`. No se guarda ninguna clave privada en Git.

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
- `/api/health/database` responde con HTTP 503 de forma intencional hasta
  conectar la base de datos de staging.

El proyecto de Vercel usa `web/` como raíz de despliegue. Cuando exista el
proyecto Supabase debe configurar estas variables:

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
- [ ] `supabase db reset` ejecutado sobre el stack local oficial.
- [ ] CI ejecutada desde un remoto.
- [ ] Base de datos de staging creada y migrada.
- [x] Aplicación desplegada y comprobada en Vercel staging.
- [x] Instalación limpia completa repetida y documentada.

La fase 3 no se cerrará hasta completar los tres puntos pendientes.

### Bloqueos comprobados el 2026-07-24

- El equipo no tiene Docker, OrbStack, Colima, Podman ni Lima, por lo que el
  stack local oficial de Supabase no puede arrancar todavía.
- La autorización de Supabase requiere que el propietario complete el inicio de
  sesión antes de crear o enlazar un proyecto.
- El checkout no tiene remoto ni commit inicial, y GitHub CLI no está instalado;
  la CI no puede ejecutarse fuera del equipo hasta publicar el repositorio.

Estos bloqueos no afectan a la suite portable, al build ni al staging web, pero
sí forman parte de la puerta de salida y mantienen la fase en curso.
