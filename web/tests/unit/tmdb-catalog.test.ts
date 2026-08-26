import { describe, expect, it } from "vitest";
import {
  buildMovieSnapshot,
  buildPersonSnapshot,
  importCatalogMatch,
  refreshCatalogSnapshots,
  TmdbClient,
} from "../../src/lib/tmdb/catalog.mjs";

const rawMovie = {
  id: 1368337,
  title: "La odisea",
  original_title: "The Odyssey",
  original_language: "en",
  overview: "Un viaje de regreso.",
  release_date: "2026-07-15",
  runtime: 164,
  status: "Released",
  tagline: "",
  poster_path: "/poster.jpg",
  backdrop_path: "/backdrop.jpg",
  genres: [{ id: 12, name: "Aventura" }],
  external_ids: { imdb_id: "tt0000001" },
  credits: {
    cast: [
      {
        id: 1,
        name: "Actor One",
        original_name: "Actor One",
        profile_path: "/actor.jpg",
        known_for_department: "Acting",
        credit_id: "cast-credit",
        character: "Odysseus",
        order: 0,
      },
    ],
    crew: [
      {
        id: 2,
        name: "Director One",
        original_name: "Director One",
        profile_path: "/director.jpg",
        known_for_department: "Directing",
        credit_id: "crew-credit",
        job: "Director",
        department: "Directing",
      },
    ],
  },
};

function rawPerson(id: number, name: string) {
  return {
    id,
    name,
    original_name: name,
    known_for_department: id === 1 ? "Acting" : "Directing",
    biography: `${name} biography`,
    birthday: "1980-01-01",
    deathday: null,
    place_of_birth: "Madrid",
    homepage: null,
    profile_path: `/${id}.jpg`,
    external_ids: { imdb_id: `nm${id}` },
  };
}

describe("TMDB catalog", () => {
  it("creates stable snapshots while keeping capture provenance separate", () => {
    const first = buildMovieSnapshot(rawMovie, {
      fetchedAt: new Date("2026-07-24T10:00:00Z"),
    });
    const second = buildMovieSnapshot(rawMovie, {
      fetchedAt: new Date("2026-07-25T10:00:00Z"),
    });

    expect(first.snapshot.content_hash).toBe(second.snapshot.content_hash);
    expect(first.snapshot.fetched_at).not.toBe(second.snapshot.fetched_at);
    expect(first.snapshot.source_url).toBe(
      "https://api.themoviedb.org/3/movie/1368337",
    );
    expect(first.credits).toHaveLength(2);
  });

  it("sends the token only in the authorization header", async () => {
    const requests: Array<{ url: string; authorization: string | null }> = [];
    const fetchImplementation: typeof fetch = async (input, options) => {
      requests.push({
        url: String(input),
        authorization: new Headers(options?.headers).get("Authorization"),
      });
      return Response.json({ results: [] });
    };
    const client = new TmdbClient({
      token: "private-read-token",
      fetchImplementation,
    });

    await client.searchMovies("The Odyssey", 2026);

    expect(requests[0]?.url).not.toContain("private-read-token");
    expect(requests[0]?.authorization).toBe("Bearer private-read-token");
  });

  it("imports the same match twice without duplicating snapshots or history", async () => {
    const movieHashes = new Set<string>();
    const personHashes = new Set<string>();
    const matches = new Map<string, number>();
    const history: Array<{ filmId: string; tmdbId: number }> = [];
    let savedCredits = 0;

    const repository = {
      async saveMovie(movie: ReturnType<typeof buildMovieSnapshot>) {
        movieHashes.add(movie.snapshot.content_hash);
      },
      async savePerson(
        _credit: unknown,
        person: ReturnType<typeof buildPersonSnapshot>,
      ) {
        personHashes.add(person.snapshot.content_hash);
      },
      async replaceCredits(_filmId: string, credits: unknown[]) {
        savedCredits = credits.length;
      },
      async recordMatch(
        match: { filmId: string; tmdbId: number },
        method: string,
      ) {
        const current = matches.get(match.filmId);
        if (current === match.tmdbId) {
          return false;
        }
        if (current && method !== "correction") {
          throw new Error("Use correction");
        }
        matches.set(match.filmId, match.tmdbId);
        history.push(match);
        return true;
      },
    };
    const client = {
      async fetchMovie() {
        return rawMovie;
      },
      async fetchPerson(id: number) {
        return rawPerson(id, id === 1 ? "Actor One" : "Director One");
      },
    };
    const match = {
      filmId: "the-odyssey",
      tmdbId: 1368337,
      query: "The Odyssey",
      method: "manual",
      reason: "Título, año y equipo coinciden.",
      evidenceUrl: "https://www.themoviedb.org/movie/1368337",
    };

    const first = await importCatalogMatch({
      match,
      locale: "es-ES",
      client,
      repository,
      now: () => new Date("2026-07-24T10:00:00Z"),
    });
    const second = await importCatalogMatch({
      match,
      locale: "es-ES",
      client,
      repository,
      now: () => new Date("2026-07-25T10:00:00Z"),
    });

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(movieHashes.size).toBe(1);
    expect(personHashes.size).toBe(2);
    expect(history).toHaveLength(1);
    expect(savedCredits).toBe(2);
  });

  it("refreshes both public locales without changing matches or credits", async () => {
    const locales: string[] = [];
    const saved: string[] = [];
    const client = {
      async fetchMovie(_tmdbId: number, locale: string) {
        locales.push(locale);
        return {
          ...rawMovie,
          title: locale === "en-US" ? "The Odyssey" : "La odisea",
        };
      },
    };
    const repository = {
      async saveMovie(movie: ReturnType<typeof buildMovieSnapshot>) {
        saved.push(movie.snapshot.locale);
      },
    };

    const result = await refreshCatalogSnapshots({
      film: { filmId: "the-odyssey", tmdbId: 1368337 },
      locales: ["es-ES", "en-US"],
      client,
      repository,
      now: () => new Date("2026-08-26T10:00:00Z"),
    });

    expect(locales).toEqual(["es-ES", "en-US"]);
    expect(saved).toEqual(["es-ES", "en-US"]);
    expect(result).toEqual({
      filmId: "the-odyssey",
      tmdbId: 1368337,
      locales: ["es-ES", "en-US"],
    });
  });
});
