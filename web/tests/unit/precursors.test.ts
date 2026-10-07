import { describe, expect, it } from "vitest";
import manifest from "../../data/precursors/2026-2027.json";
import { importPrecursorManifests } from "../../../supabase/functions/_shared/precursors/repository.mjs";
import {
  matchPrecursorFilm,
  preparePrecursorSet,
  precursorConsensusPoints,
} from "../../../supabase/functions/_shared/precursors/core.mjs";

const schedule = manifest.sets.find(
  (set) => set.editionId === "actor-awards-2027",
)!;
const winners = manifest.sets.find(
  (set) => set.editionId === "actor-awards-2026",
)!;

describe("official precursor context", () => {
  it("records six future calendars and 25 archived winners in separate seasons", async () => {
    expect(manifest.organizations).toHaveLength(6);
    expect(manifest.editions).toHaveLength(12);
    expect(
      manifest.sets
        .filter((set) => set.seasonId === "oscars-2027")
        .every((set) => set.kind === "schedule" && !set.entries.length),
    ).toBe(true);
    expect(
      manifest.sets
        .filter((set) => set.kind === "winners")
        .reduce((sum, set) => sum + set.entries.length, 0),
    ).toBe(25);
    for (const set of manifest.sets)
      expect((await preparePrecursorSet(set)).seasonId).toBe(
        `oscars-${set.ceremonyYear}`,
      );
    expect(schedule.source.publishedAt).toBeNull();
    expect(precursorConsensusPoints()).toBe(0);
  });

  it("preserves original values and is idempotent across captures and matching", async () => {
    const first = await preparePrecursorSet(winners);
    const matching = await preparePrecursorSet(
      { ...winners, capturedAt: "2026-10-08T08:00:00Z" },
      [{ id: "sinners", title: "Sinners", seasonIds: ["oscars-2026"] }],
    );
    expect(first.contentHash).toBe(matching.contentHash);
    expect(matching.entries[0]).toMatchObject({
      originalTitle: "SINNERS",
      originalCategory: "Outstanding Performance by a Cast in a Motion Picture",
      categoryRelation: "related",
      filmId: "sinners",
    });
    expect(matching.rawCapture).toEqual(winners.rawCapture);
  });

  it("leaves homonyms and films from another season for editorial review", () => {
    const catalogue = [
      { id: "old", title: "Sinners", seasonIds: ["oscars-2026"] },
      { id: "new", title: "Sinners", seasonIds: ["oscars-2027"] },
    ];
    expect(
      matchPrecursorFilm(
        { originalTitle: "SINNERS" },
        catalogue,
        "oscars-2026",
      ),
    ).toMatchObject({ filmId: "old", status: "matched" });
    expect(
      matchPrecursorFilm(
        { originalTitle: "SINNERS" },
        catalogue.slice(1),
        "oscars-2026",
      ),
    ).toMatchObject({ filmId: null, status: "unmatched" });
    expect(
      matchPrecursorFilm(
        { originalTitle: "SINNERS" },
        [
          ...catalogue,
          { id: "homonym", title: "Sinners", seasonIds: ["oscars-2026"] },
        ],
        "oscars-2026",
      ),
    ).toMatchObject({ filmId: null, status: "pending_review" });
  });

  it("rejects season crossover, unofficial receipts and premature results", async () => {
    await expect(
      preparePrecursorSet({ ...winners, seasonId: "oscars-2027" }),
    ).rejects.toThrow(/no coinciden/);
    await expect(
      preparePrecursorSet({
        ...winners,
        source: { ...winners.source, url: "https://example.com/awards" },
      }),
    ).rejects.toThrow(/web oficial/);
    await expect(
      preparePrecursorSet({
        ...schedule,
        kind: "winners",
        entries: winners.entries,
      }),
    ).rejects.toThrow(/antes de su ceremonia/);
    await expect(
      preparePrecursorSet({
        ...schedule,
        kind: "winners",
        schedule: {
          ...schedule.schedule,
          ceremonyOn: null,
          nominationsOn: null,
        },
        entries: winners.entries,
      }),
    ).rejects.toThrow(/requieren una fecha/);
    await expect(
      preparePrecursorSet({
        ...schedule,
        kind: "nominations",
        entries: winners.entries,
      }),
    ).rejects.toThrow(/antes de su anuncio/);
    await expect(
      preparePrecursorSet({ ...winners, kind: "nominations", entries: [] }),
    ).rejects.toThrow(/no puede estar vacío/);
  });

  it("requires explicit correction chains and detects duplicate result rows", async () => {
    await expect(
      preparePrecursorSet({ ...winners, correctsSetId: "previous" }),
    ).rejects.toThrow(/debe enlazar/);
    await expect(
      preparePrecursorSet({
        ...winners,
        entries: [...winners.entries, winners.entries[0]],
      }),
    ).rejects.toThrow(/duplicada/);
    const original = await preparePrecursorSet(winners);
    const corrected = await preparePrecursorSet({
      ...winners,
      entries: winners.entries.slice(0, 1),
      correctsSetId: "previous",
      correctionReason: "Revisión de cobertura",
    });
    expect(corrected.contentHash).not.toBe(original.contentHash);
    expect(corrected.correctsSetId).toBe("previous");
  });

  it("continues importing other organisations when one receipt is invalid", async () => {
    const calls: string[] = [];
    const repository = {
      async catalogue() {
        return [];
      },
      async persistPreparedSet(set: { editionId: string }) {
        calls.push(set.editionId);
        return { status: "inserted" };
      },
    };
    const results = await importPrecursorManifests({
      manifests: [
        {
          ...schedule,
          source: { ...schedule.source, url: "https://unofficial.example/" },
        },
        winners,
      ],
      repository,
    });
    expect(results.map((result: { status: string }) => result.status)).toEqual([
      "failed",
      "inserted",
    ]);
    expect(calls).toEqual(["actor-awards-2026"]);
  });
});
