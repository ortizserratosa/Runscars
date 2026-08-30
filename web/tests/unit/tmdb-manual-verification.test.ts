import { describe, expect, it } from "vitest";
import { verifyManualRankingEntry } from "../../src/lib/tmdb/manual-verification";

function mockTmdbFetch(routes: Record<string, unknown>) {
  return async (input: string | URL | Request) => {
    const url = input instanceof Request ? new URL(input.url) : new URL(input);
    const body = routes[url.pathname];
    if (!body) return new Response(JSON.stringify({}), { status: 404 });
    return new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  };
}

describe("manual TMDB ranking verification", () => {
  it("uses the earliest US limited or general theatrical release", async () => {
    const result = await verifyManualRankingEntry({
      categoryId: "best-picture",
      tmdbUrl: "https://www.themoviedb.org/movie/123-some-film",
      eligibilityYear: 2026,
      token: "fixture-token",
      fetchImplementation: mockTmdbFetch({
        "/3/movie/123": { id: 123, title: "Some Film" },
        "/3/movie/123/release_dates": {
          results: [
            {
              iso_3166_1: "US",
              release_dates: [
                { release_date: "2026-05-20", type: 4 },
                { release_date: "2026-05-10", type: 2 },
                { release_date: "2026-05-15", type: 3 },
              ],
            },
          ],
        },
      }),
    });

    expect(result).toMatchObject({
      tmdbKind: "movie",
      label: "Some Film",
      tmdbMovieId: 123,
      tmdbUrl: "https://www.themoviedb.org/movie/123",
      usTheatricalReleaseDate: "2026-05-10",
    });
    expect(result.tmdbReleaseData).toMatchObject({ type: 2 });
  });

  it("requires a US theatrical release in the season eligibility year", async () => {
    await expect(
      verifyManualRankingEntry({
        categoryId: "best-picture",
        tmdbUrl: "https://www.themoviedb.org/movie/456",
        eligibilityYear: 2026,
        token: "fixture-token",
        fetchImplementation: mockTmdbFetch({
          "/3/movie/456": { id: 456, title: "Old Film" },
          "/3/movie/456/release_dates": {
            results: [
              {
                iso_3166_1: "US",
                release_dates: [{ release_date: "2025-12-20", type: 3 }],
              },
            ],
          },
        }),
      }),
    ).rejects.toMatchObject({
      code: "outside_eligibility_year",
    });
  });

  it("requires a person to be credited in the qualifying film", async () => {
    const result = await verifyManualRankingEntry({
      categoryId: "actor",
      tmdbUrl: "https://www.themoviedb.org/person/42-actor",
      qualifyingMovieTmdbUrl: "https://www.themoviedb.org/movie/789-film",
      eligibilityYear: 2026,
      token: "fixture-token",
      fetchImplementation: mockTmdbFetch({
        "/3/person/42": { id: 42, name: "A Person" },
        "/3/movie/789": {
          id: 789,
          title: "Qualifying Film",
          credits: { cast: [{ id: 42, character: "Lead" }], crew: [] },
        },
        "/3/movie/789/release_dates": {
          results: [
            {
              iso_3166_1: "US",
              release_dates: [{ release_date: "2026-09-01", type: 3 }],
            },
          ],
        },
      }),
    });

    expect(result).toMatchObject({
      tmdbKind: "person",
      label: "A Person · Qualifying Film",
      tmdbPersonId: 42,
      qualifyingMovieTmdbId: 789,
      qualifyingMovieTmdbUrl: "https://www.themoviedb.org/movie/789",
      usTheatricalReleaseDate: "2026-09-01",
    });
  });

  it("rejects a person link in film categories", async () => {
    await expect(
      verifyManualRankingEntry({
        categoryId: "best-picture",
        tmdbUrl: "https://www.themoviedb.org/person/42",
        eligibilityYear: 2026,
        token: "fixture-token",
        fetchImplementation: mockTmdbFetch({}),
      }),
    ).rejects.toMatchObject({
      code: "wrong_kind",
    });
  });
});
