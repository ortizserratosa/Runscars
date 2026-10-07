# Premios precursores · auditoría del 7 de octubre de 2026

La petición actual incorpora premios de sindicatos y críticos como contexto de
la carrera. Se han comprobado las webs oficiales de seis organismos. El corte
añade sus calendarios 2027 y un archivo parcial de 25 ganadores de cine de las
ceremonias 2026. Los hechos no participan en las observaciones profesionales,
Borda, cobertura de predicciones, recepción ni comunidad.

## Calendarios de la temporada Oscar 2027

| Organismo                              | Anuncio de nominaciones de cine                         | Ceremonia             | Recibo oficial                                                                                                       |
| -------------------------------------- | ------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Actor Awards · SAG-AFTRA, 33.ª edición | 6 de enero de 2027                                      | 28 de febrero de 2027 | [Calendario](https://www.actorawards.org/awards/calendar)                                                            |
| DGA, 79.ª edición                      | 7 de enero de 2027, largometraje de ficción             | 30 de enero de 2027   | [Calendario anual](https://www.dga.org/Awards/Annual)                                                                |
| PGA, 38.ª edición                      | 8 de enero de 2027, largometrajes teatrales y animación | 27 de febrero de 2027 | [Fechas clave](https://producersguild.org/2027-2028-producers-guild-awards-key-dates/)                               |
| WGA, 79.ª edición                      | 8 de enero de 2027                                      | 13 de febrero de 2027 | [Timeline](https://awards.wga.org/awards/timeline)                                                                   |
| Critics Choice, 32.ª edición           | 4 de diciembre de 2026                                  | 3 de enero de 2027    | [Calendario y categorías](https://www.criticschoice.com/critics-choice-awards-submissions-and-categories/)           |
| EE BAFTA Film Awards, 80.ª edición     | 19 de enero de 2027                                     | 21 de febrero de 2027 | [Anuncio oficial de apertura](https://www.bafta.org/media-centre/press-releases/2027-film-awards-opens-for-entries/) |

PGA anuncia documentales el 8 de diciembre de 2026; se conserva como hito
distinto del anuncio de ficción. BAFTA publica la longlist el 7 de enero de
2027; no se convierte en nominaciones. No se capturan votaciones de televisión
como si fueran premios de cine.

La nota PGA está publicada el 7 de abril de 2026 y la nota BAFTA el 22 de julio.
Los otros cuatro calendarios vivos no proporcionan una fecha inequívoca de
publicación para sus hechos; `publishedAt` queda nulo. La captura conserva la
consulta del 07/10 a las 08:18:08 UTC. No se usa una fecha de copyright, la
fecha de una ceremonia anterior, el reloj de la web ni `updated_at` para
inventarla.

El
[anuncio DGA del 17 de abril](https://www.dga.org/news/pressreleases/2026/260416_dga-announces-date-for-2027-awards-ceremony)
corrobora la ceremonia, pero el manifiesto usa el calendario anual para incluir
también las nominaciones actuales. La
[nota de Critics Choice del 20 de abril](https://www.criticschoice.com/32nd-annual-critics-choice-awards-to-be-held-on-sunday-january-3-2027-at-the-barker-hangar/)
corrobora la ceremonia; su calendario de candidaturas contiene el anuncio de
nominaciones. La
[nota WGA del 16 de julio](https://www.wga.org/news-events/news/press/2026/2027-writers-guild-awards-date-announced)
corrobora su ceremonia. Las fuentes superan así la comprobación de una
publicación oficial y un archivo o segundo anuncio verificable.

## Archivo parcial Oscar 2026

| Organismo      |                   Ganadores conservados | Fecha de ceremonia    | Fuente y publicación                                                                                                                                              |
| -------------- | --------------------------------------: | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actor Awards   |     5: cuatro interpretaciones y elenco | 1 de marzo de 2026    | [Comunicado de resultados, 1 de marzo](https://actorawards.org/media/news/releases/outstanding-film-and-television-performances-honored-32nd-annual-actor-awards) |
| DGA            |    1: dirección de largometraje teatral | 7 de febrero de 2026  | [Comunicado, 7 de febrero](https://www.dga.org/news/pressreleases/2026/260207_78th_annual-dga-award-winners)                                                      |
| PGA            |   1: producción de largometraje teatral | 28 de febrero de 2026 | [Comunicado de ganadores, 1 de marzo](https://producersguild.org/2026-pga-awards-winners/)                                                                        |
| WGA            |            2: guion original y adaptado | 8 de marzo de 2026    | [Comunicado, 8 de marzo](https://www.wga.org/news-events/news/press/2026-writers-guild-awards-winners-announced)                                                  |
| Critics Choice | 8: las categorías públicas relacionadas | 4 de enero de 2026    | [Comunicado, 4 de enero](https://www.criticschoice.com/one-battle-after-another-wins-best-picture-at-the-31st-annual-critics-choice-awards/)                      |
| BAFTA          | 8: las categorías públicas relacionadas | 22 de febrero de 2026 | [Comunicado, 22 de febrero](https://www.bafta.org/media-centre/press-releases/winners-announced-2026-film-awards/)                                                |

Son resultados de la temporada previa, asociada a `oscars-2026`. No se atribuyen
a películas de 2026 ni se presentan en el calendario activo como triunfos de
Oscar 2027. No hay nominaciones completas en este archivo; televisión,
honoríficos y categorías fuera del corte quedan excluidos de este manifiesto,
sin afirmar que el organismo no las publique.

Se conserva la categoría original. El elenco de SAG-AFTRA es una relación
contextual con Mejor película (`related`), nunca una equivalencia. Las
categorías de interpretación, dirección, producción y guion se relacionan para
navegar, no para sustituir la elegibilidad ni los resultados Oscar. WGA y BAFTA
tienen reglas propias; por ejemplo, el
[periodo teatral británico de BAFTA 2027](https://www.bafta.org/awards/awards-information/film/)
se extiende al 19 de febrero de 2027, de modo que la edición BAFTA no acredita
por sí sola elegibilidad Oscar de un título.

## Implementación e integración

- [Manifiesto factual](../../../web/data/precursors/2026-2027.json): seis
  calendarios y seis conjuntos de ganadores, con fuentes, autor institucional,
  publicación cuando consta, consulta, originales y alcance bilingüe.
- [Migración](../../../supabase/migrations/20261007120000_precursor_awards.sql):
  seis fuentes `official`, seis organismos, doce ediciones, conjuntos y entradas
  inmutables, punteros vigentes y correcciones de matching append-only.
- [Importador](../../../web/scripts/precursors.mjs): `validate` verifica sin
  escribir; `import` persiste de forma aislada e idempotente por conjunto;
  `match` exige motivo y una película de la misma temporada.
- `/premios` y `/premios/[organization]/[year]`, en español e inglés, ofrecen
  calendarios, archivo parcial, originales y procedencia. Las fichas de fuentes
  enlazan el contexto; temporada, película, navegación y sitemap se integran en
  el corte principal.

La identidad del recibo no cambia al repetir una consulta o resolver un
matching. La actualización de originales, alcance o extractor genera otra
versión. Una corrección conserva su enlace y motivo. Reimportar una versión
antigua no cambia el puntero de una corrección más reciente. Los homónimos y
títulos ausentes quedan sin enlace; un título exacto solo se empareja dentro de
su temporada.

RLS permite leer los hechos públicos y restringe la escritura y las funciones de
importación a `service_role`. Motivo, actor y candidatos de matching no están
concedidos al lector público. Cambiar la fuente a un estado no publicable oculta
organismo, ediciones, recibos, entradas y matching sin borrar historial.

Las guardias de importador y SQL exigen fecha oficial de ceremonia para
ganadores y una fecha oficial de anuncio o publicación para nominaciones. Una
fecha futura impide registrar un resultado prematuro. Los calendarios no
incluyen entradas de resultado; una lista de resultados vacía se rechaza.

## Límites y comprobaciones

La incorporación inicial es manual asistida y reproducible. No se anuncia un
conector automático, un Cron ni cobertura de todas las categorías. Los
resultados 2027 se incorporarán cuando existan anuncios verificables; el
calendario evita inventarlos mientras tanto. Otros sindicatos, asociaciones
regionales de crítica y Golden Globes pueden añadirse con el mismo contrato tras
verificar su edición y publicación.

Se ejecutaron `node web/scripts/precursors.mjs validate` y las suites unitarias
y de PostgreSQL dedicadas: 13 pruebas pasan sobre fixtures locales, incluyendo
idempotencia, RLS, control de publicación, inmutabilidad, límites temporales,
aislamiento de errores y correcciones. Se añadieron recorridos E2E y Axe de las
nuevas rutas y de su acceso desde Fuentes; la verificación global y la
publicación se acreditan en la auditoría de entrega del corte principal.
