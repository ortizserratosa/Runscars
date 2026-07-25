import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { referenceCurrentPrediction } from "../../src/data/phase6-reference";
import { referenceLockedSnapshot } from "../../src/data/phase7-reference";
import {
  canonicalJson,
  createOfficialResultsPayload,
  createPredictionSnapshotPayload,
  evaluateNominations,
  evaluateWinner,
  lockOfficialResults,
  lockPredictionSnapshot,
  sha256,
  summarizeNominationEvaluations,
  summarizeWinnerEvaluations,
  type LockedPredictionSnapshot,
} from "../../src/lib/snapshots";
import { prepareOfficialResultsManifest } from "../../src/lib/snapshots/official-results.mjs";
import {
  runScheduledSnapshots,
  type SnapshotSchedule,
  type SnapshotSchedulerRepository,
} from "../../src/lib/snapshots/scheduler-core";
import { referencePredictionObservations } from "../../src/data/phase6-reference";

const lockedAt = "2026-07-24T12:00:00Z";

async function nominationReference() {
  const payload = createPredictionSnapshotPayload(referenceCurrentPrediction, {
    kind: "nomination_final",
    cutoffAt: "2026-07-23T23:59:59.999Z",
    timeZone: "Europe/Madrid",
    selectionSize: 10,
  });
  return lockPredictionSnapshot(payload, {
    id: "nomination-final-reference",
    lockedAt,
    lockedBy: "unit-test",
  });
}

describe("locked snapshots", () => {
  it("canonicalizes object keys and hashes the same payload deterministically", async () => {
    expect(canonicalJson({ z: 1, a: { d: 4, c: 3 } })).toBe(
      '{"a":{"c":3,"d":4},"z":1}',
    );
    await expect(sha256({ z: 1, a: 2 })).resolves.toBe(
      await sha256({ a: 2, z: 1 }),
    );
  });

  it("locks the phase 7 reference with its reproducible content hash", async () => {
    expect(await sha256(referenceLockedSnapshot.payload)).toBe(
      referenceLockedSnapshot.contentHash,
    );
    expect(referenceLockedSnapshot.payload.activeSourceIds).toEqual([
      "awards-daily",
      "awards-radar",
      "awardswatch",
      "next-best-picture",
    ]);
    expect(referenceLockedSnapshot.payload.includedObservationIds).toHaveLength(
      48,
    );
  });

  it("keeps final selection rules separate from periodic snapshots", () => {
    expect(() =>
      createPredictionSnapshotPayload(referenceCurrentPrediction, {
        kind: "periodic",
        cutoffAt: "2026-07-23T23:59:59.999Z",
        timeZone: "Europe/Madrid",
        selectionSize: 10,
      }),
    ).toThrow("no fija una selección final");
    expect(() =>
      createPredictionSnapshotPayload(referenceCurrentPrediction, {
        kind: "winner_final",
        cutoffAt: "2026-07-23T23:59:59.999Z",
        timeZone: "Europe/Madrid",
      }),
    ).toThrow("no coincide con su intención");
  });

  it("requires an explicit link and reason for corrections", async () => {
    await expect(
      lockPredictionSnapshot(referenceLockedSnapshot.payload, {
        lockedAt,
        lockedBy: "unit-test",
        correctsSnapshotId: referenceLockedSnapshot.id,
      }),
    ).rejects.toThrow("referencia original y motivo");
  });

  it("creates weekly snapshots while isolating empty and failed scopes", async () => {
    const schedules: SnapshotSchedule[] = [
      {
        id: "best-picture-weekly",
        seasonId: "oscars-2027",
        categoryId: "best-picture",
        intention: "nomination",
        kind: "periodic",
        timeZone: "UTC",
      },
      {
        id: "empty-scope",
        seasonId: "oscars-2027",
        categoryId: "adapted-screenplay",
        intention: "nomination",
        kind: "periodic",
        timeZone: "UTC",
      },
      {
        id: "failed-scope",
        seasonId: "oscars-2027",
        categoryId: "directing",
        intention: "nomination",
        kind: "periodic",
        timeZone: "UTC",
      },
    ];
    const locked: LockedPredictionSnapshot[] = [];
    const repository: SnapshotSchedulerRepository = {
      async activeSchedules() {
        return schedules;
      },
      async predictionObservations(schedule) {
        if (schedule.id === "failed-scope") {
          throw new Error("fixture failure");
        }
        return schedule.id === "best-picture-weekly"
          ? referencePredictionObservations
          : [];
      },
      async lock(snapshot) {
        locked.push(snapshot);
        return true;
      },
    };

    const results = await runScheduledSnapshots(
      repository,
      new Date("2026-07-25T04:47:00Z"),
    );

    expect(results.map((result) => result.status)).toEqual([
      "created",
      "skipped",
      "failed",
    ]);
    expect(locked).toHaveLength(1);
    expect(locked[0].payload.includedObservationIds).toHaveLength(48);
    expect(locked[0].lockedBy).toBe("vercel-cron:snapshots-weekly");
  });
});

describe("official result evaluation", () => {
  it("prepares the versioned manual result manifest without external access", async () => {
    const fixturePath = path.resolve(
      import.meta.dirname,
      "../fixtures/results/official.json",
    );
    const manifest = JSON.parse(await readFile(fixturePath, "utf8"));
    const first = await prepareOfficialResultsManifest(manifest, {
      capturedAt: "2027-01-22T13:45:00Z",
      lockedBy: "unit-test",
    });
    const second = await prepareOfficialResultsManifest(manifest, {
      capturedAt: "2027-01-22T13:45:00Z",
      lockedBy: "unit-test",
    });

    expect(first.contentHash).toBe(second.contentHash);
    expect(first.payload.source.sourceUrl).toBe(
      "https://www.oscars.org/reference-fixture",
    );
    expect(first.payload.entries).toHaveLength(1);
  });

  it("matches the hand-calculated nomination example", async () => {
    const snapshot = await nominationReference();
    const predicted = snapshot.payload.selectedCandidateIds;
    const officialIds = [
      ...predicted.slice(0, 8),
      "the-social-reckoning",
      "fatherland",
    ];
    const officialPayload = createOfficialResultsPayload({
      seasonId: "oscars-2027",
      kind: "nominations",
      source: {
        sourceId: "academy",
        sourceUrl: "https://www.oscars.org/reference-fixture",
        author: null,
        publishedAt: "2027-01-22T13:30:00Z",
        capturedAt: "2027-01-22T13:45:00Z",
      },
      entries: officialIds.map((filmId) => ({
        categoryId: "best-picture",
        candidateId: filmId,
        filmId,
        personId: null,
        outcome: "nominee" as const,
      })),
      originalData: {
        fixture: true,
        purpose: "hand-calculated evaluation example",
      },
    });
    const results = await lockOfficialResults(officialPayload, {
      id: "nominations-reference",
      lockedAt: "2027-01-22T13:45:00Z",
      lockedBy: "unit-test",
    });

    const evaluation = evaluateNominations(snapshot, results);

    expect({
      hits: evaluation.hits,
      falsePositives: evaluation.falsePositives,
      missedNominees: evaluation.missedNominees,
      precision: evaluation.precision,
      coverage: evaluation.coverage,
    }).toEqual({
      hits: 8,
      falsePositives: 2,
      missedNominees: 2,
      precision: 0.8,
      coverage: 0.8,
    });
    expect(summarizeNominationEvaluations([evaluation])).toMatchObject({
      categories: 1,
      hits: 8,
      predictions: 10,
      officialNominees: 10,
      precision: 0.8,
      coverage: 0.8,
    });
  });

  it("finds the official winner's exact position", async () => {
    const winnerAggregate = {
      ...referenceCurrentPrediction,
      intention: "winner" as const,
    };
    const payload = createPredictionSnapshotPayload(winnerAggregate, {
      kind: "winner_final",
      cutoffAt: "2026-07-23T23:59:59.999Z",
      timeZone: "Europe/Madrid",
    });
    const snapshot = await lockPredictionSnapshot(payload, {
      id: "winner-final-reference",
      lockedAt,
      lockedBy: "unit-test",
    });
    const officialPayload = createOfficialResultsPayload({
      seasonId: "oscars-2027",
      kind: "winners",
      source: {
        sourceId: "academy",
        sourceUrl: "https://www.oscars.org/reference-fixture",
        author: null,
        publishedAt: "2027-03-15T23:00:00Z",
        capturedAt: "2027-03-15T23:05:00Z",
      },
      entries: [
        {
          categoryId: "best-picture",
          candidateId: "wild-horse-nine",
          filmId: "wild-horse-nine",
          personId: null,
          outcome: "winner",
        },
      ],
      originalData: {
        fixture: true,
        purpose: "hand-calculated winner example",
      },
    });
    const results = await lockOfficialResults(officialPayload, {
      id: "winners-reference",
      lockedAt: "2027-03-15T23:05:00Z",
      lockedBy: "unit-test",
    });

    const evaluation = evaluateWinner(snapshot, results);

    expect(evaluation).toMatchObject({
      officialWinnerId: "wild-horse-nine",
      predictedWinnerId: "the-odyssey",
      winnerWasFirst: false,
      winnerPosition: 3,
      winnerWasPresent: true,
    });
    expect(summarizeWinnerEvaluations([evaluation])).toMatchObject({
      categories: 1,
      firstPlaceHits: 0,
      presentWinners: 1,
      firstPlaceAccuracy: 0,
      presenceCoverage: 1,
    });
  });
});
