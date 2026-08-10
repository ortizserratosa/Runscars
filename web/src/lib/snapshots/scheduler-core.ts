import {
  aggregatePredictions,
  type PredictionObservation,
} from "../aggregation";
import {
  createPredictionSnapshotPayload,
  lockPredictionSnapshot,
  type LockedPredictionSnapshot,
  type PredictionSnapshotKind,
} from ".";
import {
  aggregatePredictionsV2,
  type PredictionAggregateV2,
  type PredictionObservationV2,
} from "../aggregation/v2";
import { hasEffectiveProviderChanges } from "./provider-cuts";
import {
  createPredictionSnapshotPayloadV2,
  lockPredictionSnapshotV2,
  type LockedPredictionSnapshotV2,
} from "./v2";

export type SnapshotSchedule = {
  id: string;
  seasonId: string;
  categoryId: string;
  intention: "nomination" | "winner";
  kind: PredictionSnapshotKind;
  timeZone: string;
};

export type ScheduledSnapshotResult =
  | {
      scheduleId: string;
      status: "created" | "unchanged";
      snapshotId: string;
      contentHash: string;
    }
  | {
      scheduleId: string;
      status: "skipped";
      reason: string;
    }
  | {
      scheduleId: string;
      status: "failed";
      error: string;
    };

export interface SnapshotSchedulerRepository {
  activeSchedules(): Promise<SnapshotSchedule[]>;
  predictionObservations(
    schedule: SnapshotSchedule,
  ): Promise<PredictionObservation[]>;
  lock(snapshot: LockedPredictionSnapshot): Promise<boolean>;
}

export interface SnapshotSchedulerRepositoryV2 {
  activeSchedules(): Promise<SnapshotSchedule[]>;
  predictionObservationsV2(
    schedule: SnapshotSchedule,
  ): Promise<PredictionObservationV2[]>;
  currentSnapshotV2(schedule: SnapshotSchedule): Promise<{
    snapshotId: string;
    contentHash: string;
    aggregate: PredictionAggregateV2;
  } | null>;
  lockV2(snapshot: LockedPredictionSnapshotV2): Promise<boolean>;
}

export async function runScheduledSnapshots(
  repository: SnapshotSchedulerRepository,
  now = new Date(),
): Promise<ScheduledSnapshotResult[]> {
  const schedules = await repository.activeSchedules();
  const lockedAt = now.toISOString();
  const results: ScheduledSnapshotResult[] = [];

  for (const schedule of schedules) {
    try {
      const observations = await repository.predictionObservations(schedule);
      if (observations.length === 0) {
        results.push({
          scheduleId: schedule.id,
          status: "skipped",
          reason: "No hay observaciones publicables",
        });
        continue;
      }
      const aggregate = aggregatePredictions(observations, {
        seasonId: schedule.seasonId,
        categoryId: schedule.categoryId,
        intention: schedule.intention,
        cutoffDate: lockedAt,
      });
      if (aggregate.includedObservationIds.length === 0) {
        results.push({
          scheduleId: schedule.id,
          status: "skipped",
          reason: "No hay listas válidas para bloquear",
        });
        continue;
      }
      const payload = createPredictionSnapshotPayload(aggregate, {
        kind: schedule.kind,
        cutoffAt: lockedAt,
        timeZone: schedule.timeZone,
      });
      const snapshot = await lockPredictionSnapshot(payload, {
        lockedAt,
        lockedBy: "vercel-cron:snapshots-weekly",
      });
      const created = await repository.lock(snapshot);
      results.push({
        scheduleId: schedule.id,
        status: created ? "created" : "unchanged",
        snapshotId: snapshot.id,
        contentHash: snapshot.contentHash,
      });
    } catch (error) {
      results.push({
        scheduleId: schedule.id,
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Fallo desconocido al crear el snapshot",
      });
    }
  }

  return results;
}

export async function runScheduledSnapshotsV2(
  repository: SnapshotSchedulerRepositoryV2,
  now = new Date(),
): Promise<ScheduledSnapshotResult[]> {
  const schedules = await repository.activeSchedules();
  const lockedAt = now.toISOString();
  const results: ScheduledSnapshotResult[] = [];

  for (const schedule of schedules) {
    try {
      const observations = await repository.predictionObservationsV2(schedule);
      if (observations.length === 0) {
        results.push({
          scheduleId: schedule.id,
          status: "skipped",
          reason: "No hay observaciones v2 publicables",
        });
        continue;
      }
      const aggregate = aggregatePredictionsV2(observations, {
        seasonId: schedule.seasonId,
        categoryId: schedule.categoryId,
        intention: schedule.intention,
        cutoffDate: lockedAt,
      });
      if (aggregate.includedObservationIds.length === 0) {
        results.push({
          scheduleId: schedule.id,
          status: "skipped",
          reason: "No hay listas v2 válidas para bloquear",
        });
        continue;
      }
      const current = await repository.currentSnapshotV2(schedule);
      if (
        current &&
        !hasEffectiveProviderChanges(aggregate, current.aggregate)
      ) {
        results.push({
          scheduleId: schedule.id,
          status: "unchanged",
          snapshotId: current.snapshotId,
          contentHash: current.contentHash,
        });
        continue;
      }
      const payload = createPredictionSnapshotPayloadV2(aggregate, {
        kind: schedule.kind,
        cutoffAt: lockedAt,
        timeZone: schedule.timeZone,
      });
      const snapshot = await lockPredictionSnapshotV2(payload, {
        lockedAt,
        lockedBy: "vercel-cron:snapshots-on-provider-change-v2",
      });
      const created = await repository.lockV2(snapshot);
      results.push({
        scheduleId: schedule.id,
        status: created ? "created" : "unchanged",
        snapshotId: snapshot.id,
        contentHash: snapshot.contentHash,
      });
    } catch (error) {
      results.push({
        scheduleId: schedule.id,
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Fallo desconocido al crear el snapshot v2",
      });
    }
  }

  return results;
}
