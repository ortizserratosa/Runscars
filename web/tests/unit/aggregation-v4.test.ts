import { describe, expect, it } from "vitest";
import {
  aggregatePredictionsV2,
  aggregatePredictionsV4,
  type PredictionObservationV2,
} from "../../src/lib/aggregation/v2";
import {
  changedProviderSourceIds,
  hasEffectiveProviderChanges,
} from "../../src/lib/snapshots/provider-cuts";
import { canCompareSnapshotMovements } from "../../src/lib/snapshots/movements";
import { projectComparableAggregate } from "../../src/lib/snapshots/comparable-projection";

const options = {
  seasonId: "oscars-2027",
  categoryId: "actor",
  intention: "nomination" as const,
  cutoffDate: "2026-10-19T12:00:00Z",
};

function row(
  source: string,
  rank: number,
  length: number,
  candidateId = `${source}-${rank}`,
): PredictionObservationV2 {
  return {
    id: `${source}-${rank}`,
    sourceId: source,
    sourceName: source,
    publicationId: source,
    publicationUrl: `https://example.com/${source}`,
    author: "Author",
    publishedAt: "2026-10-18T00:00:00Z",
    capturedAt: "2026-10-19T04:00:00Z",
    seasonId: options.seasonId,
    categoryId: options.categoryId,
    intention: "nomination",
    candidate: {
      id: candidateId,
      seasonId: options.seasonId,
      categoryId: options.categoryId,
      label: candidateId,
      film: { id: candidateId, title: candidateId },
      workTitle: null,
      people: [],
    },
    dataType: "prediction_ordered",
    rank,
    listLength: length,
    originalValue: JSON.stringify({ rank, list_length: length }),
    participates: true,
    state: "published",
  };
}

function list(source: string, length: number) {
  return Array.from({ length }, (_, index) => row(source, index + 1, length));
}

describe("common prediction scoring window v4", () => {
  it("gives the same position equal points across short and long sources", () => {
    const observations = [5, 20, 30].flatMap((length) =>
      list(`source-${length}`, length).map((item) =>
        item.rank === 5
          ? { ...item, candidate: { ...item.candidate, id: "shared" } }
          : item,
      ),
    );
    const original = structuredClone(observations);
    const aggregate = aggregatePredictionsV4(observations, options);
    const candidate = aggregate.ranking.find((item) => item.id === "shared")!;
    expect(aggregate.methodVersion).toBe("runscars-aggregation-v4");
    expect(aggregate.scoringDepth).toBe(10);
    expect(candidate.scoreOutOf100).toBe(60);
    expect(candidate.sourceContributions.map((item) => item.points)).toEqual([
      0.6, 0.6, 0.6,
    ]);
    expect(
      candidate.sourceContributions
        .map((item) => item.listLength)
        .sort((a, b) => a - b),
    ).toEqual([5, 20, 30]);
    expect(observations).toEqual(original);
  });

  it.each(["actor", "best-picture"])(
    "excludes ranks beyond the %s window from scoring, coverage and ties",
    (categoryId) => {
      const depth = categoryId === "best-picture" ? 20 : 10;
      const observations = list("ranked", depth + 2).map((item) => ({
        ...item,
        categoryId,
        candidate: { ...item.candidate, categoryId },
      }));
      const tail = observations[depth];
      const selection = {
        ...tail,
        id: "selection-tail",
        sourceId: "selection",
        sourceName: "selection",
        publicationId: "selection",
        dataType: "prediction_selection" as const,
        rank: null,
        listLength: null,
      };
      const aggregate = aggregatePredictionsV4([...observations, selection], {
        ...options,
        categoryId,
      });
      expect(aggregate.scoringDepth).toBe(depth);
      expect(
        aggregate.ranking.find((item) => item.id === `ranked-${depth}`)?.score,
      ).toBe(1 / depth);
      expect(
        aggregate.ranking.some((item) => item.id === `ranked-${depth + 2}`),
      ).toBe(false);
      const candidate = aggregate.ranking.find(
        (item) => item.id === tail.candidate.id,
      )!;
      expect(candidate).toMatchObject({
        score: 0,
        appearances: 1,
        coverage: 0.5,
        medianRank: null,
        meanRank: null,
        firstPlaceCount: 0,
        topFiveCount: 0,
      });
      expect(
        candidate.sourceContributions.find(
          (item) => item.sourceId === "ranked",
        ),
      ).toMatchObject({
        rank: null,
        appeared: false,
        appearanceKind: "absent",
        points: 0,
      });
      expect(
        aggregate.sourceLists.find((item) => item.sourceId === "ranked"),
      ).toMatchObject({ listLength: depth + 2, consideredCount: depth });
      expect(aggregate.includedObservationIds).not.toContain(tail.id);
      expect(aggregate.excludedObservationIds).toEqual(
        [tail.id, observations[depth + 1].id].sort(),
      );
    },
  );

  it("keeps matching gaps at their published positions and counts the source once", () => {
    const aggregate = aggregatePredictionsV4(
      [row("source", 2, 30), row("source", 10, 30), row("source", 11, 30)],
      options,
    );
    expect(aggregate.orderedSourceCount).toBe(1);
    expect(aggregate.ranking.map((item) => item.score)).toEqual([0.9, 0.1]);
    expect(aggregate.sourceLists[0]).toMatchObject({
      listLength: 30,
      consideredCount: 2,
    });
    expect(aggregate.ranking[0].medianRank).toBe(2);
  });

  it("retains explicit unordered selections without inventing a cutoff order", () => {
    const observations = list("selection", 50).map((item) => ({
      ...item,
      dataType: "prediction_selection" as const,
      rank: null,
      listLength: null,
    }));
    const aggregate = aggregatePredictionsV4(observations, options);
    expect(aggregate.ranking).toHaveLength(50);
    expect(aggregate.orderedSourceCount).toBe(0);
    expect(aggregate.sourceLists[0].consideredCount).toBe(50);
    expect(
      aggregate.ranking.every(
        (item) => item.score === 0 && item.medianRank === null,
      ),
    ).toBe(true);
  });

  it("preserves v3 scoring and historical projections while starting a new methodology", () => {
    const observations = list("source", 30);
    const historical = aggregatePredictionsV2(observations, options);
    const before = JSON.stringify(historical);
    const current = aggregatePredictionsV4(observations, {
      ...options,
      previous: historical,
    });
    expect(historical.ranking[4].score).toBeCloseTo(26 / 30, 12);
    expect(historical.ranking).toHaveLength(30);
    expect(historical.scoringDepth).toBeUndefined();
    expect(current.ranking[4].score).toBe(0.6);
    expect(current.ranking.every((item) => item.movement === null)).toBe(true);
    expect(canCompareSnapshotMovements(current, historical)).toBe(false);
    expect(hasEffectiveProviderChanges(current, historical)).toBe(true);
    expect(changedProviderSourceIds(current, historical)).toEqual([]);
    expect(projectComparableAggregate(historical)).toBe(historical);
    expect(projectComparableAggregate(current)).toBe(current);
    expect(JSON.stringify(historical)).toBe(before);
  });

  it("reports real editorial changes and new sources across the method boundary", () => {
    const observations = list("source", 30);
    const historical = aggregatePredictionsV2(observations, options);
    const swapped = observations.map((item) => ({
      ...item,
      rank: item.rank === 1 ? 2 : item.rank === 2 ? 1 : item.rank,
    }));
    const current = aggregatePredictionsV4(
      [...swapped, row("entrant", 1, 5)],
      options,
    );
    expect(changedProviderSourceIds(current, historical)).toEqual([
      "entrant",
      "source",
    ]);
  });

  it("does not create an effective cut when only the unused tail grows", () => {
    const before = aggregatePredictionsV4(list("source", 20), options);
    const after = aggregatePredictionsV4(list("source", 50), options);
    expect(after.ranking).toEqual(
      before.ranking.map((candidate) => ({
        ...candidate,
        sourceContributions: candidate.sourceContributions.map((item) => ({
          ...item,
          listLength: 50,
        })),
      })),
    );
    expect(hasEffectiveProviderChanges(after, before)).toBe(false);
  });
});
