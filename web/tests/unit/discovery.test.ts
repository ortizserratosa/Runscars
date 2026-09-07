import { describe, expect, it } from "vitest";
import {
  phase71FixtureAggregate,
  phase71FixturePreviousAggregate,
} from "../../src/data/phase71-fixture";
import {
  draftKey,
  readDraft,
  serializeDraft,
} from "../../src/lib/discovery/ballot";
import {
  escapeXml,
  validWeek,
  weekStart,
  weeklyMovements,
} from "../../src/lib/discovery/weekly";

describe("guest ballot drafts", () => {
  const now = Date.parse("2026-09-07T10:00:00Z");
  it("keeps only unique current candidates within the category limit", () => {
    expect(
      readDraft(
        serializeDraft(["a", "a", "unknown", "b", "c"], now),
        ["a", "b", "c"],
        2,
        now,
      ),
    ).toEqual(["a", "b"]);
    expect(draftKey("actor")).not.toBe(draftKey("best-picture"));
  });
  it.each(["broken", "{}", '{"savedAt":"today","ids":["a"]}', null])(
    "ignores damaged storage %s",
    (raw) => expect(readDraft(raw, ["a"], 5, now)).toEqual([]),
  );
  it("rejects expired and future drafts", () => {
    expect(
      readDraft(serializeDraft(["a"], now - 31 * 86400000), ["a"], 5, now),
    ).toEqual([]);
    expect(readDraft(serializeDraft(["a"], now + 1), ["a"], 5, now)).toEqual(
      [],
    );
  });
});
describe("weekly editions", () => {
  it("uses Monday UTC boundaries across months and years", () => {
    expect(weekStart(new Date("2027-01-03T23:59:59Z"))).toBe("2026-12-28");
    expect(weekStart(new Date("2026-09-07T00:00:00Z"))).toBe("2026-09-07");
    expect(validWeek("2026-09-07", new Date("2026-09-07"))).toBe(true);
    for (const date of [
      "2026-09-08",
      "2026-09-14",
      "2026-02-30",
      "2025-12-29",
      "oops",
    ])
      expect(validWeek(date, new Date("2026-09-07"))).toBe(false);
  });
  it("compares positions against the start of the week and identifies new entries", () => {
    const current = phase71FixtureAggregate("best-picture");
    const previous = phase71FixturePreviousAggregate("best-picture");
    const movements = weeklyMovements(current, previous);
    expect(
      movements.find(
        (item) => item.candidateId === current.ranking[0].candidateId,
      )?.movement,
    ).toBe(1);
    expect(
      movements.find(
        (item) => item.candidateId === current.ranking[1].candidateId,
      )?.movement,
    ).toBe(-1);
    expect(
      movements.find(
        (item) => item.candidateId === current.ranking.at(-1)?.candidateId,
      )?.movement,
    ).toBeNull();
    expect(weeklyMovements(current, current)).toEqual([]);
  });
  it("does not invent movement without a comparable baseline", () => {
    const current = phase71FixtureAggregate("best-picture");
    expect(weeklyMovements(current, null)).toEqual([]);
    expect(
      weeklyMovements(current, {
        ...current,
        methodVersion: "different" as typeof current.methodVersion,
      }),
    ).toEqual([]);
    expect(weeklyMovements(current, phase71FixtureAggregate("actor"))).toEqual(
      [],
    );
  });
  it("escapes publisher and film text in RSS", () => {
    expect(escapeXml('A & B <film> "name"')).toBe(
      "A &amp; B &lt;film&gt; &quot;name&quot;",
    );
  });
});
