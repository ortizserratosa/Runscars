# Operación y recuperación

## Servicios

- Web: Vercel, proyecto `runscars`, publicado en `https://runscars.app`.
  `www.runscars.app`, `runscars.vercel.app` y
  `runscars-staging.vercel.app` redirigen permanentemente al dominio canónico.
- Base de datos y autenticación: Supabase, proyecto
  `lgiqzrxeifwciykckzrn` en `eu-west-3`.
- Metadatos: TMDB mediante credencial exclusiva de servidor.
- Identidad social: Google OAuth mediante el callback de Supabase.

Comprobaciones mínimas después de cada despliegue:

1. `GET /api/health` devuelve `status: ok`.
2. `GET /api/health/database` confirma conectividad.
3. portada, categoría, película, acceso, Comunidad y una quiniela pública cargan
   en español e inglés;
4. el callback de Google vuelve a `/cuenta` y el alta por correo no apunta a
   `localhost`;
5. `robots.txt`, `sitemap.xml` y una imagen Open Graph responden correctamente;
6. `/festivales` y una edición cargan en español e inglés, sin enlaces rotos;
7. no aparecen errores nuevos en los logs de Vercel ni en Supabase.

## SEO e indexación

- `https://runscars.app/` es la URL canónica en español y `/en` conserva la
  versión inglesa. Cada página pública enlaza sus variantes `es`, `en` y
  `x-default` mediante `hreflang`.
- Las portadas y las páginas de temporada, categoría, película, persona y fuente
  publican título, descripción, Open Graph, Twitter Card y datos estructurados
  acordes con su contenido. Acceso, cuenta, administración, API y callback de
  autenticación no se indexan.
- `sitemap.xml` incluye las rutas editoriales y de catálogo de ambos idiomas y se
  regenera como máximo cada 24 horas. `robots.txt` anuncia ese sitemap.
- Después de cambios de SEO, comprobar en producción títulos, canonicals,
  `hreflang`, JSON-LD, robots y una muestra de URLs del sitemap. En Google Search
  Console se vuelve a enviar `https://runscars.app/sitemap.xml` cuando cambia su
  cobertura. El nuevo rastreo y la indexación dependen de Google y no son
  inmediatos.

## Automatizaciones de fuentes

La salud se comprueba sobre ejecuciones reales, no solo sobre la existencia del
Cron:

- profesionales: ocho conectores activos, último run diario terminado y ninguna
  categoría requerida ausente;
- mercados: Kalshi y Polymarket con éxito dentro de las dos últimas horas;
- snapshots: un `snapshot_refresh_runs` terminado dentro de las últimas 36
  horas, aunque no se haya creado ningún corte nuevo;
- festivales: nueve conectores diarios a las 05:17 UTC; la ausencia de premios
  solo es incidencia 24 horas después del cierre de la edición;
- latencia profesional: cada conector termina en menos de dos minutos en una
  ejecución ordinaria; superar ese umbral exige revisar el run aunque concluya;
- retrasos: ningún run de las tres familias permanece `running` más de 15
  minutos.

Los schedules versionados siguen siendo `17 4 * * *` para profesionales,
`17 * * * *` para mercados y `47 4 * * *` para el refresco diario de cortes. Un
estado `partial`, un fallo posterior al último éxito o un run fuera de esas
ventanas exige tratar la automatización como incidente abierto.

Festivales añade `17 5 * * *` mediante
`supabase/schedules/run-festivals-daily.sql`. Se despliega y comprueba con:

```bash
npx supabase functions deploy run-festivals --no-verify-jwt --use-api \
  --import-map supabase/functions/deno.json
npx supabase db query --linked --file supabase/schedules/run-festivals-daily.sql
npm run festivals:import
npm run festivals:refresh
```

La auditoría viva no forma parte de CI porque consulta páginas externas. Tras
cada importación o despliegue se ejecuta `npm run audit:production`; recorre el
sitemap con reintentos acotados, abre cada candidatura, comprueba enlaces
internos, ejecuta los seis parsers profesionales contra sus páginas vigentes,
revisa Kalshi/Polymarket y comprueba frescura de conectores cuando dispone de
credenciales de servidor.

## Despliegue del circuito festivalero

1. Crear fuera del repositorio una copia lógica de roles, esquema y datos, con
   permisos `0700/0600`.
2. Aplicar primero las migraciones aditivas y regenerar tipos.
3. Desplegar `run-festivals`, instalar su schedule e importar el manifiesto
   inicial.
4. Ejecutar de nuevo profesionales y mercados para publicar los cortes
   correctivos de guion y excluir contratos incompatibles.
5. Verificar preview con unitarias, base, build, Playwright, Axe y auditoría
   viva; promover solo si todas las rutas públicas son resolubles.

La reversión pausa los conectores nuevos y repone los punteros vigentes a sus
versiones anteriores. No elimina capturas, aliases, exclusiones, historial de
matching ni snapshots bloqueados.

### Evidencia de 2026-09-01

- Una invocación autenticada de profesionales con el payload real
  `{"trigger":"scheduled"}` y la misma ruta `pg_net`/Vault terminó con HTTP 200:
  ocho de ocho conectores correctos, cero fallos y 27,2 segundos entre el primer
  inicio y el último cierre. El conector individual más lento tardó 14,3
  segundos. Las 478 observaciones ya existían, por lo que el resultado confirmó
  también la idempotencia.
- El Cron horario real arrancó a las 20:17 UTC y terminó `succeeded`; la llamada
  HTTP devolvió 200 con Kalshi y Polymarket correctos. Los runs de la hora habían
  terminado previamente en 66,8 y 35,5 segundos, con inicios separados por un
  milisegundo, y el Cron los reconoció como `unchanged` sin duplicarlos.
- Tres refrescos autenticados de snapshots terminaron correctos. El primero creó
  las ocho categorías, el segundo dejó las ocho `unchanged` y el tercero creó
  solo la revisión afectada, sin fallos. La última ejecución duró 6,4 segundos.
- Las ocho categorías públicas conservan entre cuatro y seis fuentes activas,
  entre 29 y 58 observaciones incluidas, cero observaciones excluidas y cero
  revisiones editoriales pendientes. No quedó ningún run profesional, de
  mercados o de snapshots en estado `running`.
- Supabase mantiene activos los schedules `17 4 * * *` y `17 * * * *`; Vercel
  mantiene habilitado `47 4 * * *`. El secreto de cada ruta está sincronizado
  con Vault y Vercel y no se registra en Git.

## Copias de seguridad

El plan Free de Supabase no incluye restauraciones automáticas. Antes de cada
despliegue con cambios de datos y, como mínimo, una vez por semana mientras haya
usuarios, crear una copia lógica fuera del repositorio:

```sh
npx supabase db dump --linked --role-only --file roles.sql
npx supabase db dump --linked --schema public,auth,storage --file full-schema.sql
npx supabase db dump --linked --data-only --use-copy --file data.sql
chmod 600 roles.sql full-schema.sql data.sql
```

`data.sql` contiene identidades, hashes de contraseña, sesiones y datos de
usuario. Debe permanecer fuera de Git, con acceso exclusivo del propietario. No
se comparte por correo ni se guarda en una carpeta pública.

Retención inicial: conservar las cuatro copias semanales más recientes y una
copia previa a cada migración destructiva. Cuando haya uso real sostenido,
actualizar a un plan con copias automáticas o mover el proceso a almacenamiento
cifrado fuera del equipo principal.

## Restauración

En un proyecto Supabase nuevo o una instancia desechable compatible:

1. restaurar `full-schema.sql` como administrador;
2. restaurar `data.sql` en una sola transacción y con
   `session_replication_role = replica`;
3. aplicar `roles.sql` únicamente en un proyecto Supabase que ya incluya sus
   roles reservados;
4. comprobar conteos esenciales, restricciones no validadas, RLS y acceso;
5. volver a configurar secretos, URLs OAuth y claves de conectores, ya que no
   pertenecen al dump;
6. verificar por separado cualquier objeto de Storage: el dump conserva su
   metadata, no el binario almacenado.

### Evidencia de 2026-08-26

Se generó una copia fuera del repositorio en
`/Users/nacho/Documents/Side/Runscars-backups/2026-08-26`, con permisos `0700`
para el directorio y `0600` para los SQL. La restauración se ejecutó en una
instancia aislada de `public.ecr.aws/supabase/postgres:17.6.1.147` y recuperó:

- 1 identidad de Auth;
- 2 temporadas y 84 películas;
- 238 capturas de películas TMDB;
- 24 fuentes y 4.338 observaciones profesionales;
- 0 restricciones sin validar.

La instancia temporal se elimina después de la comprobación. La copia no se
añade a Git.

### Evidencia de 2026-09-01

Antes de aplicar las migraciones se creó otra copia lógica fuera del repositorio
en `/Users/nacho/Documents/Side/Runscars-backups/2026-09-01-source-automation`.
El directorio tiene permisos `0700`; `roles.sql`, `full-schema.sql` y `data.sql`
tienen permisos `0600`. La copia contiene roles, esquema completo y 91.176.596
bytes de datos y no se añadió a Git.

## Incidentes

- Fallo web: revisar deployment y runtime logs de Vercel; si el cambio es la
  causa, promover el último deployment verificado.
- Fallo de base de datos: detener mutaciones editoriales, conservar logs y
  exportar una copia antes de corregir. Nunca ejecutar `db reset --linked` sobre
  el proyecto público.
- Fuente rota: pausar solo su conector. Los snapshots publicados permanecen
  inmutables y las demás fuentes deben seguir actualizándose.
- Secreto expuesto: rotarlo en el proveedor, actualizar Supabase/Vercel y
  desplegar de nuevo; no basta con borrarlo del historial visible.
- Contenido o cuenta: usar RLS y la auditoría editorial; no editar directamente
  una quiniela privada salvo recuperación solicitada por su propietario.

## Corte de integridad del 6 de septiembre de 2026

La evidencia por requisito y recorrido se registra en
[PRODUCTION_AUDIT_2026-09-06.md](PRODUCTION_AUDIT_2026-09-06.md). El alias
`runscars-staging.vercel.app` redirige a producción: las pruebas de cuentas,
visibilidad y borrado se ejecutan con Supabase local e identidades temporales.

Publicación reproducible: guardar los cambios relacionados en un commit con
correo GitHub noreply, ejecutar `npm run verify` y `npm run test:e2e`, desplegar
con `vercel deploy --prod --skip-domain --yes`, verificar ese artefacto, aplicar
migraciones/funciones necesarias y promover el mismo URL con `vercel promote`.
Los secretos y archivos de vinculación permanecen locales. La migración
`20260906160000` solo versiona extractores; no modifica conjuntos bloqueados.

Rollback web: `vercel rollback <deployment-id-anterior> --yes`. El punto anterior
es `dpl_EY7vDVzy1nYErT2aHZtpPQa739sM`; devuelve también las limitaciones iniciales
(festivales 404 y destinos de catálogo rotos). No revertir ni borrar conjuntos
inmutables. Si una función falla, desactivar su conector o restaurar la función
del commit anterior y registrar la incidencia; una captura fallida conserva
los últimos datos verificados. Nunca tratar un HTTP 200 vacío como frescura.

La migración `20260906170000` añade únicamente lectura de snapshots y resultados
al servicio editorial; las mutaciones permanecen bajo las funciones y triggers
inmutables. `20260906180000` versiona el parser de Berlín: las menciones especiales
a cortos heredan el formato del premio anterior dentro del mismo jurado. Una
reimportación genera una versión nueva, nunca edita el recibo anterior.
