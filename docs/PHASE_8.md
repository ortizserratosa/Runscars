# Fase 8 · Usuarios

**Estado:** cerrada
**Inicio:** 2026-08-07
**Cierre:** 2026-08-07
**Staging:** `dpl_38TKUuJmjc9EqBgzoXNyqNDUH4Tt`

## Alcance del corte

- acceso por correo y contraseña mediante Supabase Auth;
- sesión SSR con PKCE y refresco en `proxy.ts`;
- perfil mínimo privado por defecto;
- ranking parcial por temporada y categoría, público o privado;
- estado `vista` por película;
- exportación JSON de los datos propios;
- borrado de cuenta y contenido tras reautenticación;
- perfiles y rankings públicos individuales, sin consenso comunitario.

## Contrato de privacidad

La identidad de escritura procede siempre de la sesión verificada, nunca de un
campo enviado por el navegador. Las acciones de servidor validan el contenido y
RLS vuelve a comprobar propiedad y visibilidad en PostgreSQL.

Un visitante solo puede leer:

1. perfiles con `is_public = true`;
2. rankings marcados como públicos cuyo perfil también sea público;
3. visionados cuyo perfil y preferencia específica sean públicos.

D-014 permanece como `Propuesta`: una posición ausente no recibe puntos ni se
extrapola, y los rankings individuales no forman un agregado público.

## Evidencia de la puerta

- [x] migración portable con perfiles, rankings, posiciones y visionados;
- [x] RLS comprueba aislamiento, modificación ajena y publicación explícita con
      dos UUID distintos;
- [x] sustitución del estado de visionado simulado por persistencia autenticada;
- [x] editor de rankings parciales en las categorías;
- [x] perfil propio, perfil público y controles de visibilidad;
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

- La entregabilidad de confirmaciones de correo depende de la configuración SMTP
  del proyecto Supabase; el recorrido tolera tanto confirmación obligatoria como
  alta inmediata.
- El consenso de rankings parciales no se implementa hasta aceptar o descartar
  D-014 con evidencia de uso.
- El borrado es irreversible. La interfaz exige reautenticación y confirmación
  textual antes de usar la operación administrativa.
