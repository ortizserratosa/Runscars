import { sha256 } from "./core.mjs";

export async function prepareFestivalMovieMetadata(
  rawMovie,
  locale,
  capturedAt,
  buildSnapshot,
) {
  const prepared = buildSnapshot(rawMovie, {
    locale,
    fetchedAt: new Date(capturedAt),
  });
  prepared.snapshot.original_data.directors = (rawMovie.credits?.crew ?? [])
    .filter((credit) => credit.job === "Director")
    .map(({ id, name, original_name }) => ({
      id,
      name,
      original_name: original_name ?? null,
    }));
  prepared.snapshot.content_hash = await sha256(
    prepared.snapshot.original_data,
  );
  return { identity: prepared.identity, snapshot: prepared.snapshot };
}

export async function refreshFestivalMovieMetadata({
  repository,
  client,
  buildSnapshot,
  limit = 50,
  afterTmdbId = 0,
  concurrency = 4,
  apply = false,
  locales = ["es-ES", "en-US"],
  now = () => new Date(),
}) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    !Number.isSafeInteger(afterTmdbId) ||
    afterTmdbId < 0 ||
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 6 ||
    locales.some((locale) => !["es-ES", "en-US"].includes(locale))
  )
    throw new Error(
      "Lote de metadatos inválido: limit1–50/concurrency1–6/cursorTMDB/localesES-EN",
    );
  const remaining = (await repository.confirmedMovieIds()).filter(
    (id) => id > afterTmdbId,
  );
  const ids = remaining.slice(0, limit);
  const results = Array(ids.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
      while (cursor < ids.length) {
        const index = cursor++;
        const tmdbId = ids[index];
        const captures = [];
        for (const locale of locales) {
          try {
            if (!apply) {
              captures.push({ locale, status: "planned" });
              continue;
            }
            const rawMovie = await client.fetchMovie(tmdbId, locale);
            if (rawMovie.id !== tmdbId)
              throw new Error(
                "TMDB devolvió otro ID; se conserva la captura previa",
              );
            const prepared = await prepareFestivalMovieMetadata(
              rawMovie,
              locale,
              now().toISOString(),
              buildSnapshot,
            );
            const persisted = await repository.saveMetadata(prepared);
            captures.push({
              locale,
              status: persisted.status,
              hasPoster: prepared.snapshot.poster_path !== null,
            });
          } catch (error) {
            captures.push({
              locale,
              status: "failed",
              error:
                error instanceof Error ? error.message : "Fallo desconocido",
            });
          }
        }
        results[index] = { tmdbId, captures };
      }
    }),
  );
  return {
    apply,
    processed: ids.length,
    afterTmdbId,
    nextTmdbId: ids.at(-1) ?? afterTmdbId,
    hasMore: remaining.length > ids.length,
    failed: results.reduce(
      (count, result) =>
        count +
        result.captures.filter((capture) => capture.status === "failed").length,
      0,
    ),
    results,
  };
}
