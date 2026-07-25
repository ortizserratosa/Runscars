import type { PredictionAggregate } from "../aggregation";

export const SNAPSHOT_SCHEMA_VERSION = "runscars-snapshot-v1";
export const EVALUATION_METHOD_VERSION = "runscars-evaluation-v1";

export type PredictionSnapshotKind =
  "periodic" | "nomination_final" | "winner_final";

export type PredictionSnapshotPayload = {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  kind: PredictionSnapshotKind;
  seasonId: string;
  categoryId: string;
  intention: "nomination" | "winner";
  cutoffAt: string;
  timeZone: string;
  methodVersion: PredictionAggregate["methodVersion"];
  activeSourceIds: string[];
  includedObservationIds: string[];
  excludedObservationIds: string[];
  selectionSize: number | null;
  selectedCandidateIds: string[];
  aggregate: PredictionAggregate;
};

export type LockedPredictionSnapshot = {
  id: string;
  contentHash: string;
  lockedAt: string;
  lockedBy: string;
  correctsSnapshotId: string | null;
  correctionReason: string | null;
  payload: PredictionSnapshotPayload;
};

export type OfficialResultKind = "nominations" | "winners";
export type OfficialResultOutcome = "nominee" | "winner";

export type OfficialResultEntry = {
  categoryId: string;
  candidateId: string;
  filmId: string | null;
  personId: string | null;
  outcome: OfficialResultOutcome;
};

export type OfficialResultsPayload = {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  seasonId: string;
  kind: OfficialResultKind;
  source: {
    sourceId: string;
    sourceUrl: string;
    author: string | null;
    publishedAt: string;
    capturedAt: string;
  };
  entries: OfficialResultEntry[];
  originalData: Record<string, unknown>;
};

export type LockedOfficialResults = {
  id: string;
  contentHash: string;
  lockedAt: string;
  lockedBy: string;
  correctsResultSetId: string | null;
  correctionReason: string | null;
  payload: OfficialResultsPayload;
};

export type NominationEvaluation = {
  methodVersion: typeof EVALUATION_METHOD_VERSION;
  seasonId: string;
  categoryId: string;
  snapshotId: string;
  resultSetId: string;
  predictedCandidateIds: string[];
  officialNomineeIds: string[];
  hitIds: string[];
  falsePositiveIds: string[];
  missedNomineeIds: string[];
  hits: number;
  falsePositives: number;
  missedNominees: number;
  precision: number;
  coverage: number;
};

export type WinnerEvaluation = {
  methodVersion: typeof EVALUATION_METHOD_VERSION;
  seasonId: string;
  categoryId: string;
  snapshotId: string;
  resultSetId: string;
  officialWinnerId: string;
  predictedWinnerId: string | null;
  winnerWasFirst: boolean;
  winnerPosition: number | null;
  winnerWasPresent: boolean;
};

export type NominationEvaluationSummary = {
  methodVersion: typeof EVALUATION_METHOD_VERSION;
  categories: number;
  hits: number;
  predictions: number;
  officialNominees: number;
  falsePositives: number;
  missedNominees: number;
  precision: number;
  coverage: number;
};

export type WinnerEvaluationSummary = {
  methodVersion: typeof EVALUATION_METHOD_VERSION;
  categories: number;
  firstPlaceHits: number;
  presentWinners: number;
  firstPlaceAccuracy: number;
  presenceCoverage: number;
};
