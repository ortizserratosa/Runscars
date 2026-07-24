# Dataset inicial verificable · fase 1

**Temporada:** Oscar 2027 · elegibilidad 2026

**Captura:** 2026-07-24T11:17:17+02:00–2026-07-24T11:34:10+02:00

**Finalidad:** fixture editorial reproducible para el futuro prototipo; no es un
snapshot público ni una predicción de Runscars.

## Contenido

- `films.csv`: 20 películas observadas en fuentes editoriales de la temporada.
- `observations.csv`: valores originales con publicación, URL, autor, fecha,
  captura y reglas de participación.
- `checksums.sha256`: huellas para comprobar que el corte no ha cambiado.

El segundo corte de fase 1 añadió ocho reseñas verificadas de fuentes admitidas
en la revisión de calidad. No alteró películas, rankings ni valores previos.

## Convenciones

- `season_id` es `oscars-2027` y el periodo de elegibilidad es 2026.
- Un título provisional se conserva en `alternate_title`; la entidad no cambia
  cuando cambia el título mostrado.
- `prediction_ordered` participa en Borda; `prediction_selection` solo en
  cobertura.
- `score_individual` es una puntuación de una reseña identificable y puede
  normalizarse a 5.
- `score_aggregate` conserva agregados de terceros como contexto, pero
  `participates_in_aggregate=false` evita contarlos como críticos individuales.
- `review` acredita la existencia de una reseña y enlaza su pieza canónica. El
  fixture no copia el cuerpo ni extractos.
- Un campo vacío significa “no consta en la muestra”, nunca una estimación.

## Alcance y límites

Las listas de Best Picture se transcribieron tal como estaban publicadas en el
corte. Next Best Picture representa el orden del consenso de su equipo, no 17
votos separados. El bloque “On the Radar” de AwardsWatch se guarda como
selección no ordenada: sus números editoriales no se interpretan como ranking
comparable.

Rotten Tomatoes y Metacritic cambian con nuevas reseñas. Sus valores incluyen el
momento de captura y no deben actualizarse sobrescribiendo estas filas. Las
películas sin fecha de estreno confirmada en las fuentes usadas conservan el
campo vacío; el dataset prueba observaciones, no completa un catálogo TMDB.

## Uso futuro

El fixture permite construir sin red:

1. una lista de 20 películas;
2. cuatro rankings comparables y una selección no ordenada;
3. puntuaciones originales y normalizadas;
4. catorce enlaces de reseña con autoría;
5. avisos de dato contextual o insuficiente.

No se incluyeron usuarios, resultados oficiales ni componentes visuales porque
quedan fuera de la fase 1.
