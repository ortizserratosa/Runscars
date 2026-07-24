import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateCriticalReception,
  aggregatePredictions,
  normalizeCriticalScore,
  type CriticalScoreObservation,
} from "../../src/lib/aggregation";
import {
  referenceCriticalScoreObservations,
  referenceCurrentPrediction,
  referencePredictionObservations,
  referencePredictionTimeline,
} from "../../src/data/phase6-reference";

const capturedAt = "2026-07-24T12:00:00Z";

function scoreFixture(
  id: string,
  numericValue: number | null,
  scaleMax: number | null,
  overrides: Partial<CriticalScoreObservation> = {},
): CriticalScoreObservation {
  return {
    id,
    sourceId: `source-${id}`,
    sourceName: `Source ${id}`,
    publicationId: `review-${id}`,
    publicationUrl: `https://example.com/review-${id}`,
    author: `Critic ${id}`,
    publishedAt: "2026-07-20",
    capturedAt,
    seasonId: "oscars-2027",
    filmId: "reference-film",
    filmTitle: "Reference Film",
    participates: true,
    state: "published",
    dataType: "score_individual",
    canonicalReviewId: `review-${id}`,
    originalDisplay:
      numericValue === null || scaleMax === null
        ? "A"
        : `${numericValue}/${scaleMax}`,
    numericValue,
    scaleMin: 0,
    scaleMax,
    scaleLabel: "numeric",
    ...overrides,
  };
}

describe("critical score aggregation", () => {
  it.each([
    [8, 10, 4],
    [75, 100, 3.75],
    [3, 4, 3.75],
  ])("normalizes %s/%s to %s/5", (value, maximum, expected) => {
    expect(
      normalizeCriticalScore({
        numericValue: value,
        scaleMin: 0,
        scaleMax: maximum,
      })?.normalizedValue,
    ).toBe(expected);
  });

  it("does not invent a conversion for a non-numeric or non-zero scale", () => {
    expect(
      normalizeCriticalScore({
        numericValue: null,
        scaleMin: null,
        scaleMax: null,
      }),
    ).toBeNull();
    expect(
      normalizeCriticalScore({
        numericValue: 3,
        scaleMin: 1,
        scaleMax: 5,
      }),
    ).toBeNull();
  });

  it("matches the hand-calculated mean, median and range", () => {
    const observations = [
      scoreFixture("eight-of-ten", 8, 10),
      scoreFixture("seventy-five", 75, 100),
      scoreFixture("three-of-four", 3, 4),
      scoreFixture("context", 94, 100, {
        dataType: "score_aggregate",
        participates: false,
      }),
    ];

    const result = aggregateCriticalReception(observations, "reference-film");

    expect(result.isSufficient).toBe(true);
    expect(result.statistics).toEqual({
      mean: 11.5 / 3,
      median: 3.75,
      minimum: 3.75,
      maximum: 4,
      count: 3,
    });
    expect(result.contextualScores.map((score) => score.id)).toEqual([
      "context",
    ]);
  });

  it("keeps the real fixture below the public critical threshold", () => {
    const result = aggregateCriticalReception(
      referenceCriticalScoreObservations,
      "the-odyssey",
    );

    expect(result.isSufficient).toBe(false);
    expect(result.statistics).toBeNull();
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0].originalDisplay).toBe("5/5");
    expect(result.scores[0].normalization.normalizedValue).toBe(5);
    expect(result.contextualScores).toHaveLength(2);
  });

  it("counts a canonical review only once and keeps its latest publication", () => {
    const original = scoreFixture("original", 3, 5);
    const revision = scoreFixture("revision", 4, 5, {
      sourceId: original.sourceId,
      author: original.author,
      canonicalReviewId: original.canonicalReviewId,
      publishedAt: "2026-07-21",
    });

    const result = aggregateCriticalReception(
      [original, revision],
      "reference-film",
    );

    expect(result.scores).toHaveLength(1);
    expect(result.scores[0].id).toBe("revision");
    expect(result.scores[0].normalization.normalizedValue).toBe(4);
  });
});

describe("prediction consensus", () => {
  it("matches the complete hand-calculated Best Picture reference", () => {
    expect(referenceCurrentPrediction.orderedSourceCount).toBe(4);
    expect(referenceCurrentPrediction.applicableSourceCount).toBe(4);
    expect(referenceCurrentPrediction.includedObservationIds).toHaveLength(48);
    expect(referenceCurrentPrediction.isConsensus).toBe(true);

    const [odyssey, projectHailMary, wildHorseNine, fjord, dune] =
      referenceCurrentPrediction.ranking;
    expect({
      id: odyssey.filmId,
      score: odyssey.score,
      coverage: odyssey.coverage,
      mean: odyssey.meanRank,
      median: odyssey.medianRank,
      firsts: odyssey.firstPlaceCount,
    }).toEqual({
      id: "the-odyssey",
      score: 0.975,
      coverage: 1,
      mean: 1.25,
      median: 1,
      firsts: 3,
    });
    expect(projectHailMary.score).toBeCloseTo(0.8, 12);
    expect(wildHorseNine.score).toBeCloseTo(0.775, 12);
    expect(fjord.score).toBeCloseTo(0.65, 12);
    expect(dune.score).toBeCloseTo(0.65, 12);
    expect(fjord.position).toBe(4);
    expect(dune.position).toBe(5);
  });

  it("uses an unordered selection for coverage but never for Borda", () => {
    const socialReckoning = referenceCurrentPrediction.ranking.find(
      (candidate) => candidate.filmId === "the-social-reckoning",
    )!;
    const awardsWatch = socialReckoning.sourceContributions.find(
      (source) => source.sourceId === "awardswatch",
    )!;

    expect(socialReckoning.appearances).toBe(2);
    expect(socialReckoning.coverage).toBe(0.5);
    expect(socialReckoning.score).toBeCloseTo(0.1, 12);
    expect(awardsWatch.appearanceKind).toBe("selection");
    expect(awardsWatch.rank).toBeNull();
    expect(awardsWatch.points).toBe(0);
  });

  it("uses only the latest eligible publication from each source", () => {
    const awardsDailyUpdate = referencePredictionObservations
      .filter((observation) => observation.sourceId === "awards-daily")
      .map((observation) => ({
        ...observation,
        id: `updated-${observation.id}`,
        publicationId: "awards-daily-2026-07-22",
        publishedAt: "2026-07-22",
      }));
    const result = aggregatePredictions(
      [...referencePredictionObservations, ...awardsDailyUpdate],
      {
        seasonId: "oscars-2027",
        categoryId: "best-picture",
        intention: "nomination",
        cutoffDate: "2026-07-22",
      },
    );

    expect(result.orderedSourceCount).toBe(3);
    expect(
      result.sourceLists.filter((source) => source.sourceId === "awards-daily"),
    ).toHaveLength(1);
    expect(
      result.sourceLists.find((source) => source.sourceId === "awards-daily")
        ?.publicationId,
    ).toBe("awards-daily-2026-07-22");
    expect(
      result.includedObservationIds.some((id) => id.startsWith("ad-")),
    ).toBe(false);
  });

  it("recalculates temporal cuts and movement without creating snapshots", () => {
    expect(
      referencePredictionTimeline.map((cut) => ({
        date: cut.cutoffDate,
        sources: cut.orderedSourceCount,
        observations: cut.includedObservationIds.length,
        consensus: cut.isConsensus,
      })),
    ).toEqual([
      {
        date: "2026-07-04",
        sources: 1,
        observations: 10,
        consensus: false,
      },
      {
        date: "2026-07-15",
        sources: 2,
        observations: 28,
        consensus: false,
      },
      {
        date: "2026-07-20",
        sources: 3,
        observations: 38,
        consensus: true,
      },
      {
        date: "2026-07-23",
        sources: 4,
        observations: 48,
        consensus: true,
      },
    ]);

    expect(
      referenceCurrentPrediction.ranking.find(
        (candidate) => candidate.filmId === "fjord",
      )?.movement,
    ).toBe(1);
    expect(
      referenceCurrentPrediction.ranking.find(
        (candidate) => candidate.filmId === "dune-part-three",
      )?.movement,
    ).toBe(-1);
  });

  it("is an exact aggregation subset of the phase 1 CSV", async () => {
    const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
    const csv = await readFile(
      path.join(repositoryRoot, "data/phase-1/observations.csv"),
      "utf8",
    );
    const [header, ...lines] = csv.trim().split("\n");
    const columns = header.split(",");
    const rows = lines.map((line) =>
      Object.fromEntries(
        line.split(",").map((value, index) => [columns[index], value]),
      ),
    );
    const aggregationRows = rows.filter((row) =>
      [
        "prediction_ordered",
        "prediction_selection",
        "score_individual",
        "score_aggregate",
      ].includes(row.data_type),
    );
    const fixtureIds = [
      ...referencePredictionObservations,
      ...referenceCriticalScoreObservations,
    ]
      .map((observation) => observation.id)
      .sort();

    expect(aggregationRows.map((row) => row.observation_id).sort()).toEqual(
      fixtureIds,
    );

    const rowById = new Map(
      aggregationRows.map((row) => [row.observation_id, row]),
    );
    for (const observation of referencePredictionObservations) {
      expect(rowById.get(observation.id), observation.id).toMatchObject({
        source_id: observation.sourceId,
        publication_id: observation.publicationId,
        publication_url: observation.publicationUrl,
        author: observation.author ?? "",
        published_at: observation.publishedAt ?? "",
        captured_at: observation.capturedAt,
        season_id: observation.seasonId,
        film_id: observation.filmId,
        category: observation.categoryId,
        data_type: observation.dataType,
        intent: observation.intention,
        rank: observation.rank?.toString() ?? "",
        list_length: observation.listLength?.toString() ?? "",
        value_original: observation.originalValue,
        participates_in_aggregate: observation.participates.toString(),
        status: observation.state,
      });
    }

    for (const observation of referenceCriticalScoreObservations) {
      expect(rowById.get(observation.id), observation.id).toMatchObject({
        source_id: observation.sourceId,
        publication_id: observation.publicationId,
        publication_url: observation.publicationUrl,
        author: observation.author ?? "",
        published_at: observation.publishedAt ?? "",
        captured_at: observation.capturedAt,
        season_id: observation.seasonId,
        film_id: observation.filmId,
        data_type: observation.dataType,
        value_original: observation.originalDisplay,
        scale_original: observation.scaleLabel,
        participates_in_aggregate: observation.participates.toString(),
        status: observation.state,
      });
    }
  });
});
