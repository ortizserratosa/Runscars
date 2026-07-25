import { normalizeIdentity, sha256 } from "./core.mjs";

const API = "https://api.themoviedb.org/3";
const RELEVANT_JOBS = new Set([
  "Director",
  "Writer",
  "Screenplay",
  "Story",
  "Novel",
  "Director of Photography",
  "Original Music Composer",
]);

function slug(value) {
  return normalizeIdentity(value)
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nullableDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value : null;
}

function nullableText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function tmdb(pathname, token, fetcher, parameters = {}) {
  const url = new URL(`${API}${pathname}`);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetcher(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`TMDB respondió ${response.status} en ${url.pathname}`);
  }
  return response.json();
}

function credits(raw) {
  const cast = (raw.credits?.cast ?? []).slice(0, 30).map((credit) => ({
    tmdbPersonId: credit.id,
    name: credit.name,
    tmdbCreditId: credit.credit_id,
    kind: "cast",
    role: nullableText(credit.character) ?? "Reparto",
    department: "Acting",
    billingOrder: Number.isInteger(credit.order) ? credit.order : null,
  }));
  const crew = (raw.credits?.crew ?? [])
    .filter((credit) => RELEVANT_JOBS.has(credit.job))
    .slice(0, 30)
    .map((credit) => ({
      tmdbPersonId: credit.id,
      name: credit.name,
      tmdbCreditId: credit.credit_id,
      kind: "crew",
      role: credit.job,
      department: nullableText(credit.department),
      billingOrder: null,
    }));
  return [...cast, ...crew].filter(
    (credit) =>
      Number.isInteger(credit.tmdbPersonId) &&
      credit.tmdbPersonId > 0 &&
      nullableText(credit.name) &&
      nullableText(credit.tmdbCreditId),
  );
}

export async function expandCatalogFromBatch({
  batch,
  repository,
  token,
  fetcher = fetch,
}) {
  if (!token) return { imported: [], ambiguous: [] };
  const season = await repository.seasonIdentity(batch.seasonId);
  const current = await repository.filmIdentities(batch.seasonId);
  const missingTitles = [
    ...new Set(
      batch.publications.flatMap((publication) =>
        publication.observations.flatMap((observation) => {
          const title = observation.filmSubject ?? observation.subject;
          if (
            observation.filmId ||
            observation.workTitle ||
            typeof title !== "string" ||
            !title.trim()
          ) {
            return [];
          }
          const exists = current.some((film) =>
            [film.title, ...(film.alternate_titles ?? [])].some(
              (candidate) =>
                normalizeIdentity(candidate) === normalizeIdentity(title),
            ),
          );
          return exists ? [] : [title.trim()];
        }),
      ),
    ),
  ];
  const imported = [];
  const ambiguous = [];

  for (const title of missingTitles) {
    try {
      const search = await tmdb("/search/movie", token, fetcher, {
        query: title,
        primary_release_year: season.eligibilityYear,
        include_adult: false,
        language: "en-US",
      });
      const normalized = normalizeIdentity(title);
      const exact = (search.results ?? []).filter((result) => {
        const resultYear = nullableDate(result.release_date)?.slice(0, 4);
        return (
          [result.title, result.original_title]
            .filter(Boolean)
            .some((candidate) => normalizeIdentity(candidate) === normalized) &&
          resultYear === String(season.eligibilityYear)
        );
      });
      if (exact.length !== 1) {
        ambiguous.push({ title, tmdbIds: exact.map((result) => result.id) });
        continue;
      }
      const raw = await tmdb(`/movie/${exact[0].id}`, token, fetcher, {
        append_to_response: "credits,external_ids",
        language: "en-US",
      });
      const fetchedAt = new Date();
      const fetchedAtIso = fetchedAt.toISOString();
      const originalData = {
        ...raw,
        automatic_match: {
          query: title,
          eligibility_year: season.eligibilityYear,
          unique_exact_match: true,
        },
      };
      const filmId = await repository.saveAutomaticTmdbFilm({
        filmIdBase: slug(raw.title),
        seasonId: batch.seasonId,
        eligibilityYear: season.eligibilityYear,
        raw,
        credits: credits(raw),
        snapshot: {
          tmdb_id: raw.id,
          locale: "en-US",
          content_hash: await sha256(originalData),
          title: raw.title,
          original_title: raw.original_title,
          original_language: nullableText(raw.original_language),
          overview: nullableText(raw.overview),
          release_date: nullableDate(raw.release_date),
          runtime: Number.isInteger(raw.runtime) ? raw.runtime : null,
          status: nullableText(raw.status),
          tagline: nullableText(raw.tagline),
          imdb_id: nullableText(raw.external_ids?.imdb_id ?? raw.imdb_id),
          poster_path: nullableText(raw.poster_path),
          backdrop_path: nullableText(raw.backdrop_path),
          genres: raw.genres ?? [],
          original_data: originalData,
          source_url: `${API}/movie/${raw.id}`,
          fetched_at: fetchedAtIso,
          expires_at: new Date(
            fetchedAt.getTime() + 180 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
        query: title,
      });
      imported.push({ title, filmId, tmdbId: raw.id });
    } catch (error) {
      ambiguous.push({
        title,
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
  return { imported, ambiguous };
}
