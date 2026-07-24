# Catálogo TMDB · fase 4

**Estado:** implementado, en validación de staging
**Fecha de inicio:** 2026-07-24

## Objetivo

Añadir metadatos cinematográficos verificables sin convertir TMDB en una señal
de la carrera a los Oscar y sin depender de su disponibilidad durante una
visita.

## Flujo

```text
manifiesto revisado
        ↓
TMDB API (token Bearer, CLI)
        ↓
snapshot versionado + personas + créditos
        ↓
match activo e historial editorial
        ↓
Next.js lee Supabase con rol público
```

La web nunca llama a TMDB. Solo el importador conoce
`TMDB_READ_ACCESS_TOKEN`; la clave de servicio de Supabase se usa únicamente en
el proceso de importación y no se configura en Vercel.

## Datos

La migración de fase 4 crea:

- identidades externas `tmdb_movies` y `tmdb_people`;
- snapshots de película y persona deduplicados por
  `tmdb_id + locale + content_hash`;
- identidades internas de personas y créditos de reparto/equipo;
- un historial privado de matching;
- una función transaccional para cambiar el match activo.

Cada snapshot conserva solo los campos usados por el producto y una copia JSON
de esos valores originales, además de endpoint, locale, captura, hash y
caducidad. La duración es de 180 días, dentro del límite de caché de seis meses
de TMDB. Las páginas solo consumen snapshots vigentes.

El rol público puede leer catálogo, snapshots, personas y créditos, pero no
escribir ni leer el historial editorial. La escritura usa `service_role`.

## Dataset inicial

El manifiesto
[`data/phase-4/tmdb-matches.json`](../data/phase-4/tmdb-matches.json) contiene 20
decisiones verificadas, una por película del fixture de fase 1. No contiene
respuestas de API ni secretos. Su metodología y los dos casos ambiguos están
documentados en
[`data/phase-4/README.md`](../data/phase-4/README.md).

## Operación local

Después de levantar y resetear Supabase, copiar desde `supabase status` la URL,
la clave pública y la clave de servicio al `.env.local` ignorado por Git. Añadir
también el token de lectura de TMDB:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave pública local>
SUPABASE_SERVICE_ROLE_KEY=<clave de servicio local>
TMDB_READ_ACCESS_TOKEN=<token de lectura TMDB>
```

Buscar no escribe:

```bash
npm run tmdb:search -- "The Odyssey" --year 2026
```

Importar el manifiesto completo:

```bash
npm run tmdb:import
```

Corregir un match:

```bash
npm run tmdb:match -- <film-id> <tmdb-id> --reason "<motivo verificable>"
```

La corrección importa primero la nueva ficha, reemplaza los créditos y después
cambia el match de forma transaccional. Si la película ya tiene otro ID, un
match normal falla y obliga a usar el comando de corrección.

## Presentación y atribución

Las fichas de película muestran póster, sinopsis, datos originales, reparto y
equipo desde el caché. Cada persona enlaza a una ficha propia y esta vuelve a
las películas relacionadas. Si no existe una captura vigente, la ficha
editorial de fase 1 continúa disponible.

`/creditos` usa un logotipo oficial aprobado y el aviso exigido:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

## Verificación realizada

- migraciones y RLS probados en PGlite;
- migración, seed y lint ejecutados en Supabase local;
- manifiesto real importado dos veces;
- recuento tras dos pasadas: 20 películas, 20 snapshots, 236 personas, 236
  snapshots de persona, 260 créditos y 20 decisiones iniciales;
- corrección controlada `1698863 → 1368337` de `The Odyssey` con restauración
  del match verificado;
- build y E2E con el token TMDB vacío;
- revisión visual de película y persona en escritorio y película en móvil;
- escaneo del token real contra todos los archivos versionados y no ignorados,
  sin coincidencias.

## Puerta de salida

- [x] Importar dos veces no duplica snapshots ni decisiones.
- [x] Una coincidencia incorrecta puede corregirse y deja historial.
- [x] La web funciona sin el token y no llama a TMDB durante la visita.
- [x] El token no aparece en cliente, logs ni archivos publicables.
- [ ] Web de staging desplegada y comprobada con el catálogo persistido.
