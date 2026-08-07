import { describe, expect, it } from "vitest";
import { phase71FixtureAggregate } from "../../src/data/phase71-fixture";
import { compareSnapshotMovements } from "../../src/lib/snapshots/movements";

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
});
