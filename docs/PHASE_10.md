# Fase 10 · QA y MVP

**Estado:** completada
**Inicio:** 2026-08-25
**Cierre:** 2026-08-26

## Alcance implementado

- Comunidad ligera con filtros y rutas canónicas de perfil y quiniela;
- visionado explícito `watched`, `not_watched` y `unmarked`;
- Web Share API, copia de enlace y tarjetas Open Graph de 1200×630;
- navegación y contenido público en español e inglés;
- metadatos localizados, `hreflang`, sitemap, robots y manifest;
- privacidad, condiciones, exportación y borrado de cuenta;
- Google OAuth, confirmación de correo y contraseñas nuevas de 12 caracteres;
- integración de los clientes de Analytics y Speed Insights de Vercel;
- cabeceras de seguridad y páginas de error públicas;
- captura TMDB vigente en `es-ES` y `en-US` para las 69 películas activas;
- revisión de publicación de fuentes y retirada pública de agregadores sin
  licencia compatible;
- copia lógica y restauración real documentadas en
  [OPERATIONS.md](OPERATIONS.md).

## Evidencia de cierre

- `npm run verify` en verde: 105 pruebas unitarias, 17 de base de datos,
  compilación de 1.059 páginas/rutas y 0 vulnerabilidades altas;
- 60 recorridos Playwright en verde entre Chromium de escritorio y móvil;
- auditoría axe en portada española, portada inglesa y acceso con 0
  infracciones, sin overflow a 390 px;
- medición de producción con TTFB de 6,4 ms, LCP de 1.092 ms y CLS 0 en la
  muestra de control;
- preview protegida validada antes de producción y comprobación visual del
  artefacto final;
- `GET /api/health` y `GET /api/health/database` en verde; sin errores ni 5xx
  en los logs posteriores al despliegue;
- alta directa por email rechazada con 403 por el hook remoto y Google OAuth
  redirigiendo de vuelta a `https://runscars.vercel.app/auth/callback`;
- `robots.txt`, sitemap, canonical y `hreflang` activos para español e inglés;
- URL pública estable: <https://runscars.vercel.app>. El alias anterior de
  staging apunta al mismo deployment durante la transición.

Web Analytics requiere que el propietario acepte sus condiciones desde una
terminal o el panel de Vercel. Speed Insights añade coste y no se activa sin esa
autorización. Ambos clientes están integrados, pero estas activaciones opcionales
no forman parte de la puerta del MVP; salud, runtime logs y runbook sí están
operativos.

## Ajuste posterior al cierre · 2026-08-29

Se retiró la pestaña pública de crítica y su entrada en el sitemap. La ruta
antigua redirige a la temporada activa. Las fichas con observación disponible
muestran el Metascore original, denominador, enlace canónico y fecha de captura
con la presentación descrita por Metacritic. El dato no se normaliza ni participa
en el consenso; Rotten Tomatoes, FilmAffinity y discovery siguen privados.

Ese mismo día se migró la URL canónica a <https://runscars.app>. Vercel sirve el
certificado HTTPS y redirige permanentemente `www` y los alias públicos
anteriores. La URL de sitio de la aplicación y Supabase Auth usan el dominio
propio; los callbacks antiguos se mantienen permitidos durante la transición.
