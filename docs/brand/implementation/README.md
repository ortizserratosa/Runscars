# Evidencia de implementación visual v1

Estas capturas se generan de forma reproducible con Playwright desde una build
local y datos fixture, sin depender de TMDB ni de webs externas en tiempo real.

1. compilar con `RUNSCARS_BRAND_AUDIT_FIXTURES=1` y las variables públicas de
   Supabase vacías;
2. arrancar la aplicación compilada con las mismas variables;
3. ejecutar
   `RUNSCARS_CAPTURE_BASE_URL=http://127.0.0.1:3100 npm --workspace web run brand:audit`.

`route-audit.json` registra URL, viewport, estado, encabezado, idioma, fuente,
presencia de marca y resultado por comprobación. La comparación coloca la
referencia vinculante y el primer pliegue de portada lado a lado; el tablero no
forma parte del runtime de la aplicación.

`RUNSCARS_BRAND_AUDIT_FIXTURES` es una bandera server-only y no debe
configurarse en Vercel. Solo permite el fixture de categorías en una build de
producción local sin Supabase; el comportamiento publicado permanece inalterado.

La captura `admin.png` es un fixture visual sin sesión: reutiliza el shell y las
clases de producción para revisar formularios y tablas. La redirección real de
`/admin` sin permisos forma parte del informe automatizado.
