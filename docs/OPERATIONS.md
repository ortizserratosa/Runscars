# Operación y recuperación

## Servicios

- Web: Vercel, proyecto `runscars`, publicado en
  `https://runscars.vercel.app`. La antigua URL de staging se conserva como
  alias de transición.
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
6. no aparecen errores nuevos en los logs de Vercel ni en Supabase.

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
