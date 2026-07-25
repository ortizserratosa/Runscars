import { describe, expect, it } from "vitest";
import { phase71FixtureAggregate } from "../../src/data/phase71-fixture";
import {
  aggregatePredictionsV2,
  type CategoryCandidate,
  type PredictionObservationV2,
} from "../../src/lib/aggregation/v2";
import {
  createPredictionSnapshotPayloadV2,
  lockPredictionSnapshotV2,
} from "../../src/lib/snapshots/v2";

function candidate(
  id: string,
  label: string,
  filmId: string,
  people: string[] = [],
): CategoryCandidate {
  return {
    id,
    seasonId: "oscars-2027",
    categoryId: "actor",
    label,
    film: { id: filmId, title: `Film ${filmId}` },
    workTitle: null,
    people: people.map((name, displayOrder) => ({
      id: `person-${displayOrder}-${filmId}`,
      name,
      role: "Acting",
      displayOrder,
    })),
  };
}

function observation(
  id: string,
  sourceId: string,
  item: CategoryCandidate,
  rank: number,
  publicationId = `${sourceId}-old`,
): PredictionObservationV2 {
  return {
    id,
    sourceId,
    sourceName: sourceId,
    publicationId,
    publicationUrl: `https://example.com/${publicationId}`,
    author: null,
    publishedAt: publicationId.endsWith("new")
      ? "2026-07-25T00:00:00Z"
      : "2026-07-20T00:00:00Z",
    capturedAt: "2026-07-25T04:17:00Z",
    seasonId: "oscars-2027",
    categoryId: item.categoryId,
    intention: "nomination",
    candidate: item,
    dataType: "prediction_ordered",
    rank,
    listLength: 2,
    originalValue: item.label,
    participates: true,
    state: "published",
  };
}

describe("generic prediction aggregation v2", () => {
  it("reaches five ordered media in six applicable Best Picture sources", () => {
    const result = phase71FixtureAggregate("best-picture");
    expect(result.methodVersion).toBe("runscars-aggregation-v2");
    expect(result.minimumOrderedSources).toBe(4);
    expect(result.orderedSourceCount).toBe(5);
    expect(result.applicableSourceCount).toBe(6);
    expect(result.isConsensus).toBe(true);
    const ringer = result.ranking[0].sourceContributions.find(
      (source) => source.sourceId === "the-ringer",
    );
    expect(ringer?.points).toBe(0);
    expect(ringer?.appearanceKind).toBe("selection");
  });

  it("publishes screenplay at the four-source floor without inventing a fifth", () => {
    const result = phase71FixtureAggregate("original-screenplay");
    expect(result.orderedSourceCount).toBe(4);
    expect(result.applicableSourceCount).toBe(4);
    expect(result.isConsensus).toBe(true);
  });

  it("calculates Borda by candidate identity for an acting category", () => {
    const first = candidate("candidate-first", "Actor One — Film A", "film-a", [
      "Actor One",
    ]);
    const second = candidate(
      "candidate-second",
      "Actor Two — Film A",
      "film-a",
      ["Actor Two"],
    );
    const observations = ["a", "b", "c", "d"].flatMap((source, index) => [
      observation(`${source}-first`, source, first, index === 1 ? 2 : 1),
      observation(`${source}-second`, source, second, index === 1 ? 1 : 2),
    ]);
    const result = aggregatePredictionsV2(observations, {
      seasonId: "oscars-2027",
      categoryId: "actor",
      intention: "nomination",
      cutoffDate: "2026-07-25",
    });
    expect(result.ranking[0]).toMatchObject({
      candidateId: "candidate-first",
      score: 0.875,
      people: [expect.objectContaining({ name: "Actor One" })],
    });
    expect(result.ranking[1].candidateId).toBe("candidate-second");
  });

  it("retains an older category list when a newer publication omits it", () => {
    const actor = candidate("candidate-actor", "Actor — Film", "film", [
      "Actor",
    ]);
    const actorTwo = candidate(
      "candidate-actor-two",
      "Actor Two — Film",
      "film",
      ["Actor Two"],
    );
    const otherCategory = {
      ...actor,
      id: "candidate-picture",
      categoryId: "best-picture",
    };
    const observations = [
      observation("old-1", "source", actor, 1),
      observation("old-2", "source", actorTwo, 2),
      {
        ...observation("new-other-1", "source", otherCategory, 1, "source-new"),
        listLength: 1,
      },
    ];
    const result = aggregatePredictionsV2(observations, {
      seasonId: "oscars-2027",
      categoryId: "actor",
      intention: "nomination",
      cutoffDate: "2026-07-25",
    });
    expect(result.sourceLists[0].publicationId).toBe("source-old");
    expect(result.includedObservationIds).toEqual(["old-1", "old-2"]);
  });

  it("locks candidate IDs rather than legacy film IDs", async () => {
    const aggregate = phase71FixtureAggregate("actor");
    const payload = createPredictionSnapshotPayloadV2(aggregate, {
      kind: "nomination_final",
      cutoffAt: aggregate.cutoffDate,
      timeZone: "UTC",
      selectionSize: 5,
    });
    const locked = await lockPredictionSnapshotV2(payload, {
      lockedAt: "2026-07-25T04:47:00Z",
      lockedBy: "unit-test",
    });
    expect(payload.selectedCandidateIds).toEqual(
      aggregate.ranking.slice(0, 5).map((item) => item.candidateId),
    );
    expect(locked.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
