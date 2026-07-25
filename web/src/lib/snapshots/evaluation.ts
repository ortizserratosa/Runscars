import {
  EVALUATION_METHOD_VERSION,
  type LockedOfficialResults,
  type LockedPredictionSnapshot,
  type NominationEvaluation,
  type NominationEvaluationSummary,
  type WinnerEvaluation,
  type WinnerEvaluationSummary,
} from "./types";

function assertSameScope(
  snapshot: LockedPredictionSnapshot,
  results: LockedOfficialResults,
) {
  if (snapshot.payload.seasonId !== results.payload.seasonId) {
    throw new Error(
      "El snapshot y los resultados pertenecen a temporadas distintas",
    );
  }
}

function officialCandidates(
  results: LockedOfficialResults,
  categoryId: string,
) {
  return results.payload.entries
    .filter((entry) => entry.categoryId === categoryId)
    .map((entry) => entry.candidateId);
}

export function evaluateNominations(
  snapshot: LockedPredictionSnapshot,
  results: LockedOfficialResults,
): NominationEvaluation {
  assertSameScope(snapshot, results);
  if (
    snapshot.payload.kind !== "nomination_final" ||
    snapshot.payload.intention !== "nomination" ||
    results.payload.kind !== "nominations"
  ) {
    throw new Error(
      "La evaluación de nominaciones exige un cierre y resultados compatibles",
    );
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
    methodVersion: EVALUATION_METHOD_VERSION,
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
    precision: hitIds.length / predictedCandidateIds.length,
    coverage: hitIds.length / officialNomineeIds.length,
  };
}

export function evaluateWinner(
  snapshot: LockedPredictionSnapshot,
  results: LockedOfficialResults,
): WinnerEvaluation {
  assertSameScope(snapshot, results);
  if (
    snapshot.payload.kind !== "winner_final" ||
    snapshot.payload.intention !== "winner" ||
    results.payload.kind !== "winners"
  ) {
    throw new Error(
      "La evaluación de ganador exige un cierre y resultados compatibles",
    );
  }

  const officialWinnerIds = officialCandidates(
    results,
    snapshot.payload.categoryId,
  );
  if (officialWinnerIds.length !== 1) {
    throw new Error("La categoría debe tener exactamente un ganador oficial");
  }
  const officialWinnerId = officialWinnerIds[0];
  const index = snapshot.payload.aggregate.ranking.findIndex(
    (candidate) => candidate.filmId === officialWinnerId,
  );
  const winnerPosition = index === -1 ? null : index + 1;
  const predictedWinnerId = snapshot.payload.selectedCandidateIds[0] ?? null;

  return {
    methodVersion: EVALUATION_METHOD_VERSION,
    seasonId: snapshot.payload.seasonId,
    categoryId: snapshot.payload.categoryId,
    snapshotId: snapshot.id,
    resultSetId: results.id,
    officialWinnerId,
    predictedWinnerId,
    winnerWasFirst: predictedWinnerId === officialWinnerId,
    winnerPosition,
    winnerWasPresent: winnerPosition !== null,
  };
}

export function summarizeNominationEvaluations(
  evaluations: NominationEvaluation[],
): NominationEvaluationSummary {
  const hits = evaluations.reduce((sum, item) => sum + item.hits, 0);
  const predictions = evaluations.reduce(
    (sum, item) => sum + item.predictedCandidateIds.length,
    0,
  );
  const officialNominees = evaluations.reduce(
    (sum, item) => sum + item.officialNomineeIds.length,
    0,
  );
  const falsePositives = evaluations.reduce(
    (sum, item) => sum + item.falsePositives,
    0,
  );
  const missedNominees = evaluations.reduce(
    (sum, item) => sum + item.missedNominees,
    0,
  );

  return {
    methodVersion: EVALUATION_METHOD_VERSION,
    categories: evaluations.length,
    hits,
    predictions,
    officialNominees,
    falsePositives,
    missedNominees,
    precision: predictions === 0 ? 0 : hits / predictions,
    coverage: officialNominees === 0 ? 0 : hits / officialNominees,
  };
}

export function summarizeWinnerEvaluations(
  evaluations: WinnerEvaluation[],
): WinnerEvaluationSummary {
  const firstPlaceHits = evaluations.filter(
    (item) => item.winnerWasFirst,
  ).length;
  const presentWinners = evaluations.filter(
    (item) => item.winnerWasPresent,
  ).length;

  return {
    methodVersion: EVALUATION_METHOD_VERSION,
    categories: evaluations.length,
    firstPlaceHits,
    presentWinners,
    firstPlaceAccuracy:
      evaluations.length === 0 ? 0 : firstPlaceHits / evaluations.length,
    presenceCoverage:
      evaluations.length === 0 ? 0 : presentWinners / evaluations.length,
  };
}
