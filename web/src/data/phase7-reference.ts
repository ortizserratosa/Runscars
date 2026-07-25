import {
  createPredictionSnapshotPayload,
  type LockedPredictionSnapshot,
} from "../lib/snapshots";
import { referenceCurrentPrediction } from "./phase6-reference";

const payload = createPredictionSnapshotPayload(referenceCurrentPrediction, {
  kind: "periodic",
  cutoffAt: "2026-07-23T23:59:59.999Z",
  timeZone: "Europe/Madrid",
});

export const referenceLockedSnapshot: LockedPredictionSnapshot = {
  id: "periodic-oscars-2027-best-picture-2026-07-23",
  contentHash:
    "1f57ec9b3076e01c890d9e42c6a5714a495675a34b4ae50dee52e1b60b3f24b1",
  lockedAt: "2026-07-24T12:00:00.000Z",
  lockedBy: "phase-7-reference-fixture",
  correctsSnapshotId: null,
  correctionReason: null,
  payload,
};
