# AGENTS.md

Este archivo contiene las instrucciones persistentes para cualquier agente que
trabaje en Runscars. Se aplica a todo el repositorio.

## Propósito

Construir Runscars de forma incremental, verificable y trazable. La aplicación
agrega recepción crítica, predicciones de los Oscar y rankings de usuarios, pero
mantiene esas tres señales claramente separadas.

## Fuentes de verdad

Antes de cambiar código o datos, leer los documentos relevantes:

- `docs/PRODUCT.md`: alcance y comportamiento del producto.
- `docs/METHODOLOGY.md`: reglas de normalización, agregación y snapshots.
- `docs/DATA_SOURCES.md`: fuentes y métodos de obtención.
- `docs/DECISIONS.md`: decisiones aceptadas y propuestas.
- `docs/ROADMAP.md`: orden de fases y puertas de salida.

Orden de precedencia:

1. petición explícita actual del usuario;
2. este `AGENTS.md`;
3. decisiones con estado `Aceptada`;
4. contrato de producto y metodología;
5. hoja de ruta.

No presentar como cerrada una decisión marcada `Propuesta`.

## Stack aceptado

- Next.js con TypeScript para la aplicación web.
- Supabase para PostgreSQL, autenticación y Row Level Security.
- Vercel para el despliegue de la web.
- Supabase Edge Functions y Cron para importaciones programadas.
- Vitest para lógica y Playwright para recorridos end-to-end.
- Migraciones SQL y tipos generados; no añadir un ORM sin una decisión nueva.

## Invariantes del producto

- La temporada conserva por separado el año de ceremonia y el año o periodo de
  elegibilidad. La etiqueta principal seguirá la decisión vigente en
  `docs/DECISIONS.md`.
- Recepción crítica, predicciones de expertos y opinión de usuarios no se
  promedian entre sí.
- TMDB proporciona metadatos cinematográficos; no determina candidaturas,
  predicciones ni resultados de los Oscar.
- Todo dato externo debe conservar procedencia, URL, autor cuando exista, fecha
  de publicación, fecha de captura y valor original.
- Una normalización nunca reemplaza el valor original.
- Las importaciones deben ser idempotentes.
- Los snapshots bloqueados son inmutables. Las correcciones posteriores generan
  una nueva versión o un registro de corrección.
- Los fallos de una fuente no deben bloquear la actualización de las demás.
- Las coincidencias dudosas entre una fuente y una película o persona requieren
  revisión editorial.

## Forma de trabajo

- Trabajar en una sola fase o corte vertical por encargo.
- Antes de editar, inspeccionar el estado del repositorio y los cambios
  existentes; conservar cambios ajenos o no relacionados.
- Mantener pequeños los cambios y evitar ampliar el alcance silenciosamente.
- Cuando una tarea cambie producto, metodología, fuente, alcance o arquitectura,
  actualizar también el registro correspondiente.
- Añadir una entrada a `docs/DECISIONS.md` cuando una elección tenga efectos
  duraderos o descarte una alternativa razonable.
- No iniciar la fase siguiente hasta cumplir la puerta de salida de la actual.
- Usar datos de prueba reproducibles. No hacer que las pruebas dependan de TMDB o
  de webs externas en tiempo real.

## Datos externos y secretos

- No guardar tokens, cookies, contraseñas ni credenciales en Git.
- Los commits publicados deben usar la dirección `noreply` de GitHub del autor,
  nunca un correo personal. Comprobar autor y committer antes de cada push.
- Mantener locales los archivos de vinculación con cuentas o proyectos de
  hosting, como `.openai/hosting.json` y `.vercel/`, salvo decisión explícita que
  justifique versionarlos.
- Mantener un `.env.example` sin valores secretos cuando exista la aplicación.
- El token de TMDB se usará únicamente en el servidor.
- Para el prototipo personal, el riesgo de publicación se registra pero no
  bloquea el discovery. Antes de publicar se revisarán y podrán desactivarse
  conectores o extractos.
- Guardar únicamente los campos necesarios para el producto.

## Verificación

Mientras solo exista documentación:

- comprobar enlaces relativos;
- buscar contradicciones entre documentos;
- verificar que toda decisión no confirmada figure como `Propuesta`;
- revisar `git diff --check`.

Comandos canónicos desde la raíz:

- `npm ci`: instalación reproducible.
- `npm run format`: formato.
- `npm run lint`: lint.
- `npm run typecheck`: tipos de rutas y TypeScript.
- `npm test`: pruebas unitarias.
- `npm run test:db`: migración, seed, RLS e idempotencia en PostgreSQL embebido.
- `npm run build`: compilación de producción.
- `npm run test:e2e`: recorridos end-to-end en escritorio y móvil.
- `npm run audit`: vulnerabilidades conocidas de dependencias.
- `npm run verify`: todos los checks salvo end-to-end.
- `npm run db:start`, `npm run db:reset`, `npm run db:lint` y
  `npm run db:types`: flujo local canónico de Supabase; requiere un runtime de
  contenedores compatible con Docker. El arranque crea la red local protegida
  `runscars-local`.
- `npm run tmdb:search -- "<título>" --year <año>`: búsqueda de solo lectura.
- `npm run tmdb:import`: importa el manifiesto de fase 4 de forma idempotente.
- `npm run tmdb:match -- <film-id> <tmdb-id> --reason "<motivo>"`: corrección
  editorial trazable. Los dos últimos comandos requieren secretos de servidor.

Una tarea no está terminada hasta ejecutar las comprobaciones proporcionales al
riesgo y comunicar sus resultados.

## Entrega

Al terminar una tarea:

1. resumir el resultado, no solo las acciones;
2. enumerar las verificaciones ejecutadas;
3. enlazar los archivos principales;
4. señalar decisiones pendientes o riesgos reales;
5. no declarar completada una fase si no cumple su puerta de salida.
