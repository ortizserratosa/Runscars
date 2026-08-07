import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
const CACHE_DURATION_MS = 180 * 24 * 60 * 60 * 1000;
const RELEVANT_CREW_JOBS = new Set([
  "Director",
  "Writer",
  "Screenplay",
  "Story",
  "Novel",
  "Director of Photography",
  "Original Music Composer",
]);

export const tmdbManifestSchema = z.object({
  version: z.literal(1),
  reviewedAt: z.iso.date(),
  locale: z.string().min(2),
  matches: z.array(
    z.object({
      filmId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      tmdbId: z.number().int().positive(),
      query: z.string().min(1),
      method: z.enum(["search_exact", "manual"]),
      reason: z.string().min(1),
      evidenceUrl: z.url(),
    }),
  ),
});

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stableValue(nestedValue)]),
    );
  }

  return value;
}

function contentHash(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function nullableDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value : null;
}

function nullableText(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function expiresAt(fetchedAt) {
  return new Date(fetchedAt.getTime() + CACHE_DURATION_MS).toISOString();
}

function personId(tmdbId) {
  return `tmdb-${tmdbId}`;
}

function selectCredits(rawCredits) {
  const cast = (rawCredits?.cast ?? []).slice(0, 30).map((credit) => ({
    tmdbPersonId: credit.id,
    personId: personId(credit.id),
    name: credit.name,
    originalName: nullableText(credit.original_name),
    profilePath: nullableText(credit.profile_path),
    knownForDepartment: nullableText(credit.known_for_department),
    tmdbCreditId: credit.credit_id,
    kind: "cast",
    role: nullableText(credit.character) ?? "Reparto",
    department: "Acting",
    billingOrder: Number.isInteger(credit.order) ? credit.order : null,
  }));

  const crew = (rawCredits?.crew ?? [])
    .filter((credit) => RELEVANT_CREW_JOBS.has(credit.job))
    .slice(0, 30)
    .map((credit) => ({
      tmdbPersonId: credit.id,
      personId: personId(credit.id),
      name: credit.name,
      originalName: nullableText(credit.original_name),
      profilePath: nullableText(credit.profile_path),
      knownForDepartment: nullableText(credit.known_for_department),
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

export function buildMovieSnapshot(
  rawMovie,
  { locale = "es-ES", fetchedAt = new Date() } = {},
) {
  if (!Number.isInteger(rawMovie?.id) || rawMovie.id <= 0) {
    throw new Error("TMDB devolvió una película sin ID válido");
  }

  if (!nullableText(rawMovie.title) || !nullableText(rawMovie.original_title)) {
    throw new Error(`TMDB devolvió la película ${rawMovie.id} sin título`);
  }

  const credits = selectCredits(rawMovie.credits);
  const originalData = {
    id: rawMovie.id,
    title: rawMovie.title,
    original_title: rawMovie.original_title,
    original_language: nullableText(rawMovie.original_language),
    overview: nullableText(rawMovie.overview),
    release_date: nullableDate(rawMovie.release_date),
    runtime: Number.isInteger(rawMovie.runtime) ? rawMovie.runtime : null,
    status: nullableText(rawMovie.status),
    tagline: nullableText(rawMovie.tagline),
    imdb_id: nullableText(rawMovie.external_ids?.imdb_id ?? rawMovie.imdb_id),
    poster_path: nullableText(rawMovie.poster_path),
    backdrop_path: nullableText(rawMovie.backdrop_path),
    genres: (rawMovie.genres ?? []).map(({ id, name }) => ({ id, name })),
    credits: credits.map((credit) => ({
      id: credit.tmdbPersonId,
      name: credit.name,
      original_name: credit.originalName,
      profile_path: credit.profilePath,
      known_for_department: credit.knownForDepartment,
      credit_id: credit.tmdbCreditId,
      kind: credit.kind,
      role: credit.role,
      department: credit.department,
      order: credit.billingOrder,
    })),
  };
  const fetchedAtIso = fetchedAt.toISOString();

  return {
    identity: {
      tmdb_id: rawMovie.id,
      last_checked_at: fetchedAtIso,
    },
    snapshot: {
      tmdb_id: rawMovie.id,
      locale,
      content_hash: contentHash(originalData),
      title: rawMovie.title,
      original_title: rawMovie.original_title,
      original_language: nullableText(rawMovie.original_language),
      overview: nullableText(rawMovie.overview),
      release_date: nullableDate(rawMovie.release_date),
      runtime: Number.isInteger(rawMovie.runtime) ? rawMovie.runtime : null,
      status: nullableText(rawMovie.status),
      tagline: nullableText(rawMovie.tagline),
      imdb_id: nullableText(rawMovie.external_ids?.imdb_id ?? rawMovie.imdb_id),
      poster_path: nullableText(rawMovie.poster_path),
      backdrop_path: nullableText(rawMovie.backdrop_path),
      genres: originalData.genres,
      original_data: originalData,
      source_url: `${TMDB_API_BASE_URL}/movie/${rawMovie.id}`,
      fetched_at: fetchedAtIso,
      expires_at: expiresAt(fetchedAt),
    },
    credits,
  };
}

export function buildPersonSnapshot(
  rawPerson,
  { locale = "es-ES", fetchedAt = new Date() } = {},
) {
  if (!Number.isInteger(rawPerson?.id) || rawPerson.id <= 0) {
    throw new Error("TMDB devolvió una persona sin ID válido");
  }

  if (!nullableText(rawPerson.name)) {
    throw new Error(`TMDB devolvió la persona ${rawPerson.id} sin nombre`);
  }

  const originalData = {
    id: rawPerson.id,
    name: rawPerson.name,
    also_known_as: (rawPerson.also_known_as ?? []).filter(
      (name) => typeof name === "string" && name.trim(),
    ),
    original_name: nullableText(rawPerson.original_name),
    known_for_department: nullableText(rawPerson.known_for_department),
    biography: nullableText(rawPerson.biography),
    birthday: nullableDate(rawPerson.birthday),
    deathday: nullableDate(rawPerson.deathday),
    place_of_birth: nullableText(rawPerson.place_of_birth),
    homepage: nullableText(rawPerson.homepage),
    imdb_id: nullableText(rawPerson.external_ids?.imdb_id),
    profile_path: nullableText(rawPerson.profile_path),
  };
  const fetchedAtIso = fetchedAt.toISOString();

  return {
    identity: {
      tmdb_id: rawPerson.id,
      last_checked_at: fetchedAtIso,
    },
    person: {
      id: personId(rawPerson.id),
      name: rawPerson.name,
      alternate_names: (rawPerson.also_known_as ?? []).filter(
        (name) => typeof name === "string" && name.trim(),
      ),
      tmdb_id: rawPerson.id,
    },
    snapshot: {
      tmdb_id: rawPerson.id,
      locale,
      content_hash: contentHash(originalData),
      name: rawPerson.name,
      original_name: nullableText(rawPerson.original_name),
      known_for_department: nullableText(rawPerson.known_for_department),
      biography: nullableText(rawPerson.biography),
      birthday: nullableDate(rawPerson.birthday),
      deathday: nullableDate(rawPerson.deathday),
      place_of_birth: nullableText(rawPerson.place_of_birth),
      homepage_url: nullableText(rawPerson.homepage),
      imdb_id: nullableText(rawPerson.external_ids?.imdb_id),
      profile_path: nullableText(rawPerson.profile_path),
      original_data: originalData,
      source_url: `${TMDB_API_BASE_URL}/person/${rawPerson.id}`,
      fetched_at: fetchedAtIso,
      expires_at: expiresAt(fetchedAt),
    },
  };
}

export class TmdbClient {
  constructor({ token, fetchImplementation = fetch }) {
    if (!nullableText(token)) {
      throw new Error("Falta TMDB_READ_ACCESS_TOKEN");
    }

    this.token = token;
    this.fetchImplementation = fetchImplementation;
  }

  async request(pathname, parameters = {}) {
    const url = new URL(`${TMDB_API_BASE_URL}${pathname}`);
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await this.fetchImplementation(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`TMDB respondió ${response.status} en ${url.pathname}`);
    }

    return response.json();
  }

  async searchMovies(query, year) {
    const response = await this.request("/search/movie", {
      query,
      primary_release_year: year,
      include_adult: false,
      language: "es-ES",
    });

    return (response.results ?? []).map(
      ({
        id,
        title,
        original_title: originalTitle,
        release_date: releaseDate,
        overview,
      }) => ({
        id,
        title,
        originalTitle,
        releaseDate: nullableDate(releaseDate),
        overview: nullableText(overview),
        evidenceUrl: `https://www.themoviedb.org/movie/${id}`,
      }),
    );
  }

  async searchPeople(query) {
    const response = await this.request("/search/person", {
      query,
      include_adult: false,
      language: "en-US",
    });
    return (response.results ?? []).map(({ id, name }) => ({ id, name }));
  }

  fetchMovie(tmdbId, locale) {
    return this.request(`/movie/${tmdbId}`, {
      append_to_response: "credits,external_ids",
      language: locale,
    });
  }

  fetchPerson(tmdbId, locale) {
    return this.request(`/person/${tmdbId}`, {
      append_to_response: "external_ids",
      language: locale,
    });
  }
}

function assertSupabase(result, context) {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

export class SupabaseCatalogRepository {
  constructor({ supabaseUrl, serviceRoleKey }) {
    if (!nullableText(supabaseUrl) || !nullableText(serviceRoleKey)) {
      throw new Error(
        "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
      );
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  async saveMovie({ identity, snapshot }) {
    assertSupabase(
      await this.supabase
        .from("tmdb_movies")
        .upsert(identity, { onConflict: "tmdb_id" }),
      "No se pudo guardar la identidad TMDB de la película",
    );
    assertSupabase(
      await this.supabase.from("tmdb_movie_snapshots").upsert(snapshot, {
        onConflict: "tmdb_id,locale,content_hash",
        ignoreDuplicates: true,
      }),
      "No se pudo guardar el snapshot TMDB de la película",
    );
  }

  async savePerson(credit, personSnapshot) {
    const identity = personSnapshot?.identity ?? {
      tmdb_id: credit.tmdbPersonId,
      last_checked_at: new Date().toISOString(),
    };
    const person = personSnapshot?.person ?? {
      id: credit.personId,
      name: credit.name,
      tmdb_id: credit.tmdbPersonId,
    };

    assertSupabase(
      await this.supabase
        .from("tmdb_people")
        .upsert(identity, { onConflict: "tmdb_id" }),
      "No se pudo guardar la identidad TMDB de la persona",
    );
    assertSupabase(
      await this.supabase
        .from("people")
        .upsert(person, { onConflict: "tmdb_id" }),
      "No se pudo guardar la persona",
    );

    if (personSnapshot) {
      assertSupabase(
        await this.supabase
          .from("tmdb_person_snapshots")
          .upsert(personSnapshot.snapshot, {
            onConflict: "tmdb_id,locale,content_hash",
            ignoreDuplicates: true,
          }),
        "No se pudo guardar el snapshot TMDB de la persona",
      );
    }
  }

  async replaceCredits(filmId, credits) {
    assertSupabase(
      await this.supabase.from("film_credits").delete().eq("film_id", filmId),
      "No se pudieron reconciliar los créditos anteriores",
    );

    if (credits.length === 0) {
      return;
    }

    const rows = credits.map((credit) => ({
      film_id: filmId,
      person_id: credit.personId,
      tmdb_credit_id: credit.tmdbCreditId,
      credit_kind: credit.kind,
      role: credit.role,
      department: credit.department,
      billing_order: credit.billingOrder,
    }));

    assertSupabase(
      await this.supabase
        .from("film_credits")
        .upsert(rows, { onConflict: "film_id,tmdb_credit_id" }),
      "No se pudieron guardar los créditos",
    );
  }

  async addEditorialCredit({
    filmId,
    personId: targetPersonId,
    tmdbCreditId,
    role,
    department,
    sourceUrl,
    reason,
    actor,
  }) {
    assertSupabase(
      await this.supabase.from("film_credits").upsert(
        {
          film_id: filmId,
          person_id: targetPersonId,
          tmdb_credit_id: tmdbCreditId,
          credit_kind: "crew",
          role,
          department,
          billing_order: null,
        },
        { onConflict: "film_id,tmdb_credit_id", ignoreDuplicates: true },
      ),
      "No se pudo guardar el crédito editorial",
    );
    assertSupabase(
      await this.supabase.from("film_credit_match_history").upsert(
        {
          film_id: filmId,
          person_id: targetPersonId,
          tmdb_credit_id: tmdbCreditId,
          role,
          department,
          source_url: sourceUrl,
          reason,
          actor,
        },
        {
          onConflict: "film_id,person_id,role,source_url",
          ignoreDuplicates: true,
        },
      ),
      "No se pudo auditar el crédito editorial",
    );
  }

  async recordMatch(match, method, actor) {
    return assertSupabase(
      await this.supabase.rpc("record_film_tmdb_match", {
        target_film_id: match.filmId,
        target_tmdb_id: match.tmdbId,
        match_method: method,
        match_query: match.query,
        match_reason: match.reason,
        match_actor: actor,
      }),
      "No se pudo registrar el emparejamiento",
    );
  }
}

export async function importCatalogMatch({
  match,
  locale,
  client,
  repository,
  actor = "tmdb-catalog-cli",
  now = () => new Date(),
  onWarning = () => {},
}) {
  const rawMovie = await client.fetchMovie(match.tmdbId, locale);
  const movie = buildMovieSnapshot(rawMovie, {
    locale,
    fetchedAt: now(),
  });
  await repository.saveMovie(movie);

  const uniqueCredits = [
    ...new Map(
      movie.credits.map((credit) => [credit.tmdbPersonId, credit]),
    ).values(),
  ];

  for (const credit of uniqueCredits) {
    let personSnapshot = null;
    try {
      const rawPerson = await client.fetchPerson(credit.tmdbPersonId, "en-US");
      personSnapshot = buildPersonSnapshot(rawPerson, {
        locale: "en-US",
        fetchedAt: now(),
      });
    } catch (error) {
      onWarning(
        `Persona TMDB ${credit.tmdbPersonId}: ${
          error instanceof Error ? error.message : "fallo desconocido"
        }`,
      );
    }
    await repository.savePerson(credit, personSnapshot);
  }

  await repository.replaceCredits(match.filmId, movie.credits);
  const changed = await repository.recordMatch(match, match.method, actor);

  return {
    filmId: match.filmId,
    tmdbId: match.tmdbId,
    changed,
    credits: movie.credits.length,
    people: uniqueCredits.length,
  };
}
