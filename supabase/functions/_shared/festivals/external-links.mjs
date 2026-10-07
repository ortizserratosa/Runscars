import { sha256 } from "./core.mjs";
import { normalizeIdentity } from "../ingestion/core.mjs";
const normalizeFestivalTitle = (value) =>
  typeof value === "string" && value.trim() ? normalizeIdentity(value) : "";

const IMDb_PATTERN = /^tt\d{7,10}$/;
const normalizeName = (name) =>
  normalizeFestivalTitle(name).replaceAll(" ", "");
const unique = (values) => [...new Set(values.filter(Boolean))];
const names = (value) =>
  Array.isArray(value)
    ? value.flatMap(names)
    : String(value ?? "")
        .split(/\s+(?:and|&)\s+|[,;|]/i)
        .map((name) => name.trim())
        .filter(Boolean);
const titles = (value) =>
  Array.isArray(value)
    ? value.flatMap(titles)
    : String(value ?? "")
        .split(/\s*[|/]\s*/)
        .map((title) => title.trim())
        .filter(Boolean);

export function festivalIdentityClaim(entry, reviewedEvidence = []) {
  const data = entry.originalData ?? {};
  const officialTitles = unique([
    entry.originalTitle,
    ...titles(data.alternateTitles),
    ...titles(entry.originalTitle),
  ]);
  const reviewed = reviewedEvidence.filter(
    (fact) =>
      fact.editionId === entry.editionId &&
      fact.officialTitles?.some((title) =>
        officialTitles.some(
          (candidate) =>
            normalizeFestivalTitle(title) &&
            normalizeFestivalTitle(title) === normalizeFestivalTitle(candidate),
        ),
      ),
  );
  const creditDirector = String(data.creditLine ?? "").match(
    /Directors?(?:\s+and\s+Screenwriters?)?\s*:\s*(.+?)(?=,?\s+(?:Producers?|Screenwriters?|Cast|Country)\s*:|$)/i,
  )?.[1];
  const explicitDirectors =
    data.Directors ?? data.directors ?? data.director ?? creditDirector;
  // These selection adapters preserve the explicitly labelled director column/credit.
  const reviewedSelectionRecipient =
    entry.kind === "selection" &&
    /^(sundance|berlinale|cannes|venice|tiff|nyff|telluride|san-sebastian)-/.test(
      entry.editionId,
    )
      ? entry.originalRecipient
      : null;
  const directors = unique(
    names(
      reviewed.length === 1
        ? reviewed[0].directors
        : (explicitDirectors ?? reviewedSelectionRecipient),
    ),
  );
  const productionYear =
    Number(
      data.productionYear ??
        String(data.countryAndYear ?? "").match(/\b((?:19|20)\d{2})\s*$/)?.[1],
    ) || null;
  const releaseYear =
    Number(
      data.releaseYear ??
        String(data.sourceDisplayName ?? "").match(
          /\(((?:19|20)\d{2})\)\s*$/,
        )?.[1],
    ) || null;
  return {
    officialTitles:
      reviewed.length === 1
        ? unique([...officialTitles, ...reviewed[0].officialTitles])
        : officialTitles,
    directors,
    productionYear:
      productionYear >= 1880 && productionYear <= 2200 ? productionYear : null,
    releaseYear:
      releaseYear >= 1880 && releaseYear <= 2200 ? releaseYear : null,
    evidenceSourceUrl:
      reviewed.length === 1 ? reviewed[0].sourceUrl : entry.originalSourceUrl,
    evidenceCapturedAt:
      reviewed.length === 1 ? reviewed[0].capturedAt : entry.originalCapturedAt,
    evidenceKind:
      reviewed.length === 1
        ? reviewed[0].identityEvidenceKind
        : "festival-source-film-credit",
    sourcePage: reviewed.length === 1 ? (reviewed[0].sourcePage ?? null) : null,
  };
}

export function corroborateFestivalMovie(movie, claim) {
  const movieTitles = unique([
    movie.title,
    movie.original_title,
    ...(movie.alternative_titles?.titles ?? []).map((item) => item.title),
  ]);
  const matchedTitle = claim.officialTitles.find((title) =>
    movieTitles.some(
      (candidate) =>
        normalizeFestivalTitle(title) &&
        normalizeFestivalTitle(title) === normalizeFestivalTitle(candidate),
    ),
  );
  const crew = Array.isArray(movie.credits)
    ? movie.credits.filter(
        (item) => item.kind === "crew" && item.role === "Director",
      )
    : (movie.credits?.crew ?? []).filter((item) => item.job === "Director");
  const directors = unique(
    crew.flatMap((item) => [item.name, item.original_name]),
  );
  const exactDirectors =
    claim.directors.length > 0 &&
    claim.directors.every((name) =>
      directors.some(
        (candidate) =>
          normalizeName(name) &&
          normalizeName(name) === normalizeName(candidate),
      ),
    );
  const providerYear =
    Number(String(movie.release_date ?? "").slice(0, 4)) || null;
  const exactYear =
    (claim.releaseYear ?? claim.productionYear) != null &&
    providerYear === (claim.releaseYear ?? claim.productionYear);
  const conflictingYear =
    (claim.releaseYear != null && providerYear !== claim.releaseYear) ||
    (claim.productionYear != null &&
      providerYear != null &&
      providerYear < claim.productionYear);
  const imdbId = movie.external_ids?.imdb_id ?? movie.imdb_id;
  if (
    !matchedTitle ||
    !exactDirectors ||
    conflictingYear ||
    !Number.isSafeInteger(movie.id) ||
    movie.id < 1
  )
    return null;
  return {
    tmdbId: movie.id,
    imdbId,
    evidence: {
      claim,
      matchedTitle,
      matchedDirectors: claim.directors,
      providerTitles: movieTitles,
      providerDirectors: directors,
      providerReleaseDate: movie.release_date ?? null,
      sourceYearMatchesReleaseYear: exactYear,
    },
    originalData: {
      id: movie.id,
      title: movie.title,
      original_title: movie.original_title,
      release_date: movie.release_date ?? null,
      imdb_id: imdbId,
      directors,
    },
  };
}

export class FestivalTmdbResolver {
  constructor({
    token,
    fetcher = fetch,
    now = () => new Date(),
    cachedMovies = [],
    maxPages = 5,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }) {
    if (!token) throw new Error("Falta TMDB_READ_ACCESS_TOKEN");
    this.token = token;
    this.fetcher = fetcher;
    this.now = now;
    this.sleep = sleep;
    this.maxPages = maxPages;
    this.identities = new Map();
    this.movies = new Map(
      cachedMovies.map((movie) => [
        movie.originalData.id,
        Promise.resolve({
          movie: movie.originalData,
          sourceUrl: movie.sourceUrl,
          capturedAt: movie.capturedAt,
        }),
      ]),
    );
  }

  async request(url) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(url, {
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
        },
      });
      if (response.status === 429 && attempt < 3) {
        await this.sleep(
          Math.min(
            10000,
            Math.max(
              1000,
              Number(response.headers.get("retry-after")) * 1000 ||
                1000 * (attempt + 1),
            ),
          ),
        );
        continue;
      }
      if (!response.ok)
        throw new Error(`TMDB respondió HTTP ${response.status}`);
      return response.json();
    }
    throw new Error("TMDB agotó los reintentos");
  }

  async movie(id) {
    if (!this.movies.has(id)) {
      const sourceUrl = `https://api.themoviedb.org/3/movie/${id}?append_to_response=credits,external_ids,alternative_titles&language=en-US`;
      const pending = this.request(sourceUrl).then((movie) => ({
        movie,
        sourceUrl,
        capturedAt: this.now().toISOString(),
      }));
      this.movies.set(id, pending);
      pending.catch(() => this.movies.delete(id));
    }
    return this.movies.get(id);
  }

  resolve(claim) {
    const key = JSON.stringify({
      titles: claim.officialTitles.map(normalizeFestivalTitle).sort(),
      directors: claim.directors.map(normalizeName).sort(),
      year: claim.productionYear,
      releaseYear: claim.releaseYear,
    });
    if (!this.identities.has(key)) {
      const pending = this.resolveUncached(claim);
      this.identities.set(key, pending);
      pending.catch(() => this.identities.delete(key));
    }
    return this.identities.get(key);
  }

  async resolveUncached(claim) {
    if (!claim.directors.length)
      return {
        status: "pending_review",
        reason: "missing-explicit-director",
        candidates: [],
      };
    const candidateIds = new Set();
    for (const title of claim.officialTitles) {
      for (let page = 1; ; page += 1) {
        const url = new URL("https://api.themoviedb.org/3/search/movie");
        url.searchParams.set("query", title);
        url.searchParams.set("language", "en-US");
        url.searchParams.set("page", String(page));
        // Production year can differ from release year: search the complete title pool.

        const result = await this.request(url.href);
        if (
          !Number.isInteger(result.total_pages) ||
          result.total_pages > this.maxPages
        )
          return {
            status: "pending_review",
            reason: "incomplete-search-too-many-pages",
            candidates: [],
          };
        for (const item of result.results ?? [])
          if (Number.isSafeInteger(item.id) && item.id > 0)
            candidateIds.add(item.id);
        if (page >= result.total_pages) break;
      }
    }
    const verified = [];
    for (const id of candidateIds) {
      const details = await this.movie(id);
      const corroborated = corroborateFestivalMovie(details.movie, claim);
      if (corroborated)
        verified.push({
          ...corroborated,
          sourceUrl: details.sourceUrl,
          capturedAt: details.capturedAt,
        });
    }
    if (verified.length !== 1)
      return {
        status: verified.length ? "pending_review" : "unmatched",
        reason: verified.length
          ? "ambiguous-exact-title-director"
          : "no-corroborated-imdb-identity",
        candidates: verified.map(({ tmdbId, imdbId }) => ({ tmdbId, imdbId })),
      };
    if (!IMDb_PATTERN.test(verified[0].imdbId ?? ""))
      return {
        status: "pending_review",
        reason: "unique-identity-without-valid-imdb-id",
        candidates: verified.map(({ tmdbId, imdbId }) => ({ tmdbId, imdbId })),
      };
    return {
      status: "confirmed",
      method: "exact-source-title-director-tmdb-external-ids",
      ...verified[0],
    };
  }
}

export async function enrichFestivalLinks({
  repository,
  resolver,
  limit = 25,
  afterEntryId = 0,
  apply = false,
  reviewedEvidence = [],
  now = () => new Date(),
}) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    !Number.isSafeInteger(afterEntryId) ||
    afterEntryId < 0
  )
    throw new Error(
      "Lote inválido: limit debe ser 1–50 y afterEntryId un entero positivo o cero",
    );
  const allEntries = await repository.currentEntries();
  const selectionClaims = new Map();
  for (const entry of allEntries.filter((item) => item.kind === "selection")) {
    const claim = festivalIdentityClaim(entry, reviewedEvidence);
    if (!claim.directors.length) continue;
    for (const title of claim.officialTitles) {
      const key = `${entry.editionId}:${normalizeFestivalTitle(title)}`;
      const list = selectionClaims.get(key) ?? [];
      list.push(claim);
      selectionClaims.set(key, list);
    }
  }
  const remaining = allEntries
    .filter((entry) => entry.entryId > afterEntryId)
    .sort((a, b) => a.entryId - b.entryId);
  const entries = remaining.slice(0, limit);
  const results = [];
  for (const entry of entries) {
    try {
      let claim = festivalIdentityClaim(entry, reviewedEvidence);
      if (!claim.directors.length && entry.kind === "awards") {
        const inherited =
          selectionClaims.get(
            `${entry.editionId}:${normalizeFestivalTitle(entry.originalTitle)}`,
          ) ?? [];
        const distinct = new Map(
          inherited.map((item) => [
            JSON.stringify({
              titles: item.officialTitles,
              directors: item.directors,
              year: item.productionYear,
              releaseYear: item.releaseYear,
            }),
            item,
          ]),
        );
        if (distinct.size === 1)
          claim = {
            ...distinct.values().next().value,
            evidenceKind: "same-edition-exact-title-selection-director",
          };
      }
      const resolved = await resolver.resolve(claim);
      // A cached provider result must retain this entry's own original receipt and claim.
      const evidence =
        resolved.status === "confirmed"
          ? { ...resolved.evidence, claim }
          : { claim, candidates: resolved.candidates, reason: resolved.reason };
      const payload = {
        entryId: entry.entryId,
        status: resolved.status,
        tmdbId: resolved.tmdbId ?? null,
        imdbId: resolved.imdbId ?? null,
        sourceUrl: resolved.sourceUrl ?? claim.evidenceSourceUrl,
        originalSourceUrl: entry.originalSourceUrl,
        capturedAt: resolved.capturedAt ?? now().toISOString(),
        method: resolved.method ?? resolved.reason,
        evidence,
        originalData: resolved.originalData ?? {},
      };
      payload.contentHash = await sha256({ ...payload, capturedAt: undefined });
      const persisted = apply ? await repository.persist(payload) : null;
      results.push({
        entryId: entry.entryId,
        originalTitle: entry.originalTitle,
        ...resolved,
        evidence: undefined,
        originalData: undefined,
        persisted,
      });
    } catch (error) {
      results.push({
        entryId: entry.entryId,
        originalTitle: entry.originalTitle,
        status: "failed",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
  return {
    apply,
    processed: entries.length,
    afterEntryId,
    nextEntryId: entries.at(-1)?.entryId ?? afterEntryId,
    retryAfterEntryId: results.some((result) => result.status === "failed")
      ? (entries[results.findIndex((result) => result.status === "failed") - 1]
          ?.entryId ?? afterEntryId)
      : null,
    hasMore: remaining.length > entries.length,
    confirmed: results.filter((result) => result.status === "confirmed").length,
    pending: results.filter((result) => result.status === "pending_review")
      .length,
    unmatched: results.filter((result) => result.status === "unmatched").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}
