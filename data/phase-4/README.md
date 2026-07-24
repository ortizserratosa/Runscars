# Dataset inicial TMDB · fase 4

**Revisión:** 2026-07-24
**Cobertura:** 20 de 20 películas del fixture de fase 1

`tmdb-matches.json` es el registro editorial reproducible de los
emparejamientos iniciales. Conserva el identificador interno, la consulta usada,
el ID de TMDB, el motivo de aceptación y un enlace de comprobación. No contiene
credenciales ni una copia de la respuesta de la API.

## Criterio de revisión

Cada coincidencia se comprobó por título original o alternativo y al menos otra
señal disponible: año de estreno, dirección, reparto, franquicia o identificador
IMDb. Los homónimos no se resolvieron solo por posición en los resultados.

Los dos casos que exigieron una consulta alternativa fueron:

- `all-of-a-sudden`: se localizó por `Soudain All of a Sudden` y se verificó
  con el título japonés, Ryusuke Hamaguchi y el estreno de 2026;
- `saturn-return`: todavía no tenía fecha en TMDB, por lo que se verificó con
  Greg Kwedar, reparto e IMDb.

## Uso

La búsqueda no escribe en la base:

```bash
npm run tmdb:search -- "The Odyssey" --year 2026
```

La importación lee este manifiesto, obtiene solo los campos necesarios de
película, persona y créditos, y guarda snapshots idempotentes:

```bash
npm run tmdb:import
```

Una corrección explícita requiere un motivo y conserva el ID anterior:

```bash
npm run tmdb:match -- <film-id> <tmdb-id> --reason "<motivo>"
```

La respuesta original reducida se guarda en PostgreSQL con URL, locale, fecha de
captura, hash y caducidad. No se versiona en Git y debe refrescarse antes de seis
meses.
