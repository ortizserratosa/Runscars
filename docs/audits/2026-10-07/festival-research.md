# Circuito festivalero 2026: revisión de cobertura

Revisión del 7 de octubre de 2026. El reloj de la sesión confirmó la captura del
suplemento a las **08:32:29 UTC** y la corrección de Cannes a las **08:49:51
UTC**. Se leyeron las fuentes oficiales por HTTP y, para TIFF y Locarno, también
en el navegador. No se modificó producción desde esta subtarea.

La comparación usa los punteros y recuentos remotos guardados en
[`production-before.json`](production-before.json). Los recuentos «suplemento»
son el resultado local validado de `prepareFestivalSet`; se harán públicos
cuando el responsable de la entrega importe el manifiesto y compruebe los
punteros.

## Resultado verificable

| Festival            | Selección vigente antes | Selección con suplemento | Palmarés vigente antes | Palmarés con suplemento |
| ------------------- | ----------------------: | -----------------------: | ---------------------: | ----------------------: |
| Sundance            |                       0 |                       90 |                     30 |                      29 |
| Berlinale           |                       0 |                      149 |                     21 |                      21 |
| Cannes              |                      22 |                       76 |                     16 |                      16 |
| Locarno             |                       0 |              63, parcial |                     31 |                      31 |
| Venecia             |                      91 |                       91 |                      0 |                      16 |
| TIFF                |                       0 |                      206 |                      0 |                      20 |
| San Sebastián       |                      25 |                      141 |                      0 |                      35 |
| Telluride           |                      43 |                       43 |         No competitivo |          No competitivo |
| NYFF                |                      34 |           34, Main Slate |         No competitivo |          No competitivo |
| **Total de hechos** |                 **215** |                  **893** |                 **98** |                 **168** |

El suplemento contiene **11 conjuntos y 841 hechos**. Sustituye por nuevas
versiones cuatro conjuntos vigentes: Sundance/palmarés, Cannes/selección y
palmarés, y San Sebastián/selección. Los demás siete conjuntos son nuevos. El
conjunto público previsto pasa de 313 a **1.061 hechos** entre selecciones y
premios; son hechos festivaleros, no películas únicas ni puntos para el consenso
Oscar.

Se cubren las nueve ediciones con selección y los siete festivales competitivos
con premios. No se certifica como exhaustivo todo el circuito: Locarno conserva
una limitación explícita y NYFF sigue mostrando Main Slate; Spotlight y los
largos de Currents son ampliaciones pendientes de una captura igualmente
verificable. Telluride conserva los 43 largos ya revisados en septiembre. NYFF
sigue celebrándose hasta el 12 de octubre y su conector permanece activo.

## Fuentes y límites

- **Sundance selección:**
  [anuncio oficial de los 97 proyectos](https://www.sundance.org/blogs/2026-sundance-film-festival-unveils-97-projects-selected-for-the-feature-film-and-episodic-program/),
  publicado el 10 de diciembre de 2025, autor mostrado `alex courides`. Se
  recuperan 90 largos en diez secciones; se excluyen siete proyectos episódicos.
  Se conserva título y línea original de créditos, sin importar la sinopsis como
  parte del título.
- **Sundance palmarés:**
  [lista completa oficial](https://www.sundance.org/blogs/the-complete-list-of-2026-sundance-film-festival-award-winners/),
  fecha mostrada 30 de enero de 2026, autora mostrada `lucy spicer`. Incluye
  Festival Favorite, Sloan y dos premios de productores asociados a películas.
  Se excluyen cortos, desarrollo/mentoría y Gayle Stevens, un reconocimiento a
  una persona voluntaria. El parser anterior cruzaba párrafos y podía incorporar
  citas del jurado a título o premio; ahora delimita cada párrafo y el título
  nativo en cursiva.
- **Berlinale selección:**
  [archivo oficial filtrado por 2026](https://www.berlinale.de/en/archive/programme/programme-archive.html/y=2026/o=desc/p=1/rp=40).
  Se revisan sus ocho páginas, 286 proyectos; se retienen 149 largos
  contemporáneos con duración explícita superior a 40 minutos. Se excluyen
  Retrospective, Berlinale Classics, TEDDY 40, honoríficos, series, exhibiciones
  y duración desconocida. El archivo no proporciona fecha de publicación del
  conjunto: `publishedAt` queda nulo.
- **Cannes selección:**
  [selección oficial](https://www.festival-cannes.com/en/press/press-releases/the-films-of-the-official-selection-2026/),
  fecha mostrada 9 de abril, y
  [adiciones oficiales del 22 de abril](https://www.festival-cannes.com/en/press/press-releases/additions-to-the-selection-of-the-79th-festival-de-cannes/).
  La página inicial actualizada ya contiene 76 entradas en siete secciones. Las
  adiciones no se concatenan para evitar duplicados. La película de apertura
  aparece bajo el encabezado de competición pero la fuente la identifica
  explícitamente fuera de competición; esa etiqueta se conserva.
- **Cannes palmarés:**
  [lista oficial de ganadores](https://www.festival-cannes.com/en/press/press-releases/the-79th-festival-de-cannes-winners-list/),
  publicada el 23 de mayo a las 22:44:54 +02:00. Se corrigen las 16 entradas: el
  enlace de cada película determina su título y los intérpretes, directores,
  guionistas y técnicos se guardan como destinatarios. Se conservan los dos
  premios de dirección empatados y los dos premios CST. Caméra d’Or reconoce un
  largometraje y se mantiene; Short Films y La Cinef se excluyen. La nueva
  versión enlaza el conjunto vigente anterior sin alterar sus originales.
- **Locarno selección:**
  [lista de la cuenta del festival](https://letterboxd.com/filmfestlocarno/list/locarno-film-festival-2026-official-selection/),
  publicada el 9 de julio a las 08:58:42.295 UTC y actualizada el 19 de agosto
  según el HTML visible. La identidad está corroborada por el enlace de cabecera
  y pie de
  [la web oficial](https://www.locarnofestival.ch/press/press-releases.html) a
  `https://letterboxd.com/filmfestlocarno/`; se conserva abajo la evidencia
  mínima. La propia cuenta publica los intervalos de posiciones por sección. Se
  recuperan 63 largos contemporáneos de Piazza Grande, Concorso Internazionale,
  Concorso Cineasti del Presente, Fuori Concorso y Locarno Kids. Se excluyen
  cinco proyecciones de patrimonio de Piazza, la serie The Angel Maker y el
  corto Tomb of Dreams. Se conserva el título de visualización de Letterboxd en
  `originalData`, no se presenta como título en lengua original ni se fuerza un
  emparejamiento. **Parcial:** Open Doors y secciones paralelas requieren
  verificar formato de cada título; la lista incorpora 208 proyectos, con cortos
  y repertorio. El archivo cinematográfico de la web oficial no cargó datos, y
  la tabla oficial del palmarés por sí sola no permite reconstruir toda la
  selección.
- **Berlinale y Locarno palmarés vigente:** se revisan sus 21 y 31 filas en
  [una auditoría separada](berlin-locarno-awards-review.md). Berlín incorpora
  una corrección versionada de tres nombres en
  `2026-award-corrections-2026-10-07.json`, 21 hechos; Locarno conserva sus 31
  entradas, verificadas mediante el PDF oficial y la tabla del Prix du Public.
  Los dos archivos nuevos reúnen 12 conjuntos y 862 hechos de importación, con
  un total público previsto de 1.061 al reemplazar las versiones anteriores.
- **Venecia palmarés:**
  [premios oficiales de la 83.ª edición](https://www.labiennale.org/en/news/official-awards-83rd-venice-international-film-festival),
  12 de septiembre. Sus 16 hechos de largometrajes abarcan Venezia 83,
  Orizzonti, debut y público de Spotlight. Se excluyen cortos, restauraciones y
  obras inmersivas. Se mantiene intacta la selección vigente de 91 entradas.
- **TIFF selección:** [Films & Events](https://tiff.net/films?thumbnail), opción
  visible «More schedule options → Download Schedule → Download CSV». El CSV
  descargado ofrece título, programa, director, países e idiomas. Se deduplican
  las proyecciones por título y programa: 206 películas en nueve programas de
  largos contemporáneos. Se excluyen Market/Summit, conversaciones, programas
  colectivos de cortos, Primetime, Classics y patrimonio de Festival Street.
  TIFF Next Wave es una etiqueta secundaria, no una segunda selección. No hay
  fecha de publicación del CSV; se conserva captura y SHA-256.
- **TIFF palmarés:**
  [comunicado oficial](https://tiff.net/press/news/tiff-announces-2026-award-winners),
  20 de septiembre, TIFF Press Office. Lectura de la página renderizada: el HTTP
  directo devolvía un 202 sin contenido. Se transcriben 20 hechos: cuatro
  premios del público y ocho finalistas, Platform y premio especial del jurado,
  FIPRESCI, NETPAC y dos premios canadienses con sus menciones. Se excluyen seis
  premios/menciones Short Cuts. Las citas justificativas del jurado no forman
  parte de los títulos.
- **San Sebastián selección:**
  [todas las películas de la edición 74](https://www.sansebastianfestival.com/2026/sections_and_films/8/in).
  Sus 238 filas incluyen formatos y secciones que deben filtrarse: 141 largos
  con duración explícita superior a 40 minutos en secciones públicas
  contemporáneas. Se excluyen cortos, formatos episódicos o desconocidos,
  retrospectiva/Klasikoak, proyecciones honoríficas, WIP/industria y patrimonio
  de programas educativos. `publishedAt` queda nulo porque la tabla no publica
  una fecha propia.
- **San Sebastián palmarés:**
  [lista oficial](https://www.sansebastianfestival.com/2026/awards_and_jury_members/1/23725/in),
  26 de septiembre. Se retienen 35 premios/menciones ligados a largometrajes,
  incluidos el empate de interpretación, público y público europeo, música y
  premios paralelos publicados en este palmarés oficial. Se comprueba formato
  mediante los tiempos del programa. La fuente incluye el premio GIDOI+SGAE 2026
  a
  [Los domingos / Sundays en su catálogo 2025](https://www.sansebastianfestival.com/2025/sections_and_films/7/730787/in),
  115 minutos: se conserva ese enlace y se registra el premio de 2026 sin
  cambiar el año del film ni inferir elegibilidad Oscar. Se excluyen Nest, Eusko
  Label, Loterías, cortos, industria/desarrollo y honoríficos. La errata de
  sección `Pararels awards` se conserva como valor original.

Las fechas que la fuente muestra solo como día se almacenan a las 00:00 UTC, con
`publicationPrecision: "day"` en el recibo. Esta representación no afirma una
hora real de publicación. Cuando hay autor se conserva en
`rawCapture.sourceAuthor`; el esquema festivalero actual no tiene una columna de
autor independiente.

### Identidad oficial de Locarno

Lectura del DOM de la web oficial, 7 de octubre, 08:33–08:37 UTC:

```html
<a
  class="header__social__link"
  href="https://letterboxd.com/filmfestlocarno/"
  target="_blank"
  title="Letterboxd"
>
  <img class="header__social__link__img" alt="Letterboxd" />
</a>
<a
  class="footer__contact__social__link"
  href="https://letterboxd.com/filmfestlocarno/"
  target="_blank"
  title="Letterboxd"
>
  <img class="footer__contact__social__img" alt="Letterboxd" />
</a>
```

## Conservación y protección

El archivo `web/data/festivals/2026-supplement-2026-10-07.json` es una
importación separada. **No se debe reimportar `2026.json`**: volvería a publicar
capturas iniciales más pequeñas. Las correcciones enlazan el `set_id` vigente
del backup previo y explican el motivo; no editan conjuntos bloqueados. El
matching sigue siendo exacto y único, y los títulos alternativos o dudosos
permanecen en revisión editorial.

La identidad factual v2 excluye el estado de matching, IDs de catálogo y razones
editoriales: ampliar el catálogo no genera una nueva versión del mismo recibo.
La migración `20261007130000_festival_import_integrity.sql` conserva una captura
histórica nueva como versión inmutable, pero solo mueve el puntero público
cuando su fecha de captura es estrictamente posterior a la vigente. Reimportar
un hash ya conocido tampoco reactiva versiones anteriores. Cada fallo de
validación o persistencia manual se devuelve por conjunto y permite importar las
demás fuentes; el comando termina con código 1 si hubo fallos.

La migración `20261007110000_festival_reviewed_archives.sql` actualiza las URL
verificadas y los estados: ocho ediciones terminadas, NYFF en curso; siete
palmarés publicados y dos no competitivos. Archiva los ocho conectores de
ediciones cerradas, manteniendo su configuración, versiones, historial y cron.
Las correcciones se importan como una nueva versión manual. NYFF continúa
activo; un umbral de 34 largos evita aceptar una captura parcial como revisión
completa. Los adaptadores respetan `manual_archive_kinds` y los mínimos se
calculan después del filtrado de formato. Una respuesta HTTP vacía, una sola
sección o una captura con cortos no puede degradar el archivo revisado.

Los mínimos son protecciones conservadoras, no una definición permanente del
tamaño del festival. Si una fuente corrige su lista y elimina películas, debe
revisarse editorialmente y publicarse una versión manual nueva.

## Verificación local

### Enlaces externos de películas

Tras la aclaración del usuario, TMDB es el destino principal para el título y
cartel de una película fuera del catálogo Oscar. IMDb queda como enlace
secundario opcional. La ficha conserva el título original; si hay ficha propia,
el título sigue abriendo Runscars y ofrece también los enlaces externos. El
enlace de la película en la fuente se conserva cuando el recibo
incluye `filmUrl` o `sourceFilmUrl`; no se reconstruyen direcciones.

La lectura usa `public_festival_external_links` con filtros de hasta 200 IDs y
páginas de 500 filas. Solo expone el puntero confirmado. Este enriquecimiento no
modifica conjuntos festivaleros, `film_id`, candidaturas o elegibilidad. Las URL
de IMDb se forman exclusivamente a partir de IDs `tt` válidos; la página de la
fuente requiere HTTPS. Las pruebas renderizadas comprueban ambos destinos, la
ausencia de ficha propia y el rechazo de identificadores malformados. La prueba
de repositorio conserva los 2.053 enlaces a través de la paginación.

Las fixtures de navegación contienen dos identidades ajenas al catálogo Oscar,
verificadas mediante título y dirección en TMDB: **Bedford Park**, Stephanie
Ahn, TMDB `1470198`, IMDb `tt35504660`; y **Carousel**, Rachel Lambert, TMDB
`1558701`, IMDb `tt38626943`. Sus URLs y captura del 7 de octubre a las
09:05:18.348 UTC se guardan en `2026-external-links-fixture.json`, separado de
los recibos originales. Se mantiene `filmId: null` y el estado de matching
`unmatched`; el enlace externo confirmado no crea candidatura ni ficha Oscar.
Las siete pruebas focalizadas de enlaces, fixtures y paginación son verdes.

### Carteles y metadatos TMDB independientes del catálogo

`FestivalEntryView.tmdbId` procede exclusivamente del puntero confirmado de
`public_festival_external_links`. `getFestivalArtwork` consulta capturas locales
vigentes de `tmdb_movie_snapshots` por ese ID, sin llamar a TMDB durante una
visita ni crear películas, candidaturas o elegibilidad. Se muestran título
localizado cuando difiere, año de estreno y duración, separados de los títulos,
destinatarios, premios y temporadas originales.

La lectura conserva solo la última verificación por idioma, usando
`last_verified_at` y `fetched_at` para capturas legadas. El cartel puede caer al
otro idioma vigente; nunca recupera una imagen de una revisión antigua retirada
ni mezcla una imagen de un `filmId` anterior con la identidad TMDB confirmada.
Sin imagen se conserva un bloque de título y su enlace. El contexto festivalero
retira el sello Oscar del componente de cartel; sus demás usos conservan el
comportamiento existente.

`2026-tmdb-metadata-fixture.json` contiene capturas reales del 7 de octubre a las
10:04 UTC: Bedford Park, 121 minutos, y Carousel, 103 minutos, en `es-ES` y
`en-US`, con rutas de cartel/fondo, fechas y URLs originales. No se descargan
imágenes ni se guardan credenciales. Las pruebas reproducibles comprueban
renderizado y enlaces sin depender de una petición al CDN en tiempo real.

- **16 pruebas unitarias verdes** en cinco archivos: identidad externa,
  original/localizado separados, metadatos, retirada de cartel, expiración,
  verificación de hash restaurado, filtros y paginación de más de 2.000 IDs,
  fallo de caché y conservación del sello en contextos ajenos al festival.
- **8 E2E verdes** en escritorio y móvil: carteles fuera del catálogo Oscar,
  título/cartel hacia TMDB, IMDb secundario, fuentes originales, ausencia del
  sello y placeholder sin imagen con destino conservado.
- **2 recorridos de navegación verdes** tras acotar la búsqueda del enlace de
  FJORD al título, ya que el cartel también permite abrir la ficha.
- Lint verde; la revisión de tipos incluye la nueva columna de verificación.

### Capturas, listados y navegación

- Pruebas unitarias focalizadas: dos archivos, **32 pruebas verdes**; incluyen
  nuevos casos de HTML nativo, separación de citas/títulos, exclusión de
  formatos, archivo estático sin fetch, rechazo de captura parcial y
  conservación de publicación.
- Las once capturas del suplemento pasan `prepareFestivalSet` con sus 841
  entradas y producen el mismo hash en ejecuciones repetidas. Los títulos no
  incluyen bloques de sinopsis o citas de jurado.
- Base de datos embebida: **35 pruebas verdes**, incluidas migraciones, RLS,
  atomicidad, idempotencia e inmutabilidad. Se actualiza la expectativa de
  estado festivalero y se comprueba que queda un único conector activo.
- Typecheck y lint focalizado verdes. Las fixtures eligen la captura más
  reciente por tipo e incorporan ambos manifiestos; las fichas muestran el
  alcance parcial de Locarno y Main Slate de NYFF en español e inglés.
- E2E focalizado: **8 pruebas verdes** en escritorio y móvil; calendario,
  filtros, enlaces oficiales, listados TIFF completos y notas de cobertura. La
  ficha local de Locarno también se comprobó en el navegador: 63 títulos y
  alcance parcial visible.
- La importación y verificación pública corresponden al responsable de la
  entrega principal. Este documento registra cobertura local comprobada y
  conserva las limitaciones abiertas.
