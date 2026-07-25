import {
  EVALUATION_METHOD_VERSION_V2,
  type LockedPredictionSnapshotV2,
  type OfficialResultsPayloadV2,
} from "./v2";

export type OfficialResultsV2 = {
  id: string;
  payload: OfficialResultsPayloadV2;
};

function assertScope(
  snapshot: LockedPredictionSnapshotV2,
  results: OfficialResultsV2,
) {
  if (snapshot.payload.seasonId !== results.payload.seasonId) {
    throw new Error("Snapshot y resultados pertenecen a temporadas distintas");
  }
}

function officialCandidates(results: OfficialResultsV2, categoryId: string) {
  return results.payload.entries
    .filter((entry) => entry.categoryId === categoryId)
    .map((entry) => entry.categoryCandidateId);
}

export function evaluateNominationsV2(
  snapshot: LockedPredictionSnapshotV2,
  results: OfficialResultsV2,
) {
  assertScope(snapshot, results);
  if (
    snapshot.payload.kind !== "nomination_final" ||
    results.payload.kind !== "nominations"
  ) {
    throw new Error("La evaluación requiere cierres compatibles");
  }
  const predictedCandidateIds = snapshot.payload.selectedCandidateIds;
  const officialNomineeIds = officialCandidates(
    results,
    snapshot.payload.categoryId,
  );
  if (officialNomineeIds.length === 0) {
    throw new Error("No hay nominaciones oficiales para la categoría");
  }
  const predicted = new Set(predictedCandidateIds);
  const official = new Set(officialNomineeIds);
  const hitIds = predictedCandidateIds.filter((id) => official.has(id));
  const falsePositiveIds = predictedCandidateIds.filter(
    (id) => !official.has(id),
  );
  const missedNomineeIds = officialNomineeIds.filter(
    (id) => !predicted.has(id),
  );
  return {
    methodVersion: EVALUATION_METHOD_VERSION_V2,
    seasonId: snapshot.payload.seasonId,
    categoryId: snapshot.payload.categoryId,
    snapshotId: snapshot.id,
    resultSetId: results.id,
    predictedCandidateIds,
    officialNomineeIds,
    hitIds,
    falsePositiveIds,
    missedNomineeIds,
    hits: hitIds.length,
    falsePositives: falsePositiveIds.length,
    missedNominees: missedNomineeIds.length,
    precision:
      predictedCandidateIds.length === 0
        ? 0
        : hitIds.length / predictedCandidateIds.length,
    coverage: hitIds.length / officialNomineeIds.length,
  };
}

export function evaluateWinnerV2(
  snapshot: LockedPredictionSnapshotV2,
  results: OfficialResultsV2,
) {
  assertScope(snapshot, results);
  if (
    snapshot.payload.kind !== "winner_final" ||
    results.payload.kind !== "winners"
  ) {
    throw new Error("La evaluación requiere cierres compatibles");
  }
  const officialWinnerIds = officialCandidates(
    results,
    snapshot.payload.categoryId,
  );
  if (officialWinnerIds.length !== 1) {
    throw new Error("La categoría debe tener un ganador oficial");
  }
  const officialWinnerId = officialWinnerIds[0];
  const index = snapshot.payload.aggregate.ranking.findIndex(
    (candidate) => candidate.candidateId === officialWinnerId,
  );
  const predictedWinnerId = snapshot.payload.selectedCandidateIds[0] ?? null;
  return {
    methodVersion: EVALUATION_METHOD_VERSION_V2,
    seasonId: snapshot.payload.seasonId,
    categoryId: snapshot.payload.categoryId,
    snapshotId: snapshot.id,
    resultSetId: results.id,
    officialWinnerId,
    predictedWinnerId,
    winnerWasFirst: predictedWinnerId === officialWinnerId,
    winnerPosition: index === -1 ? null : index + 1,
    winnerWasPresent: index !== -1,
  };
}
