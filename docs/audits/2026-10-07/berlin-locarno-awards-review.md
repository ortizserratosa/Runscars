# Revisión de premios actuales de Berlín y Locarno

## Resultado

Se consultaron por REST, mediante SELECT, los conjuntos actuales de producción:
Berlinale, 21 filas, y Locarno, 31. No se escribió en producción. La comparación
de sección, premio, película y destinatario no encontró personas usadas como
títulos, cortometrajes, honoríficos ni citas del jurado mezclados con películas.

La única corrección necesaria afecta a tres destinatarios de Berlín. El archivo
separado `web/data/festivals/2026-award-corrections-2026-10-07.json` añade **un
conjunto versionado con las mismas 21 filas** y enlaza
`berlinale-2026-awards-97c60e631bbe`. No añade premios ni cambia títulos o
secciones. La importación queda a cargo del agente principal.

| Fila | Película     | Destinatario corregido               |
| ---- | ------------ | ------------------------------------ |
| 5    | Rose         | Sandra Hüller                        |
| 6    | Queen at Sea | Anna Calder-Marshall & Tom Courtenay |
| 7    | Nina Roza    | Geneviève Dulude-de Celles           |

Las entidades HTML originales y el enlace entre destinatario y película se
conservan en `originalData.rawDetailsHtml`; se elimina `in:` del campo de
nombre. El conjunto anterior sigue inmutable. El agente de festivales incorpora
la decodificación y el manejo del sufijo en el parser para evitar nuevas
capturas con el mismo defecto.

## Berlinale

Fuente:
[archivo oficial de premios](https://www.berlinale.de/en/archive/awards-juries/awards.html).
Respuesta HTTPS 200 capturada el `2026-10-07T08:48:57.381Z`. Las 21 tuplas
coinciden con los bloques visibles de 2026: ocho premios del jurado
internacional, ocho de Generation, dos de Perspectives y tres documentales. Los
bloques de cortometrajes y sus menciones especiales se excluyen conservando su
contexto; los honoríficos y las declaraciones del jurado también quedan fuera.

La fuente no publica fecha editorial ni autor: ambos siguen ausentes. El
encabezado HTTP Last-Modified queda como metadata de transporte, nunca como
fecha de publicación del premio. El HTML original se conserva fuera de Git en el
backup privado del encargo, `berlinale-awards-official-2026-10-07.html`, con
SHA-256 `099fa659b605a5f08b81b43729fc99cc1899994e800d7e45f8e083cd0444264b`.

## Locarno

El
[PDF oficial Locarno79](https://www.locarnofestival.ch/dam/jcr:43be8be5-b5f4-4c0c-85d5-774e7ca025ad/Locarno79-Palmar%C3%A8s-ENG.pdf)
está enlazado desde el
[comunicado del palmarés](https://www.locarnofestival.ch/press/press-releases/2026/08/locarno79-the-pardo-d-oro-goes-to-you-don-t-belong-here-by-florin-serban.html).
Se descargó por HTTPS 200, se extrajo su texto y se revisaron visualmente las
páginas 3–4 y 7–12. Confirma **30 de las 31 tuplas** actuales, incluidos los
premios de jurados independientes y Semaine de la Critique.

El Prix du Public UBS para Frank & Louis, de Petra Volpe, se confirma en la
[tabla oficial de premios](https://www.locarnofestival.ch/festival/palmares.html),
consultada por el agente de festivales en el navegador con edición 2026 y las 30
filas desplegadas. La tabla contiene 19 tuplas de largometraje y 11 de corto;
estas últimas no aparecen en el conjunto de Runscars. El recibo de la tabla está
en `locarno-awards-official-table.txt`.

Los encabezados First Feature y Pardo for Change del conjunto actual coinciden
con el PDF, aunque la tabla del archivo coloca esos mismos premios bajo la
sección de programa de la película. Se mantienen los encabezados de su fuente
original. **No se prepara corrección de Locarno ni se reduce su conjunto de 31
filas a las 19 visibles en la tabla.**

El PDF original se guarda en el backup privado como
`locarno79-palmares-official-2026-10-07.pdf`; su SHA-256 y fecha de captura
están en `locarno-awards-receipt.json`. Se conserva exclusivamente como
evidencia; no se copian citas del jurado ni credenciales de vídeo al producto o
al recibo.

## Verificación y límites

- `prepareFestivalSet` acepta la corrección de Berlín completa, con 21 filas,
  enlace a la versión anterior y hash idéntico al prepararla de nuevo.
- Se compararon las 52 tuplas actuales con fuentes primarias. La consulta REST
  queda en `berlin-locarno-awards-before.json`, sin secretos ni cuerpo HTML.
- El suplemento de cobertura mantiene sus cantidades. Este archivo adicional
  aporta una versión correctora de Berlín, no aumenta su cobertura de 21
  premios. Locarno mantiene 31.
- Esta revisión verifica la calidad de los premios ya publicados; no certifica
  que Runscars recopile todas las selecciones y premios paralelos del circuito.
  La selección de Locarno sigue declarada parcial.
- No se realizaron escrituras externas, importaciones productivas ni cambios
  sobre archivos de festivales propiedad del otro agente.
