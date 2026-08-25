# Fase 9 · Administración editorial

**Implementada:** 2026-08-25.

## Resultado

La ruta privada `/admin` reúne las operaciones ordinarias que antes exigían
scripts o edición directa de PostgreSQL:

- resolver una observación contra una candidatura canónica;
- excluir una observación preservando su captura original;
- descartar revisiones con motivo;
- corregir la identidad TMDB y refrescar catálogo y créditos;
- cambiar estados editoriales, técnicos y de publicación de una fuente;
- activar o pausar conectores;
- ejecutar ingestas activas o cargar un manifiesto manual v1;
- procesar snapshots periódicos y bloquear cierres de nominación o ganador;
- importar resultados oficiales v2 y registrar correcciones enlazadas;
- consultar runs, snapshots, result sets y la bitácora editorial.

## Seguridad y trazabilidad

`editorial_admins` es una allowlist privada vinculada a Supabase Auth. La página
y cada Server Action verifican la sesión y la pertenencia. Las operaciones
sensibles usan la clave de servicio solo en servidor y las RPC editoriales no
son ejecutables por `anon` ni `authenticated`.

`editorial_actions` es append-only e idempotente. Las operaciones de matching,
exclusión, descarte y gobierno de fuentes registran su auditoría dentro de la
misma transacción. Las operaciones compuestas registran resultado e identidad
de la versión creada al terminar.

Bootstrap operativo:

```bash
npm run admin:grant -- correo@example.com
npm run admin:list
npm run admin:revoke -- correo@example.com
```

## Puerta de salida

- Un administrador autenticado dispone de todos los controles rutinarios sin
  abrir SQL.
- Un visitante se redirige a acceso; un usuario autenticado fuera de la
  allowlist recibe una ruta no encontrada.
- RLS, permisos de función, inmutabilidad e idempotencia se comprueban en la
  suite de base de datos.
- Toda mutación exige un motivo editorial.

La evidencia automatizada vive en `web/tests/database/migration.test.ts` y
`web/tests/e2e/navigation.spec.ts`.
