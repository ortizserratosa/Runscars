import { describe, expect, it } from "vitest";
import {
  communityFiltersSchema,
  filmWatchStateSchema,
  parseRankingEntries,
  parseCommunityFilters,
  rankingSchema,
} from "../../src/lib/community/validation";

describe("community input contracts", () => {
  it("accepts an explicit partial ranking without inferring missing positions", () => {
    const entries = parseRankingEntries(
      JSON.stringify([
        { kind: "candidate", candidateId: "candidate-one" },
        { kind: "candidate", candidateId: "candidate-three" },
      ]),
    );
    const ranking = rankingSchema.parse({
      seasonId: "oscars-2027",
      categoryId: "best-picture",
      entries,
      isPublic: false,
    });

    expect(ranking.entries).toEqual(entries);
  });

  it("rejects repeated candidates and malformed ranking payloads", () => {
    expect(
      rankingSchema.safeParse({
        seasonId: "oscars-2027",
        categoryId: "best-picture",
        entries: [
          { kind: "candidate", candidateId: "candidate-one" },
          { kind: "candidate", candidateId: "candidate-one" },
        ],
        isPublic: true,
      }).success,
    ).toBe(false);
    expect(parseRankingEntries("{not-json")).toEqual([]);
  });

  it("enforces nomination slots plus one alternate and one manual entry", () => {
    const bestPictureEntries = Array.from({ length: 11 }, (_, index) => ({
      kind: "candidate" as const,
      candidateId: `candidate-${index + 1}`,
    }));
    expect(
      rankingSchema.safeParse({
        seasonId: "oscars-2027",
        categoryId: "best-picture",
        entries: bestPictureEntries,
        isPublic: false,
      }).success,
    ).toBe(true);
    expect(
      rankingSchema.safeParse({
        seasonId: "oscars-2027",
        categoryId: "actor",
        entries: bestPictureEntries.slice(0, 7),
        isPublic: false,
      }).success,
    ).toBe(false);
    expect(
      rankingSchema.safeParse({
        seasonId: "oscars-2027",
        categoryId: "actor",
        entries: [
          { kind: "custom", label: "Actor fuera de seguimiento" },
          { kind: "custom", label: "Segundo actor manual" },
        ],
        isPublic: false,
      }).success,
    ).toBe(false);
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
