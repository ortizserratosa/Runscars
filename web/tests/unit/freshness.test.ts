import { describe, expect, it } from "vitest";
import {
  phase71FixtureAggregate,
  phase71FixturePreviousAggregate,
} from "../../src/data/phase71-fixture";
import { sourceFreshnessForCut } from "../../src/lib/snapshots/freshness";
import { buildRealProviderCuts } from "../../src/lib/snapshots/provider-cuts";

describe("provider freshness presentation", () => {
  it("keeps publication, effective change and connector checks separate", () => {
    const previous = phase71FixturePreviousAggregate("best-picture");
    const current = phase71FixtureAggregate("best-picture");
    const cuts = buildRealProviderCuts([
      {
        id: "previous",
        contentHash: "previous",
        lockedAt: "2026-07-20T04:47:00.000Z",
        methodVersion: previous.methodVersion,
        schemaVersion: "runscars-snapshot-v2",
        aggregate: previous,
      },
      {
        id: "current",
        contentHash: "current",
        lockedAt: "2026-07-25T04:47:00.000Z",
        methodVersion: current.methodVersion,
        schemaVersion: "runscars-snapshot-v2",
        aggregate: current,
      },
    ]);
    const changedSource = cuts.at(-1)?.changedSourceIds[0];
    expect(changedSource).toBeTruthy();
    const sourceIds = current.sourceLists.map((source) => source.sourceId);
    const successfulSource = changedSource!;
    const failedSource = sourceIds.find((id) => id !== successfulSource)!;
    const freshness = sourceFreshnessForCut(
      cuts,
      cuts.length - 1,
      new Map([
        [
          successfulSource,
          {
            lastSuccessfulCheckAt: "2026-07-26T04:17:00.000Z",
            lastFailureAt: "2026-07-24T04:17:00.000Z",
          },
        ],
        [
          failedSource,
          {
            lastSuccessfulCheckAt: "2026-07-24T04:17:00.000Z",
            lastFailureAt: "2026-07-26T04:17:00.000Z",
          },
        ],
      ]),
    );
    const successful = freshness.find(
      (source) => source.sourceId === successfulSource,
    );
    const failed = freshness.find((source) => source.sourceId === failedSource);
    expect(successful).toMatchObject({
      status: "ok",
      lastChangedAt: "2026-07-25T04:47:00.000Z",
      lastSuccessfulCheckAt: "2026-07-26T04:17:00.000Z",
      changedInSelectedCut: true,
    });
    expect(successful?.publishedAt).not.toBe(successful?.lastChangedAt);
    expect(failed?.status).toBe("failed");
    expect(freshness.some((source) => source.status === "unknown")).toBe(true);
  });
});
