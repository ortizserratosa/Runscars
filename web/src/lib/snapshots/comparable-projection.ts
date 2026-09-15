import {
  AGGREGATION_METHOD_VERSION_V2,
  AGGREGATION_METHOD_VERSION_V3,
  type PredictionAggregateV2,
  type PredictionCandidateAggregateV2,
  type PredictionSourceContributionV2,
  type PredictionSourceListV2,
} from "../aggregation/v2";
import { isPredictionFresh } from "../aggregation/freshness";

function median(values: number[]) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function stableDecimal(value: number) {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function predictionSort(
  left: PredictionCandidateAggregateV2,
  right: PredictionCandidateAggregateV2,
) {
  if (right.score !== left.score) return right.score - left.score;
  if (right.appearances !== left.appearances) {
    return right.appearances - left.appearances;
  }
  const leftMedian = left.medianRank ?? Number.POSITIVE_INFINITY;
  const rightMedian = right.medianRank ?? Number.POSITIVE_INFINITY;
  if (leftMedian !== rightMedian) return leftMedian - rightMedian;
  if (right.firstPlaceCount !== left.firstPlaceCount) {
    return right.firstPlaceCount - left.firstPlaceCount;
  }
  return left.label.localeCompare(right.label, "en");
}

function sourceObservationIds(source: PredictionSourceListV2) {
  return [...source.orderedObservationIds, ...source.selectionObservationIds];
}

function sourceIsFresh(
  source: PredictionSourceListV2,
  cutoffDate: string,
  captureDates: ReadonlyMap<string, string>,
) {
  if (source.publishedAt !== null) {
    return (
      !Number.isFinite(Date.parse(source.publishedAt)) ||
      isPredictionFresh(source.publishedAt, cutoffDate)
    );
  }
  const ids = sourceObservationIds(source);
  const captures = ids.map((id) => captureDates.get(id));
  // A missing capture cannot prove the whole source stale; retain its vote.
  if (
    captures.length === 0 ||
    captures.some((date) => !date || !Number.isFinite(Date.parse(date)))
  ) {
    return true;
  }
  return captures.some((date) => isPredictionFresh(date!, cutoffDate));
}

export function hasIncompleteComparisonDates(
  aggregate: PredictionAggregateV2,
  captureDates: ReadonlyMap<string, string>,
) {
  if (aggregate.methodVersion !== AGGREGATION_METHOD_VERSION_V2) {
    return false;
  }
  return aggregate.sourceLists.some((source) => {
    if (source.publishedAt !== null) {
      return !Number.isFinite(Date.parse(source.publishedAt));
    }
    const ids = sourceObservationIds(source);
    return (
      ids.length === 0 ||
      ids.some((id) => {
        const date = captureDates.get(id);
        return !date || !Number.isFinite(Date.parse(date));
      })
    );
  });
}

function recalculateCandidate(
  candidate: PredictionCandidateAggregateV2,
  sourceIds: Set<string>,
  applicableSourceCount: number,
  orderedSourceCount: number,
): PredictionCandidateAggregateV2 | null {
  const sourceContributions = candidate.sourceContributions
    .filter((source) => sourceIds.has(source.sourceId))
    .map((source): PredictionSourceContributionV2 => ({
      ...source,
      points:
        source.rank !== null && source.listLength > 0
          ? stableDecimal(
              (source.listLength - source.rank + 1) / source.listLength,
            )
          : 0,
    }));
  const appearances = sourceContributions.filter(
    (source) => source.appeared,
  ).length;
  if (appearances === 0) return null;

  const ranks = sourceContributions.flatMap((source) =>
    source.rank === null ? [] : [source.rank],
  );
  const score = stableDecimal(
    orderedSourceCount === 0
      ? 0
      : sourceContributions.reduce(
          (sum, contribution) => sum + contribution.points,
          0,
        ) / orderedSourceCount,
  );

  return {
    ...candidate,
    score,
    scoreOutOf100: score * 100,
    appearances,
    coverage: appearances / applicableSourceCount,
    applicableSourceCount,
    orderedSourceCount,
    meanRank:
      ranks.length === 0
        ? null
        : ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length,
    medianRank: median(ranks),
    topFiveCount: ranks.filter((rank) => rank <= 5).length,
    firstPlaceCount: ranks.filter((rank) => rank === 1).length,
    position: 0,
    movement: null,
    sourceContributions,
  };
}

/** Rebuilds the public v2 history under the v3 freshness rule at each cut date. */
export function projectComparableAggregate(
  aggregate: PredictionAggregateV2,
  captureDates: ReadonlyMap<string, string> = new Map(),
): PredictionAggregateV2 {
  if (aggregate.methodVersion !== AGGREGATION_METHOD_VERSION_V2) {
    return aggregate;
  }

  const sourceLists = aggregate.sourceLists.filter((source) =>
    sourceIsFresh(source, aggregate.cutoffDate, captureDates),
  );
  const sourceIds = new Set(sourceLists.map((source) => source.sourceId));
  const orderedSourceCount = sourceLists.filter(
    (source) => source.listLength !== null,
  ).length;
  const ranking = aggregate.ranking.flatMap((candidate) => {
    const recalculated = recalculateCandidate(
      candidate,
      sourceIds,
      sourceLists.length,
      orderedSourceCount,
    );
    return recalculated ? [recalculated] : [];
  });
  ranking.sort(predictionSort);
  ranking.forEach((candidate, index) => {
    candidate.position = index + 1;
  });

  const includedObservationIds = sourceLists
    .flatMap((source) => [
      ...source.orderedObservationIds,
      ...source.selectionObservationIds,
    ])
    .sort();
  const included = new Set(includedObservationIds);
  const excludedObservationIds = [
    ...new Set([
      ...aggregate.excludedObservationIds,
      ...aggregate.includedObservationIds.filter((id) => !included.has(id)),
    ]),
  ].sort();

  return {
    ...aggregate,
    methodVersion: AGGREGATION_METHOD_VERSION_V3,
    isConsensus: orderedSourceCount >= aggregate.minimumOrderedSources,
    orderedSourceCount,
    applicableSourceCount: sourceLists.length,
    sourceLists,
    ranking,
    includedObservationIds,
    excludedObservationIds,
  };
}
