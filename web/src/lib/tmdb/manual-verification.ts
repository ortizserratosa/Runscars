import { rankingRequiresPersonEntry } from "../categories/config";
import { TmdbClient } from "./catalog.mjs";

const TMDB_SITE_ORIGINS = new Set([
  "https://www.themoviedb.org",
  "https://themoviedb.org",
]);
const THEATRICAL_RELEASE_TYPES = new Set([2, 3]);

export type ManualTmdbErrorCode =
  | "missing_token"
  | "invalid_url"
  | "wrong_kind"
  | "not_found"
  | "tmdb_unavailable"
  | "no_us_theatrical_release"
  | "outside_eligibility_year"
  | "person_not_credited";

export class ManualTmdbVerificationError extends Error {
  constructor(
    public readonly code: ManualTmdbErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ManualTmdbVerificationError";
  }
}

export type ManualTmdbVerification = {
  tmdbKind: "movie" | "person";
  label: string;
  tmdbUrl: string;
  tmdbMovieId: number | null;
  tmdbPersonId: number | null;
  qualifyingMovieTmdbUrl: string | null;
  qualifyingMovieTmdbId: number | null;
  usTheatricalReleaseDate: string;
  tmdbReleaseData: Record<string, unknown>;
  tmdbVerifiedAt: string;
};

type ParsedTmdbUrl = {
  kind: "movie" | "person";
  id: number;
  canonicalUrl: string;
};

function parseTmdbUrl(
  value: string,
  expectedKind?: ParsedTmdbUrl["kind"],
): ParsedTmdbUrl {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ManualTmdbVerificationError(
      "invalid_url",
      "El enlace debe ser una URL válida de TMDB.",
    );
  }

  if (!TMDB_SITE_ORIGINS.has(url.origin) || url.search || url.hash) {
    throw new ManualTmdbVerificationError(
      "invalid_url",
      "El enlace debe ser una ficha pública de TMDB sin parámetros adicionales.",
    );
  }

  const match = url.pathname.match(
    /^\/(movie|person)\/([1-9]\d*)(?:-[^/]*)?\/?$/,
  );
  if (!match) {
    throw new ManualTmdbVerificationError(
      "invalid_url",
      "Usa un enlace de TMDB con formato /movie/ID o /person/ID.",
    );
  }

  const kind = match[1] as ParsedTmdbUrl["kind"];
  if (expectedKind && kind !== expectedKind) {
    throw new ManualTmdbVerificationError(
      "wrong_kind",
      expectedKind === "movie"
        ? "Esta categoría necesita un enlace TMDB de película."
        : "Esta categoría necesita un enlace TMDB de persona.",
    );
  }

  return {
    kind,
    id: Number(match[2]),
    canonicalUrl: `https://www.themoviedb.org/${kind}/${match[2]}`,
  };
}

function releaseDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : null;
}

function earliestUsTheatricalRelease(
  releaseDates: unknown,
  eligibilityYear?: number | null,
) {
  if (!releaseDates || typeof releaseDates !== "object") return null;
  const results = Array.isArray((releaseDates as { results?: unknown }).results)
    ? (releaseDates as { results: unknown[] }).results
    : [];
  const matches = results.flatMap((country) => {
    if (!country || typeof country !== "object") return [];
    const record = country as { iso_3166_1?: unknown; release_dates?: unknown };
    if (record.iso_3166_1 !== "US" || !Array.isArray(record.release_dates)) {
      return [];
    }
    return record.release_dates.flatMap((release) => {
      if (!release || typeof release !== "object") return [];
      const candidate = release as { release_date?: unknown; type?: unknown };
      const date = releaseDate(candidate.release_date);
      const type = candidate.type;
      return date &&
        typeof type === "number" &&
        THEATRICAL_RELEASE_TYPES.has(type)
        ? [
            {
              iso_3166_1: "US",
              release_date: candidate.release_date,
              type,
              certification:
                typeof (candidate as { certification?: unknown })
                  .certification === "string"
                  ? (candidate as { certification: string }).certification
                  : "",
              note:
                typeof (candidate as { note?: unknown }).note === "string"
                  ? (candidate as { note: string }).note
                  : "",
            },
          ]
        : [];
    });
  });
  matches.sort((left, right) =>
    String(left.release_date).localeCompare(String(right.release_date)),
  );
  return (
    matches.find(
      (match) =>
        eligibilityYear === null ||
        eligibilityYear === undefined ||
        String(match.release_date).startsWith(`${eligibilityYear}-`),
    ) ?? null
  );
}

function unavailableError(error: unknown) {
  if (error instanceof ManualTmdbVerificationError) return error;
  const message = error instanceof Error ? error.message : "";
  return new ManualTmdbVerificationError(
    /TMDB respondió 404/.test(message) ? "not_found" : "tmdb_unavailable",
    /TMDB respondió 404/.test(message)
      ? "TMDB no encuentra esa ficha."
      : "No se ha podido comprobar TMDB ahora. Vuelve a intentarlo.",
  );
}

function requireToken(token?: string) {
  const value = token?.trim() || process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (!value) {
    throw new ManualTmdbVerificationError(
      "missing_token",
      "La verificación TMDB no está configurada en este entorno.",
    );
  }
  return value;
}

export function manualTmdbErrorMessage(
  code: ManualTmdbErrorCode,
  locale: "es" | "en",
) {
  const messages = {
    es: {
      missing_token:
        "La verificación TMDB no está configurada en este entorno.",
      invalid_url: "Introduce un enlace válido de TMDB.",
      wrong_kind: "El tipo de enlace TMDB no corresponde con esta categoría.",
      not_found: "TMDB no encuentra esa ficha.",
      tmdb_unavailable:
        "No se ha podido comprobar TMDB ahora. Vuelve a intentarlo.",
      no_us_theatrical_release:
        "TMDB no registra un estreno teatral en salas de EE. UU. para esta película.",
      outside_eligibility_year:
        "El estreno teatral en EE. UU. no cae dentro del año de elegibilidad de esta temporada.",
      person_not_credited:
        "TMDB no acredita a esa persona en la película indicada.",
    },
    en: {
      missing_token: "TMDB verification is not configured in this environment.",
      invalid_url: "Enter a valid TMDB link.",
      wrong_kind: "That TMDB link type does not match this category.",
      not_found: "TMDB could not find that record.",
      tmdb_unavailable: "TMDB could not be checked right now. Try again.",
      no_us_theatrical_release:
        "TMDB does not record a US theatrical release for this film.",
      outside_eligibility_year:
        "The US theatrical release is outside this season's eligibility year.",
      person_not_credited:
        "TMDB does not credit that person in the selected film.",
    },
  } as const;
  return messages[locale][code];
}

export async function verifyManualRankingEntry({
  categoryId,
  tmdbUrl,
  qualifyingMovieTmdbUrl,
  eligibilityYear,
  token,
  fetchImplementation,
}: {
  categoryId: string;
  tmdbUrl: string;
  qualifyingMovieTmdbUrl?: string | null;
  eligibilityYear: number | null;
  token?: string;
  fetchImplementation?: typeof fetch;
}): Promise<ManualTmdbVerification> {
  const requiresPerson = rankingRequiresPersonEntry(categoryId);
  const primary = parseTmdbUrl(tmdbUrl, requiresPerson ? "person" : "movie");
  const verifiedAt = new Date().toISOString();

  let client: TmdbClient;
  try {
    client = new TmdbClient({
      token: requireToken(token),
      fetchImplementation,
    });
  } catch (error) {
    throw unavailableError(error);
  }

  try {
    if (!requiresPerson) {
      const [movie, releaseDates] = await Promise.all([
        client.fetchMovie(primary.id, "en-US"),
        client.fetchMovieReleaseDates(primary.id),
      ]);
      const anyTheatricalRelease = earliestUsTheatricalRelease(releaseDates);
      const theatricalRelease = earliestUsTheatricalRelease(
        releaseDates,
        eligibilityYear,
      );
      const date = releaseDate(theatricalRelease?.release_date);
      if (!anyTheatricalRelease) {
        throw new ManualTmdbVerificationError(
          "no_us_theatrical_release",
          "No hay estreno teatral estadounidense verificable.",
        );
      }
      if (!theatricalRelease || !date) {
        throw new ManualTmdbVerificationError(
          "outside_eligibility_year",
          "El estreno teatral no está dentro del año de elegibilidad.",
        );
      }
      if (typeof movie?.title !== "string" || !movie.title.trim()) {
        throw new ManualTmdbVerificationError(
          "not_found",
          "TMDB no devuelve un título válido.",
        );
      }
      return {
        tmdbKind: "movie",
        label: movie.title.trim(),
        tmdbUrl: primary.canonicalUrl,
        tmdbMovieId: primary.id,
        tmdbPersonId: null,
        qualifyingMovieTmdbUrl: null,
        qualifyingMovieTmdbId: null,
        usTheatricalReleaseDate: date,
        tmdbReleaseData: theatricalRelease,
        tmdbVerifiedAt: verifiedAt,
      };
    }

    if (!qualifyingMovieTmdbUrl) {
      throw new ManualTmdbVerificationError(
        "invalid_url",
        "Las categorías de personas necesitan también la película por la que se incluye.",
      );
    }
    const qualifyingMovie = parseTmdbUrl(qualifyingMovieTmdbUrl, "movie");
    const [person, movie, releaseDates] = await Promise.all([
      client.fetchPerson(primary.id, "en-US"),
      client.fetchMovie(qualifyingMovie.id, "en-US"),
      client.fetchMovieReleaseDates(qualifyingMovie.id),
    ]);
    const anyTheatricalRelease = earliestUsTheatricalRelease(releaseDates);
    const theatricalRelease = earliestUsTheatricalRelease(
      releaseDates,
      eligibilityYear,
    );
    const date = releaseDate(theatricalRelease?.release_date);
    if (!anyTheatricalRelease) {
      throw new ManualTmdbVerificationError(
        "no_us_theatrical_release",
        "No hay estreno teatral estadounidense verificable.",
      );
    }
    if (!theatricalRelease || !date) {
      throw new ManualTmdbVerificationError(
        "outside_eligibility_year",
        "El estreno teatral no está dentro del año de elegibilidad.",
      );
    }
    if (typeof person?.name !== "string" || !person.name.trim()) {
      throw new ManualTmdbVerificationError(
        "not_found",
        "TMDB no devuelve un nombre válido.",
      );
    }
    if (typeof movie?.title !== "string" || !movie.title.trim()) {
      throw new ManualTmdbVerificationError(
        "not_found",
        "TMDB no devuelve un título válido.",
      );
    }
    const credits =
      categoryId === "directing"
        ? Array.isArray(movie.credits?.crew)
          ? movie.credits.crew
          : []
        : Array.isArray(movie.credits?.cast)
          ? movie.credits.cast
          : [];
    const credited = credits.some((credit: unknown) => {
      if (!credit || typeof credit !== "object") return false;
      const record = credit as { id?: unknown; job?: unknown };
      if (record.id !== primary.id) return false;
      return categoryId === "directing" ? record.job === "Director" : true;
    });
    if (!credited) {
      throw new ManualTmdbVerificationError(
        "person_not_credited",
        "La persona no figura en los créditos de la película.",
      );
    }
    return {
      tmdbKind: "person",
      label: `${person.name.trim()} · ${movie.title.trim()}`,
      tmdbUrl: primary.canonicalUrl,
      tmdbMovieId: null,
      tmdbPersonId: primary.id,
      qualifyingMovieTmdbUrl: qualifyingMovie.canonicalUrl,
      qualifyingMovieTmdbId: qualifyingMovie.id,
      usTheatricalReleaseDate: date,
      tmdbReleaseData: theatricalRelease,
      tmdbVerifiedAt: verifiedAt,
    };
  } catch (error) {
    throw unavailableError(error);
  }
}
