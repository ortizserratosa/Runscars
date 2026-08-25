import { describe, expect, it } from "vitest";
import type { CriticalScoreObservation } from "../../src/lib/aggregation";
import { groupCriticalAggregatorHighlights } from "../../src/lib/critical/aggregators";

function score(
  id: string,
  sourceId: string,
  sourceName: string,
  filmId: string,
  filmTitle: string,
  numericValue: number,
): CriticalScoreObservation {
  return {
    id,
    sourceId,
    sourceName,
    publicationId: id,
    publicationUrl: `https://example.com/${id}`,
    author: null,
    publishedAt: null,
    capturedAt: "2026-08-25T00:00:00Z",
    seasonId: "oscars-2027",
    filmId,
    filmTitle,
    participates: false,
    state: "published",
    dataType: "score_aggregate",
    canonicalReviewId: id,
    originalDisplay: `${numericValue}/100`,
    numericValue,
    scaleMin: 0,
    scaleMax: 100,
    scaleLabel: "Metascore",
  };
}

describe("critical aggregator highlights", () => {
  it("groups films by aggregator and orders each list by its published value", () => {
    const result = groupCriticalAggregatorHighlights([
      {
        filmId: "film-b",
        filmTitle: "Bravo",
        contextualScores: [
          score("mc-b", "metacritic", "Metacritic", "film-b", "Bravo", 88),
        ],
      },
      {
        filmId: "film-a",
        filmTitle: "Alfa",
        contextualScores: [
          score("mc-a", "metacritic", "Metacritic", "film-a", "Alfa", 94),
          score(
            "rt-a",
            "rotten-tomatoes",
            "Rotten Tomatoes",
            "film-a",
            "Alfa",
            97,
          ),
        ],
      },
    ]);

    expect(result.map((group) => group.sourceName)).toEqual([
      "Metacritic",
      "Rotten Tomatoes",
    ]);
    expect(result[0].scores.map((item) => item.filmTitle)).toEqual([
      "Alfa",
      "Bravo",
    ]);
  });

  it("uses the film title as a stable tie-breaker", () => {
    const result = groupCriticalAggregatorHighlights([
      {
        filmId: "film-z",
        filmTitle: "Zulu",
        contextualScores: [
          score("z", "metacritic", "Metacritic", "film-z", "Zulu", 90),
        ],
      },
      {
        filmId: "film-a",
        filmTitle: "Alfa",
        contextualScores: [
          score("a", "metacritic", "Metacritic", "film-a", "Alfa", 90),
        ],
      },
    ]);

    expect(result[0].scores.map((item) => item.filmTitle)).toEqual([
      "Alfa",
      "Zulu",
    ]);
  });
});
