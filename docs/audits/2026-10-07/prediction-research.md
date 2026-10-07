# Auditoría de orden y cobertura — 2026-10-07

## Variety: evidencia pública actual

Discovery: https://variety.com/lists/2027-oscars-predictions/
Autor verificado: Clayton Davis. La fecha editorial del ranking es el texto original `Updated Oct. 1, 2026` de cada CSV (guardado), no la fecha de creación CMS del artículo. Captura HTTPS normal con User-Agent Runscars/0.1, sin cookies, login, credenciales ni bypass. Los embeds antiguos sirven un meta-refresh público al mismo chartId y nueva versión; se conserva ambas URL. La tabla de película está en el JSON público de la galería, no en el DOM inicial. El JSON se decodifica, nunca se ejecuta.

| Categoría | Ranks explícitos | Match de solo lectura | Artículo | Tabla pública vigente |
|---|---:|---:|---|---|
| best-picture | 40 | 38/40 | https://variety.com/lists/2027-oscars-best-picture-predictions/ | https://datawrapper.dwcdn.net/BBZ0P/17/ |
| directing | 30 | 30/30 | https://variety.com/feature/2027-oscars-best-director-predictions-1236834268/ | https://datawrapper.dwcdn.net/S4RKf/11/ |
| actor | 30 | 27/30 | https://variety.com/feature/2027-oscars-best-actor-predictions-1236834269/ | https://datawrapper.dwcdn.net/lD84Y/11/ |
| actress | 30 | 22/30 | https://variety.com/feature/2027-oscars-best-actress-predictions-1236834270/ | https://datawrapper.dwcdn.net/AHT1t/10/ |
| supporting-actor | 30 | 29/30 | https://variety.com/feature/2027-oscars-best-supporting-actor-predictions-1236834271/ | https://datawrapper.dwcdn.net/0OeM9/10/ |
| supporting-actress | 30 | 26/30 | https://variety.com/feature/2027-oscars-best-supporting-actress-predictions-1236834272/ | https://datawrapper.dwcdn.net/Wczo3/13/ |
| adapted-screenplay | 30 | 22/30 | https://variety.com/feature/2027-oscars-best-adapted-screenplay-predictions-1236834275/ | https://datawrapper.dwcdn.net/ajt7v/11/ |
| original-screenplay | 30 | 23/30 | https://variety.com/feature/2027-oscars-best-original-screenplay-predictions-1236834273/ | https://datawrapper.dwcdn.net/a5kl2/12/ |

Las 250 observaciones conservan columnas/valores originales, tier, rank y longitud original. La posición 7 de supporting-actress contiene `[REDACTED]` y se queda pendiente; no se inventa una persona ni se elimina el rango. Las filas numeradas NEXT IN LINE / OTHER TOP-TIER CONTENDERS / ALSO IN CONTENTION pertenecen al orden explícito continuo. El catálogo ELIGIBLE sin rank no participa.

Matching sobre 86 identidades productivas (solo SELECT): 217 coincidencias; 33 pendientes por catálogo o créditos ausentes y el nombre oculto. La normalización ya verificada `The Further Mis-Adventures of Cliff Booth` → `The Adventures of Cliff Booth` conserva el título original en raw y evita seis falsas pendientes. Ingestion valida la lista completa antes del matching; el snapshot acepta huecos del subconjunto publicado conservando L original según ordered-list v2.

Ocho conectores tienen source_id=variety, required_category_ids=[su categoría]; un fallo de tabla no bloquea las siete restantes y no elimina la última captura válida. El consenso sigue sumando una voz Variety por categoría.

## AwardsWatch / Awards Daily: comprobación y correcciones

- AwardsWatch original de septiembre, actor/actriz: https://awardswatch.com/2027-oscar-predictions-best-actor-and-best-actress-september/ . Navegador original inspeccionado: cuatro columnas de autores, cinco filas y NEXT sin numeración ni declaración de orden total. Acting/screenplays siguen como selections. La tabla numérica de picture/directing sigue ranked; no convertir filas en votos Borda arbitrarios.
- AwardsWatch `*Guitarricadelafuente` ya estaba publicado por matching editorial en producción. La corrección v7 separa ese asterisco de la identidad al extraer, conserva raw intacto y previene nuevas pendientes. No atribuirle recuperación de cobertura actual.
- Awards Daily última publicación Oct2: discovery https://www.awardsdaily.com/wp-json/wp/v2/search?search=2027%20Oscar%20Predictions&per_page=20&_fields=id,url,title,subtype . Su bloque actual usa nombres sin numéricos/ol: selections correcto. v9 conserva marcadores HTML ol/start/li[value] cuando existan, cualquier categoría después de bloque explícito Predictions (sin exigir Best Picture), y ranking numerado completo más allá de diez posiciones.
- Smoke HTTPS live final: AwardsWatch v7 ocho publicaciones/55 observaciones; AwardsDaily v9 una publicación/80 observaciones; required 8 categorías y validación de rankings correctas.
- Baseline de exclusiones entregado por root: 86 entradas en ocho snapshots: 83 Midnight Critics July25 y 3 Ringer March20, fuera de frescura D059. No hubo exclusión indebida actual por categorías configuradas; 5 fuentes de cobertura en las8, 4 ranked picture/directing y3 ranked las6 restantes. Variety aporta una nueva voz ranked a las8.

## Verificación

- Unit pertinentes: 83/83 (ingestion, prediction-order, Variety). Incluyen 8 capturas reales reducidas, CSV RFC multiline/quotes, rechazo de gaps/procedencia/fecha futura, conservar [REDACTED] pendiente con rank7/L30, y fallo aislado1 categoría→7 éxitos.
- DB migration:23/23 con base vacía, seed40 sources/20 connectors, ocho Variety con required individual y migration idempotente.
- Lint, TypeScript y git diff --check correctos.
- Smoke HTTPS actual:8/8 Variety, 40+7×30=250 filas, y AW/AD revisados. No se realizó ninguna escritura producción.

## Archivos

- supabase/functions/_shared/ingestion/variety.mjs
- supabase/functions/_shared/ingestion/professional-predictions.mjs
- supabase/functions/_shared/ingestion/connectors.mjs
- supabase/migrations/20261007100000_prediction_order_and_variety.sql
- web/tests/fixtures/variety-2026-10-01.json
- web/tests/unit/variety.test.ts
- web/tests/unit/prediction-order.test.ts
- web/tests/unit/ingestion.test.ts
- web/tests/database/migration.test.ts
- web/scripts/audit-production.mjs

Riesgo pendiente real: las 33 coincidencias dudosas se quedan en revisión. El import productivo puede resolver parte al ampliar automáticamente TMDB con reglas exactas, pero `[REDACTED]` debe continuar pendiente. Un cambio editorial de autor, columnas, intención o numeración requiere revisión; su conector falla conservando el último dato válido.
