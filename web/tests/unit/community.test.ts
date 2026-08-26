import { describe, expect, it } from "vitest";
import {
  communityFiltersSchema,
  filmWatchStateSchema,
  parseCandidateIds,
  parseCommunityFilters,
  rankingSchema,
} from "../../src/lib/community/validation";

describe("community input contracts", () => {
  it("accepts an explicit partial ranking without inferring missing positions", () => {
    const candidateIds = parseCandidateIds(
      JSON.stringify(["candidate-one", "candidate-three"]),
    );
    const ranking = rankingSchema.parse({
      seasonId: "oscars-2027",
      categoryId: "best-picture",
      candidateIds,
      isPublic: false,
    });

    expect(ranking.candidateIds).toEqual(["candidate-one", "candidate-three"]);
  });

  it("rejects repeated candidates and malformed ranking payloads", () => {
    expect(
      rankingSchema.safeParse({
        seasonId: "oscars-2027",
        categoryId: "best-picture",
        candidateIds: ["candidate-one", "candidate-one"],
        isPublic: true,
      }).success,
    ).toBe(false);
    expect(parseCandidateIds("{not-json")).toEqual([]);
  });

  it("accepts the three explicit film watch states", () => {
    expect(filmWatchStateSchema.parse("watched")).toBe("watched");
    expect(filmWatchStateSchema.parse("not_watched")).toBe("not_watched");
    expect(filmWatchStateSchema.parse("unmarked")).toBe("unmarked");
    expect(filmWatchStateSchema.safeParse("unknown").success).toBe(false);
  });

  it("normalizes community filters and rejects unsafe pages", () => {
    expect(
      parseCommunityFilters({
        season: "oscars-2027",
        category: "mejor-pelicula",
        q: " Ana ",
        page: "2",
      }),
    ).toEqual({
      seasonId: "oscars-2027",
      categoryId: "mejor-pelicula",
      query: "Ana",
      page: 2,
    });
    expect(
      communityFiltersSchema.safeParse({
        seasonId: "oscars-2027",
        page: 0,
      }).success,
    ).toBe(false);
  });
});
