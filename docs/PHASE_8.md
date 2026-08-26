# Fase 8 · Usuarios

**Estado:** cerrada
**Inicio:** 2026-08-07
**Cierre:** 2026-08-07
**Staging:** `dpl_38TKUuJmjc9EqBgzoXNyqNDUH4Tt`

## Alcance del corte

- acceso por correo y contraseña mediante Supabase Auth;
- acceso social con Google mediante el callback SSR de la aplicación;
- confirmación de correo y contraseñas nuevas de al menos 12 caracteres;
- sesión SSR con PKCE y refresco en `proxy.ts`;
- perfil mínimo privado por defecto;
- ranking parcial por temporada y categoría, público o privado;
- estado de visionado explícito por película: `vista`, `no vista` o `no indicada`;
- exportación JSON de los datos propios;
- borrado de cuenta y contenido tras reautenticación;
- perfiles y rankings públicos individuales, sin consenso comunitario;
- descubrimiento de quinielas públicas y enlaces sociales canónicos.

## Contrato de privacidad

La identidad de escritura procede siempre de la sesión verificada, nunca de un
campo enviado por el navegador. Las acciones de servidor validan el contenido y
RLS vuelve a comprobar propiedad y visibilidad en PostgreSQL.

Un visitante solo puede leer:

1. perfiles con `is_public = true`;
2. rankings marcados como públicos cuyo perfil también sea público;
3. estados de películas incluidas en esos rankings públicos, siempre que el
   perfil también sea público.

La columna `watched_is_public` se conserva únicamente como legado de migración y
ya no gobierna ninguna lectura. La ausencia de fila en `user_film_states` es
`unmarked`; una fila existente guarda `watched` o `not_watched`.

D-014 permanece como `Propuesta`: una posición ausente no recibe puntos ni se
extrapola, y los rankings individuales no forman un agregado público.

## Evidencia de la puerta

- [x] migración portable con perfiles, rankings, posiciones y visionados;
- [x] RLS comprueba aislamiento, modificación ajena y publicación explícita con
      dos UUID distintos;
- [x] sustitución del estado de visionado simulado por persistencia autenticada;
- [x] editor de rankings parciales en las categorías;
- [x] perfil propio, perfil público y controles de visibilidad;
- [x] Comunidad pública, rutas canónicas y tarjeta social Open Graph;
- [x] control de tres estados en ficha y editor de rankings;
- [x] exportación autenticada y no cacheable;
- [x] borrado completo con contraseña actual y clave de servicio solo servidor;
- [x] migración aplicada en staging;
- [x] recorrido real con dos identidades en staging;
- [x] suite canónica y comprobación visual móvil/escritorio en verde.

La prueba remota observó cero filas privadas para la segunda identidad, cero
modificaciones ajenas y cuatro grupos de datos visibles después de publicarlos
explícitamente. El recorrido autenticado guardó y recargó un ranking, marcó una
película, abrió el perfil público y descargó la exportación. Tras confirmar el
borrado con la contraseña actual, Auth, perfil, rankings y visionados devolvieron
cero filas para la identidad eliminada.

## Riesgos y decisiones pendientes

- Las altas nuevas por correo quedan pausadas para el lanzamiento público: el
  SMTP compartido de Supabase no es una dependencia aceptable de producción.
  Google crea cuentas nuevas y el acceso por correo se conserva para cuentas
  existentes. La interfaz, la acción de servidor y un hook `before-user-created`
  bloquean el alta directa por email. La alta por correo volverá con dominio y
  SMTP propios.
- Google Auth está activo en staging con un proyecto Google Cloud independiente,
  audiencia externa en producción y los permisos mínimos `openid`, `email` y
  `profile`. El secreto se gestiona directamente en Supabase y no se guarda en
  el repositorio.
- El consenso de rankings parciales no se implementa hasta aceptar o descartar
  D-014 con evidencia de uso.
- El borrado es irreversible. La interfaz exige reautenticación y confirmación
  textual antes de usar la operación administrativa.

### Actualización de seguridad · 2026-08-25

La pantalla de acceso ofrece Google como proveedor social y construye el
callback a partir de `NEXT_PUBLIC_SITE_URL`, por lo que staging ya no genera
enlaces de confirmación hacia `localhost`. Supabase mantiene la confirmación de
correo, el límite de 12 caracteres para nuevas contraseñas, rotación de refresh
tokens y límites de frecuencia. El inicio de sesión existente no impone la
nueva longitud para no bloquear cuentas antiguas; la política se aplica al crear
cuentas nuevas.

El 26 de agosto de 2026 se creó el proyecto Google Cloud `runscars`, se publicó
la pantalla de consentimiento con la portada y la política de privacidad de
staging y se activó el proveedor en Supabase. La prueba real seleccionó una
cuenta Google, completó el consentimiento, intercambió el código PKCE y terminó
en `/cuenta` con sesión válida y perfil privado.
