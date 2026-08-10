import { describe, expect, it } from "vitest";
import { phase71FixtureAggregate } from "../../src/data/phase71-fixture";
import { compareSnapshotMovements } from "../../src/lib/snapshots/movements";
import {
  buildRealProviderCuts,
  changedProviderSourceIds,
  hasEffectiveProviderChanges,
} from "../../src/lib/snapshots/provider-cuts";

describe("snapshot ranking movements", () => {
  it("marks rises, falls, stability and new candidates against the prior cut", () => {
    const current = phase71FixtureAggregate("best-picture");
    const previousRanking = [
      current.ranking[1],
      current.ranking[0],
      ...current.ranking.slice(2, -1),
    ].map((candidate, index) => ({
      ...candidate,
      position: index + 1,
    }));
    const previous = {
      ...current,
      cutoffDate: "2026-07-20T04:47:00.000Z",
      ranking: previousRanking,
    };

    const compared = compareSnapshotMovements(current, previous);

    expect(compared.ranking[0].movement).toBe(1);
    expect(compared.ranking[1].movement).toBe(-1);
    expect(compared.ranking[2].movement).toBe(0);
    expect(compared.ranking.at(-1)?.movement).toBeNull();
    expect(
      current.ranking.every((candidate) => candidate.movement === null),
    ).toBe(true);
  });

  it("rejects a comparison across different category scopes", () => {
    expect(() =>
      compareSnapshotMovements(
        phase71FixtureAggregate("best-picture"),
        phase71FixtureAggregate("directing"),
      ),
    ).toThrow(/alcance o metodología distintos/);
  });

  it("collapses manual snapshots when provider lists did not change", () => {
    const previous = phase71FixtureAggregate("best-picture");
    const metadataOnly = {
      ...previous,
      cutoffDate: "2026-07-24T04:47:00.000Z",
      sourceLists: previous.sourceLists.map((source) => ({
        ...source,
        publicationUrl: `${source.publicationUrl}?captured=again`,
      })),
    };
    const changed = structuredClone(metadataOnly);
    const contribution = changed.ranking
      .flatMap((candidate) => candidate.sourceContributions)
      .find(
        (source) =>
          source.sourceId === "awards-daily" &&
          source.appearanceKind === "ordered",
      );
    expect(contribution).toBeDefined();
    contribution!.rank = (contribution!.rank ?? 1) + 1;

    const cuts = buildRealProviderCuts([
      {
        id: "cut-1",
        contentHash: "1".repeat(64),
        lockedAt: "2026-07-23T04:47:00.000Z",
        methodVersion: previous.methodVersion,
        schemaVersion: "runscars-snapshot-v2",
        aggregate: previous,
      },
      {
        id: "manual-without-provider-change",
        contentHash: "2".repeat(64),
        lockedAt: "2026-07-24T04:47:00.000Z",
        methodVersion: metadataOnly.methodVersion,
        schemaVersion: "runscars-snapshot-v2",
        aggregate: metadataOnly,
      },
      {
        id: "cut-2",
        contentHash: "3".repeat(64),
        lockedAt: "2026-07-25T04:47:00.000Z",
        methodVersion: changed.methodVersion,
        schemaVersion: "runscars-snapshot-v2",
        aggregate: changed,
      },
    ]);

    expect(hasEffectiveProviderChanges(metadataOnly, previous)).toBe(false);
    expect(changedProviderSourceIds(changed, metadataOnly)).toEqual([
      "awards-daily",
    ]);
    expect(cuts.map((cut) => cut.id)).toEqual(["cut-1", "cut-2"]);
  });

  it("keeps only the final provider state from each UTC day", () => {
    const previous = phase71FixtureAggregate("best-picture");
    const firstIntradayState = structuredClone(previous);
    const finalIntradayState = structuredClone(previous);
    const changeRank = (
      aggregate: typeof previous,
      sourceId: string,
      increment: number,
    ) => {
      const contribution = aggregate.ranking
        .flatMap((candidate) => candidate.sourceContributions)
        .find(
          (source) =>
            source.sourceId === sourceId && source.appearanceKind === "ordered",
        );
      expect(contribution).toBeDefined();
      contribution!.rank = (contribution!.rank ?? 1) + increment;
    };
    changeRank(firstIntradayState, "awards-daily", 1);
    changeRank(finalIntradayState, "next-best-picture", 1);

    const cuts = buildRealProviderCuts([
      {
        id: "august-3",
        contentHash: "1".repeat(64),
        lockedAt: "2026-08-03T05:45:28.777Z",
        methodVersion: previous.methodVersion,
        schemaVersion: "runscars-snapshot-v2",
        aggregate: previous,
      },
      {
        id: "august-7-partial",
        contentHash: "2".repeat(64),
        lockedAt: "2026-08-07T12:55:01.585Z",
        methodVersion: firstIntradayState.methodVersion,
        schemaVersion: "runscars-snapshot-v2",
        aggregate: firstIntradayState,
      },
      {
        id: "august-7-final",
        contentHash: "3".repeat(64),
        lockedAt: "2026-08-07T13:02:03.641Z",
        methodVersion: finalIntradayState.methodVersion,
        schemaVersion: "runscars-snapshot-v2",
        aggregate: finalIntradayState,
      },
    ]);

    expect(cuts.map((cut) => cut.id)).toEqual(["august-3", "august-7-final"]);
    expect(cuts[1].changedSourceIds).toEqual(["next-best-picture"]);
  });
});
