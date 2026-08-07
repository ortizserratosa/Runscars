import type { PredictionAggregateV2 } from "../aggregation/v2";

function sameScope(
  current: PredictionAggregateV2,
  previous: PredictionAggregateV2,
) {
  return (
    current.seasonId === previous.seasonId &&
    current.categoryId === previous.categoryId &&
    current.intention === previous.intention &&
    current.methodVersion === previous.methodVersion
  );
}

export function compareSnapshotMovements(
  current: PredictionAggregateV2,
  previous: PredictionAggregateV2 | null,
): PredictionAggregateV2 {
  if (!previous) return current;
  if (!sameScope(current, previous)) {
    throw new Error(
      "No se pueden comparar snapshots de alcance o metodología distintos",
    );
  }

  const previousPositions = new Map(
    previous.ranking.map((candidate) => [
      candidate.candidateId,
      candidate.position,
    ]),
  );

  return {
    ...current,
    ranking: current.ranking.map((candidate) => {
      const previousPosition = previousPositions.get(candidate.candidateId);
      return {
        ...candidate,
        movement:
          previousPosition === undefined
            ? null
            : previousPosition - candidate.position,
      };
    }),
  };
}
