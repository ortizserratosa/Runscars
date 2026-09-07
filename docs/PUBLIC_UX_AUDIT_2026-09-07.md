# Festivales y copy público · 7 de septiembre de 2026

## Resultado del corte

Rediseño local del índice y de las nueve ediciones festivaleras: calendario
cronológico, fechas legibles, edición destacada, adelantos de películas,
palmarés antes de selección, búsqueda por título/cineasta/premio y filtro de
sección. Los enlaces conectan festival, película y temporada Oscar.

Las ausencias se expresan como cobertura de Runscars, no como falta de anuncio
del festival. Siempre se ofrece una salida al programa oficial. Telluride y
Nueva York se describen como no competitivos y no muestran un palmarés vacío.

Se ha preparado un suplemento de 43 largometrajes de Telluride desde su
programa oficial: [manifiesto](../web/data/festivals/2026-telluride.json).
Se muestra en los datos locales reproducibles. Para incorporarlo a Supabase se
usa la importación específica documentada en [fuentes](DATA_SOURCES.md).
**No se ha importado en producción ni desplegado este corte.**

## Auditoría de copy

Se revisaron las plantillas públicas y las variantes española e inglesa.

| Superficie | Problema | Cambio |
|---|---|---|
| Festivales | Extractores, versiones, matching y recibos dominaban la lectura | Fechas, películas, premios y programa; fuente y fechas desplegables |
| Películas y personas | Mensajes de caché, ausencia de captura TMDB y dataset editorial | Se omiten módulos vacíos; se conservan ficha, enlaces y atribución |
| Comunidad, perfil, quiniela y tarjeta social | Repetición de lo que la comunidad no hace | Invitación a descubrir favoritas, ordenar y compartir |
| Acceso y visionado | Explicaciones de señales y beta ajenas a la acción | Instrucciones breves para acceder, guardar y elegir privacidad |
| Categorías | Copy de observaciones preservadas y actualizaciones publicables | Predicciones incluidas y disponibilidad en lenguaje directo |
| Mercados | Párrafo defensivo repetido | Se conserva separación del ranking y diferencia entre fechas, en dos frases |
| Fuentes | Estados internos sin traducir (`technicalStatus`, `publicationStatus`) | Se conservan salud útil, fecha de comprobación y publicaciones originales |
| Evaluación | IDs de snapshots/resultados y mensajes de base de datos | Acierto frente a resultados oficiales y enlace al archivo |
| Metodología | Contrato obsoleto de media crítica 0–5 | Metascore original sobre 100, conforme a D-047; se elimina hash e IDs del relato |
| Portada y pie | Promesas absolutas y vocabulario técnico | Beneficio concreto de consultar las fuentes |
| Privacidad, condiciones y créditos | Información necesaria para decidir y atribuir | Se conserva la información de derechos, proveedores y protección |
| Administración | Estados útiles para trabajar | Se conserva su lenguaje operativo |

Decisión: [D-057](DECISIONS.md#d-057--guía-de-festivales-y-lenguaje-público-orientado-al-visitante).
El cálculo profesional, los permisos, los valores originales y los registros
inmutables no cambian. D-053 sigue siendo Propuesta.

## Verificación

- Formato, ESLint y TypeScript: correctos.
- Unitarias: 152 pruebas correctas, incluida preparación idempotente del
  suplemento Telluride y exclusión de cortos/reposiciones.
- PostgreSQL embebido: 22 pruebas correctas de migraciones, RLS e idempotencia.
- Playwright: 118 casos ejecutados; 114 correctos en la pasada completa.
  Cuatro expectativas antiguas de copy se adaptaron al nuevo texto o a la
  ausencia deliberada del aviso TMDB y sus cuatro reejecuciones fueron correctas.
  Incluye escritorio, móvil y smoke de Firefox y WebKit.
- Auditoría de interfaz: 100 combinaciones de ruta, idioma y viewport, todas
  con HTTP 200, sin overflow, excepciones JavaScript ni infracciones detectadas
  por axe para WCAG 2 A/AA y 2.1 AA. La revisión automática no sustituye una
  evaluación exhaustiva con tecnologías de asistencia.
- Búsqueda sin tildes, filtros independientes entre selección y palmarés,
  restablecimiento, enlaces a películas y procedencia: verificados en navegador.
- Build de producción: correcta, con la bandera de fixtures server-only y
  credenciales externas vacías.
- `git diff --check` y enlaces relativos de documentos modificados: comprobados
  al cierre.

[Evidencia de interfaz](audits/2026-09-07/ui.json),
[índice de escritorio](audits/2026-09-07/desktop-festivals.png),
[índice móvil](audits/2026-09-07/mobile-festivals.png),
[Cannes en escritorio](audits/2026-09-07/desktop-cannes.png) y
[Telluride en móvil](audits/2026-09-07/mobile-telluride.png).
Las capturas y pruebas usan fixtures locales y no consultan fuentes externas.
La investigación de Telluride y el diagnóstico HTTP de TIFF se hicieron aparte.

## Recomendaciones priorizadas (propuestas)

| Prioridad | Recomendación | Beneficio y criterio de éxito |
|---|---|---|
| 1 | Dar a cada festival y categoría una tarjeta social propia con ganador o líder, cartel disponible y fecha | Mejor contexto al compartir. Medir visitas referidas y clics hacia películas; no usar imágenes genéricas idénticas para todas las rutas |
| 1 | Publicar un resumen semanal breve: qué película sube, qué fuente cambió y qué festival viene | Motivo concreto para regresar y material original para difusión. Enlazar a cortes y páginas canónicas; medir lectores recurrentes y visitas orgánicas |
| 1 | Revisar Search Console por página y consulta en ambos idiomas | La web ya tiene sitemap, canonical y hreflang. Priorizar cobertura y rendimiento de páginas de festival, palmarés y predicciones; medir indexación, impresiones, CTR y clics, sin duplicar páginas por sinónimos |
| 2 | Incorporar carteles de películas a selecciones y favoritos, reutilizando los metadatos TMDB ya disponibles | Hacer más reconocible y cinematográfica la exploración; medir apertura de fichas y películas marcadas como vistas |
| 2 | Probar una quiniela de muestra editable antes del registro y pedir cuenta al guardar | Mostrar el valor de participar antes del acceso. Medir inicio de quiniela → cuenta → primer guardado; requiere un diseño separado de borradores y privacidad |
| 2 | Ofrecer un aviso semanal optativo de cambios en categorías favoritas | Retención. Validar primero demanda; medir altas voluntarias, retorno y bajas. Requiere canal de envío y preferencias explícitas |
| 3 | Compartir resúmenes útiles con comunidades y creadores de cine, enlazando a la fuente exacta | Conseguir visitas cualificadas y enlaces editoriales. Respetar las reglas de cada comunidad; no automatizar publicaciones ni enviar mensajes sin autorización |

Fundamento de búsqueda: la [guía SEO de Google](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
recomienda contenido útil y original, títulos descriptivos, enlaces rastreables,
promoción pertinente y seguimiento en Search Console. Las prioridades de
producto y conversión de esta tabla son hipótesis de Runscars para validar,
no promesas de tráfico ni mejoras medidas.

## Límites reales

- TIFF devuelve 403 tanto en la consulta web como en navegador. No se ha creado
  un listado de Toronto a partir de fuentes secundarias ni se ha inventado su programa.
- La carga manual de Telluride no implementa un extractor PDF automático.
- Los problemas previos de Locarno, NYFF y TIFF siguen documentados en
  [DATA_SOURCES.md](DATA_SOURCES.md); este corte no declara saludables sus feeds.
- El suplemento y la interfaz deben publicarse por los flujos existentes para
  que aparezcan en la web de producción.

## Ampliación autorizada: publicación y atractivo

El usuario autorizó expresamente la publicación e implementación de las mejoras.
D-058 incorpora la edición semanal, RSS, carteles en descubrimiento, tarjetas
sociales propias y prueba de quiniela antes del acceso. Se añaden enlaces
visibles desde portada/navegación/pie y las nuevas rutas al sitemap bilingüe.
Los eventos de quiniela no incluyen elecciones ni datos de cuenta.

[Material festivalero que falta](FESTIVAL_PROGRAMME_HANDOFF.md): prioridades,
formatos admitidos y campos necesarios para completar el circuito posteriormente.
Las comunicaciones a comunidades y el correo por categorías siguen siendo
propuestas: este release ofrece suscripción RSS y no envía mensajes a terceros.

La evidencia de publicación se añadirá al cerrar la verificación del artefacto
público; los resultados locales anteriores no certifican el release ampliado.
