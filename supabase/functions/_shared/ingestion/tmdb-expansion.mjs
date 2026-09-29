import { normalizeIdentity, sha256 } from "./core.mjs";
import { fetchResponse } from "../network.mjs";

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

async function tmdb(pathname, token, fetcher, parameters = {}, deadline) {
  if (Date.now() >= deadline) {
    throw new Error(
      "Se agotó el presupuesto de expansión TMDB de esta ejecución",
    );
  }
  const url = new URL(`${API}${pathname}`);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetchResponse(
    url,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
    fetcher,
    { timeoutMs: 15_000, maxRetryDelayMs: 1_000 },
  );
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

/** Recover only identity evidence already corroborated and captured by us. */
export function verifiedAutomaticCredits(snapshot, film) {
  const raw = snapshot?.original_data;
  const match = raw?.automatic_match;
  if (
    !raw ||
    raw.id !== film.tmdb_id ||
    match?.match_rule !== "unique-title-year-and-credits-v1" ||
    match.unique_exact_match !== true ||
    match.eligibility_year !== film.eligibility_year ||
    nullableDate(raw.release_date)?.slice(0, 4) !==
      String(film.eligibility_year) ||
    !Array.isArray(match.people_evidence) ||
    match.people_evidence.length === 0
  ) {
    return null;
  }
  const filmTitles = [film.title, ...(film.alternate_titles ?? [])];
  if (
    ![raw.title, raw.original_title].some(
      (title) =>
        typeof title === "string" &&
        title.trim() &&
        filmTitles.some(
          (candidate) =>
            normalizeIdentity(candidate) === normalizeIdentity(title),
        ),
    )
  ) {
    return null;
  }
  const movieCredits = credits(raw);
  if (
    match.people_evidence.some(
      (evidence) =>
        typeof evidence?.source_name !== "string" ||
        !evidence.source_name.trim() ||
        !movieCredits.some(
          (credit) =>
            credit.tmdbPersonId === evidence.tmdb_person_id &&
            normalizeIdentity(credit.name) ===
              normalizeIdentity(evidence.source_name) &&
            (evidence.role === "Acting"
              ? credit.kind === "cast"
              : evidence.role === "Director" &&
                credit.kind === "crew" &&
                credit.role === "Director"),
        ),
    )
  ) {
    return null;
  }
  return movieCredits;
}

function identityClaims(batch, title) {
  const normalizedTitle = normalizeIdentity(title);
  const claims = new Map();
  for (const publication of batch.publications) {
    for (const observation of publication.observations) {
      if (
        normalizeIdentity(observation.filmSubject ?? observation.subject) !==
          normalizedTitle ||
        !["prediction_ordered", "prediction_selection"].includes(
          observation.dataType,
        )
      )
        continue;
      const categoryId = observation.categoryId;
      const role =
        categoryId === "directing"
          ? "Director"
          : [
                "actor",
                "actress",
                "supporting-actor",
                "supporting-actress",
              ].includes(categoryId)
            ? "Acting"
            : null;
      if (!role) continue;
      for (const name of observation.peopleSubjects ?? []) {
        if (typeof name !== "string" || !name.trim()) continue;
        claims.set(`${role}:${normalizeIdentity(name)}`, {
          name: name.trim(),
          role,
          categoryId,
        });
      }
    }
  }
  return [...claims.values()];
}

function corroborateIdentity(claims, movieCredits) {
  if (!claims.length) return null;
  const evidence = [];
  for (const claim of claims) {
    const matches = movieCredits.filter(
      (credit) =>
        normalizeIdentity(credit.name) === normalizeIdentity(claim.name) &&
        (claim.role === "Acting"
          ? credit.kind === "cast"
          : credit.kind === "crew" && credit.role === "Director"),
    );
    const ids = [...new Set(matches.map((credit) => credit.tmdbPersonId))];
    if (ids.length !== 1) return null;
    evidence.push({
      source_name: claim.name,
      category_id: claim.categoryId,
      tmdb_person_id: ids[0],
      role: claim.role,
    });
  }
  return evidence;
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
  const imported = [];
  const ambiguous = [];
  // A terminated worker can leave an approved film linked before its credits.
  // Resume from durable proof before existing titles are skipped below.
  const observedTitles = new Set(
    batch.publications.flatMap((publication) =>
      publication.observations.flatMap((observation) => {
        const title = observation.filmSubject ?? observation.subject;
        return typeof title === "string" && title.trim()
          ? [normalizeIdentity(title)]
          : [];
      }),
    ),
  );
  for (const film of current) {
    if (
      film.credits?.length !== 0 ||
      ![film.title, ...(film.alternate_titles ?? [])].some((title) =>
        observedTitles.has(normalizeIdentity(title)),
      )
    ) {
      continue;
    }
    try {
      const resumed = await repository.resumeAutomaticTmdbFilm?.(film.id);
      if (resumed) {
        imported.push({
          title: film.title,
          filmId: film.id,
          tmdbId: resumed.tmdbId,
          resumed: true,
        });
      }
    } catch (error) {
      ambiguous.push({
        title: film.title,
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
  const seenTitles = new Set();
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
          const normalizedTitle = normalizeIdentity(title);
          if (exists || seenTitles.has(normalizedTitle)) return [];
          seenTitles.add(normalizedTitle);
          return [title.trim()];
        }),
      ),
    ),
  ];
  // Leave enough headroom for a final bounded request and for persistence in Edge.
  const deadline = Date.now() + 60_000;

  for (const title of missingTitles) {
    const claims = identityClaims(batch, title);
    if (!claims.length) {
      ambiguous.push({
        title,
        tmdbIds: [],
        reason: "missing_person_identity_evidence",
        expectedPeople: [],
      });
      continue;
    }
    try {
      const search = await tmdb(
        "/search/movie",
        token,
        fetcher,
        {
          query: title,
          primary_release_year: season.eligibilityYear,
          include_adult: false,
          language: "en-US",
        },
        deadline,
      );
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
      const raw = await tmdb(
        `/movie/${exact[0].id}`,
        token,
        fetcher,
        {
          append_to_response: "credits,external_ids",
          language: "en-US",
        },
        deadline,
      );
      const movieCredits = credits(raw);
      const evidence = corroborateIdentity(claims, movieCredits);
      if (
        raw.id !== exact[0].id ||
        nullableDate(raw.release_date)?.slice(0, 4) !==
          String(season.eligibilityYear) ||
        ![raw.title, raw.original_title]
          .filter(Boolean)
          .some((candidate) => normalizeIdentity(candidate) === normalized) ||
        !evidence
      ) {
        ambiguous.push({
          title,
          tmdbIds: [exact[0].id],
          reason: claims.length
            ? "prediction_credits_not_corroborated"
            : "missing_person_identity_evidence",
          expectedPeople: claims.map((claim) => ({
            name: claim.name,
            role: claim.role,
          })),
        });
        continue;
      }
      const fetchedAt = new Date();
      const fetchedAtIso = fetchedAt.toISOString();
      const originalData = {
        ...raw,
        automatic_match: {
          query: title,
          eligibility_year: season.eligibilityYear,
          unique_exact_match: true,
          match_rule: "unique-title-year-and-credits-v1",
          people_evidence: evidence,
        },
      };
      const filmId = await repository.saveAutomaticTmdbFilm({
        filmIdBase: slug(raw.title),
        seasonId: batch.seasonId,
        eligibilityYear: season.eligibilityYear,
        raw,
        credits: movieCredits,
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
