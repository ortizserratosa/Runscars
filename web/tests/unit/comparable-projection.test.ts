import { describe, expect, it } from "vitest";
import {
  AGGREGATION_METHOD_VERSION_V2,
  AGGREGATION_METHOD_VERSION_V3,
  type PredictionAggregateV2,
  type PredictionSourceContributionV2,
} from "../../src/lib/aggregation/v2";
import {
  hasIncompleteComparisonDates,
  projectComparableAggregate,
} from "../../src/lib/snapshots/comparable-projection";
import { buildRealProviderCuts } from "../../src/lib/snapshots/provider-cuts";

const candidateMeta = (id: string) => ({
  id,
  candidateId: id,
  seasonId: "oscars-2027",
  categoryId: "best-picture",
  label: id,
  film: { id, title: id },
  workTitle: null,
  people: [],
});

function contribution(
  sourceId: string,
  publishedAt: string,
  rank: number | null,
  appeared: boolean,
): PredictionSourceContributionV2 {
  return {
    sourceId,
    sourceName: sourceId,
    publicationId: `${sourceId}-publication`,
    publicationUrl: `https://example.com/${sourceId}`,
    publishedAt,
    rank,
    listLength: sourceId === "the-ringer" ? 0 : 2,
    points: rank === null ? 0 : (3 - rank) / 2,
    appeared,
    appearanceKind:
      rank !== null ? "ordered" : appeared ? "selection" : "absent",
    observationId: appeared ? `${sourceId}-${rank ?? "selected"}` : null,
  };
}

function oldAggregate(): PredictionAggregateV2 {
  const dates = {
    "fresh-one": "2026-07-20T00:00:00Z",
    "fresh-two": "2026-07-22T00:00:00Z",
    "old-ranked": "2026-05-01T00:00:00Z",
    "the-ringer": "2026-03-20T00:00:00Z",
  };
  const sourceLists = Object.entries(dates).map(([sourceId, publishedAt]) => ({
    sourceId,
    sourceName: sourceId,
    publicationId: `${sourceId}-publication`,
    publicationUrl: `https://example.com/${sourceId}`,
    publishedAt,
    listLength: sourceId === "the-ringer" ? null : 2,
    orderedObservationIds:
      sourceId === "the-ringer" ? [] : [`${sourceId}-1`, `${sourceId}-2`],
    selectionObservationIds:
      sourceId === "the-ringer" ? [`${sourceId}-selected`] : [],
  }));
  const aContributions = [
    contribution("fresh-one", dates["fresh-one"], 1, true),
    contribution("fresh-two", dates["fresh-two"], 2, true),
    contribution("old-ranked", dates["old-ranked"], 1, true),
    contribution("the-ringer", dates["the-ringer"], null, true),
  ];
  const bContributions = [
    contribution("fresh-one", dates["fresh-one"], 2, true),
    contribution("fresh-two", dates["fresh-two"], 1, true),
    contribution("old-ranked", dates["old-ranked"], 2, true),
    contribution("the-ringer", dates["the-ringer"], null, false),
  ];
  const cContributions = [
    contribution("fresh-one", dates["fresh-one"], null, false),
    contribution("fresh-two", dates["fresh-two"], null, false),
    contribution("old-ranked", dates["old-ranked"], null, false),
    contribution("the-ringer", dates["the-ringer"], null, true),
  ];
  return {
    methodVersion: AGGREGATION_METHOD_VERSION_V2,
    seasonId: "oscars-2027",
    categoryId: "best-picture",
    intention: "nomination",
    cutoffDate: "2026-07-25T04:47:00Z",
    isConsensus: false,
    minimumOrderedSources: 4,
    orderedSourceCount: 3,
    applicableSourceCount: 4,
    sourceLists,
    ranking: [
      {
        ...candidateMeta("A"),
        score: 0.833333333333,
        scoreOutOf100: 83.3333333333,
        appearances: 4,
        coverage: 1,
        applicableSourceCount: 4,
        orderedSourceCount: 3,
        meanRank: 4 / 3,
        medianRank: 1,
        topFiveCount: 3,
        firstPlaceCount: 2,
        position: 1,
        movement: null,
        sourceContributions: aContributions,
      },
      {
        ...candidateMeta("B"),
        score: 0.666666666667,
        scoreOutOf100: 66.6666666667,
        appearances: 3,
        coverage: 0.75,
        applicableSourceCount: 4,
        orderedSourceCount: 3,
        meanRank: 5 / 3,
        medianRank: 2,
        topFiveCount: 3,
        firstPlaceCount: 1,
        position: 2,
        movement: null,
        sourceContributions: bContributions,
      },
      {
        ...candidateMeta("C"),
        score: 0,
        scoreOutOf100: 0,
        appearances: 1,
        coverage: 0.25,
        applicableSourceCount: 4,
        orderedSourceCount: 3,
        meanRank: null,
        medianRank: null,
        topFiveCount: 0,
        firstPlaceCount: 0,
        position: 3,
        movement: null,
        sourceContributions: cContributions,
      },
    ],
    includedObservationIds: sourceLists.flatMap((source) => [
      ...source.orderedObservationIds,
      ...source.selectionObservationIds,
    ]),
    excludedObservationIds: ["preexisting-exclusion"],
  };
}

describe("comparable historical projection", () => {
  it("removes every stale source from old coverage, Borda, rankings and evidence without mutating the lock", () => {
    const locked = oldAggregate();
    const original = structuredClone(locked);
    const projected = projectComparableAggregate(locked);

    expect(projected.methodVersion).toBe(AGGREGATION_METHOD_VERSION_V3);
    expect(projected.sourceLists.map((source) => source.sourceId)).toEqual([
      "fresh-one",
      "fresh-two",
    ]);
    expect(projected.applicableSourceCount).toBe(2);
    expect(projected.orderedSourceCount).toBe(2);
    expect(projected.ranking.map((candidate) => candidate.candidateId)).toEqual(
      ["A", "B"],
    );
    expect(projected.ranking[0]).toMatchObject({
      score: 0.75,
      scoreOutOf100: 75,
      appearances: 2,
      coverage: 1,
      meanRank: 1.5,
      medianRank: 1.5,
      firstPlaceCount: 1,
      position: 1,
    });
    expect(
      projected.ranking[0].sourceContributions.map((source) => source.sourceId),
    ).toEqual(["fresh-one", "fresh-two"]);
    expect(projected.includedObservationIds).toEqual([
      "fresh-one-1",
      "fresh-one-2",
      "fresh-two-1",
      "fresh-two-2",
    ]);
    expect(projected.excludedObservationIds).toContain("the-ringer-selected");
    expect(projected.excludedObservationIds).toContain("old-ranked-1");
    expect(projected.excludedObservationIds).toContain("preexisting-exclusion");
    expect(locked).toEqual(original);
  });

  it("allows a freshly updated source to participate in a later cut", () => {
    const locked = oldAggregate();
    const freshRinger = {
      ...locked,
      sourceLists: locked.sourceLists.map((source) =>
        source.sourceId === "the-ringer"
          ? { ...source, publishedAt: "2026-07-24T00:00:00Z" }
          : source,
      ),
      ranking: locked.ranking.map((candidate) => ({
        ...candidate,
        sourceContributions: candidate.sourceContributions.map((source) =>
          source.sourceId === "the-ringer"
            ? { ...source, publishedAt: "2026-07-24T00:00:00Z" }
            : source,
        ),
      })),
    };
    const projected = projectComparableAggregate(freshRinger);

    expect(projected.sourceLists.map((source) => source.sourceId)).toContain(
      "the-ringer",
    );
    expect(
      projected.ranking.map((candidate) => candidate.candidateId),
    ).toContain("C");
    expect(projected.ranking[0].coverage).toBe(1);
    expect(projected.applicableSourceCount).toBe(3);
  });

  it("uses observation capture dates when a publication has no date and keeps unknown dates conservative", () => {
    const locked = oldAggregate();
    const undated = {
      ...locked,
      sourceLists: locked.sourceLists.map((source) =>
        source.sourceId === "old-ranked"
          ? { ...source, publishedAt: null }
          : source,
      ),
      ranking: locked.ranking.map((candidate) => ({
        ...candidate,
        sourceContributions: candidate.sourceContributions.map((source) =>
          source.sourceId === "old-ranked"
            ? { ...source, publishedAt: null }
            : source,
        ),
      })),
    };
    const missingDates = new Map<string, string>();
    expect(hasIncompleteComparisonDates(undated, missingDates)).toBe(true);
    expect(
      projectComparableAggregate(undated, missingDates).sourceLists.map(
        (source) => source.sourceId,
      ),
    ).toContain("old-ranked");

    const captures = new Map([
      ["old-ranked-1", "2026-05-01T00:00:00Z"],
      ["old-ranked-2", "2026-05-01T00:00:00Z"],
    ]);
    expect(hasIncompleteComparisonDates(undated, captures)).toBe(false);
    expect(
      projectComparableAggregate(undated, captures).sourceLists.map(
        (source) => source.sourceId,
      ),
    ).not.toContain("old-ranked");
  });

  it("collapses a cut caused only by an already stale source", () => {
    const locked = oldAggregate();
    const ringerOnly = structuredClone(locked);
    ringerOnly.ranking[0].sourceContributions.find(
      (source) => source.sourceId === "the-ringer",
    )!.appeared = false;
    ringerOnly.ranking[1].sourceContributions.find(
      (source) => source.sourceId === "the-ringer",
    )!.appeared = true;
    const snapshots = [
      { id: "july-25", lockedAt: "2026-07-25T04:47:00Z", aggregate: locked },
      {
        id: "july-26",
        lockedAt: "2026-07-26T04:47:00Z",
        aggregate: ringerOnly,
      },
    ].map((item) => ({
      ...item,
      contentHash: item.id,
      methodVersion: AGGREGATION_METHOD_VERSION_V2,
      schemaVersion: "runscars-snapshot-v2",
    }));
    const cuts = buildRealProviderCuts(snapshots);

    expect(cuts.map((cut) => cut.id)).toEqual(["july-25"]);
    expect(cuts[0].comparableProjection).toBe(true);
    expect(cuts[0].methodVersion).toBe(AGGREGATION_METHOD_VERSION_V2);
    expect(cuts[0].aggregate.methodVersion).toBe(AGGREGATION_METHOD_VERSION_V3);
    expect(cuts[0].contentHash).toBe("july-25");
  });

  it("keeps already locked v3 aggregates unchanged", () => {
    const current: PredictionAggregateV2 = {
      ...oldAggregate(),
      methodVersion: AGGREGATION_METHOD_VERSION_V3,
    };
    expect(projectComparableAggregate(current)).toBe(current);
  });
});
