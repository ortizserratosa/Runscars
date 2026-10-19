import {
  AGGREGATION_METHOD_VERSION_V4,
  type PredictionAggregateV2,
} from "../aggregation/v2";
import {
  hasIncompleteComparisonDates,
  projectComparableAggregate,
} from "./comparable-projection";

export type SnapshotHistoryEntry = {
  id: string;
  contentHash: string;
  lockedAt: string;
  methodVersion: string;
  schemaVersion: string;
  aggregate: PredictionAggregateV2;
};

export type RealProviderCut = SnapshotHistoryEntry & {
  changedSourceIds: string[];
  comparableProjection: boolean;
  comparisonDateIncomplete: boolean;
};

type ProviderEntryState = {
  candidateId: string;
  appearanceKind: "ordered" | "selection";
  rank: number | null;
  listLength: number;
};

type ProviderState = {
  sourceId: string;
  entries: ProviderEntryState[];
};

function sameScope(
  current: PredictionAggregateV2,
  previous: PredictionAggregateV2,
) {
  return (
    sameEditorialScope(current, previous) &&
    current.methodVersion === previous.methodVersion
  );
}

function sameEditorialScope(
  current: PredictionAggregateV2,
  previous: PredictionAggregateV2,
) {
  return (
    current.seasonId === previous.seasonId &&
    current.categoryId === previous.categoryId &&
    current.intention === previous.intention
  );
}

function entrySort(left: ProviderEntryState, right: ProviderEntryState) {
  const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
  const rightRank = right.rank ?? Number.POSITIVE_INFINITY;
  return (
    leftRank - rightRank ||
    left.appearanceKind.localeCompare(right.appearanceKind, "en") ||
    left.candidateId.localeCompare(right.candidateId, "en")
  );
}

export function effectiveProviderState(
  aggregate: PredictionAggregateV2,
  comparisonDepth = aggregate.methodVersion === AGGREGATION_METHOD_VERSION_V4
    ? aggregate.scoringDepth
    : undefined,
): ProviderState[] {
  return aggregate.sourceLists
    .map((source): ProviderState => {
      const entries = aggregate.ranking.flatMap(
        (candidate): ProviderEntryState[] => {
          const contribution = candidate.sourceContributions.find(
            (item) => item.sourceId === source.sourceId,
          );
          if (!contribution || contribution.appearanceKind === "absent") {
            return [];
          }
          if (
            comparisonDepth !== undefined &&
            contribution.appearanceKind === "ordered" &&
            (contribution.rank === null || contribution.rank > comparisonDepth)
          ) {
            return [];
          }
          return [
            {
              candidateId: candidate.candidateId,
              appearanceKind: contribution.appearanceKind,
              rank: contribution.rank,
              // Appending a tail beyond the common window changes provenance,
              // not v4 scores or the effective provider cut.
              listLength:
                comparisonDepth !== undefined &&
                contribution.appearanceKind === "ordered"
                  ? comparisonDepth
                  : contribution.listLength,
            },
          ];
        },
      );
      entries.sort(entrySort);
      return {
        sourceId: source.sourceId,
        entries,
      };
    })
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId, "en"));
}

export function effectiveProviderStateKey(
  aggregate: PredictionAggregateV2,
): string {
  return JSON.stringify(effectiveProviderState(aggregate));
}

export function changedProviderSourceIds(
  current: PredictionAggregateV2,
  previous: PredictionAggregateV2 | null,
): string[] {
  // Compare editorial positions under the same window across a methodology
  // boundary; changing the formula alone is not an expert updating a ballot.
  const comparisonDepth = current.scoringDepth ?? previous?.scoringDepth;
  const currentState = new Map(
    effectiveProviderState(current, comparisonDepth).map((source) => [
      source.sourceId,
      JSON.stringify(source.entries),
    ]),
  );
  if (!previous || !sameEditorialScope(current, previous)) {
    return [...currentState.keys()].sort((left, right) =>
      left.localeCompare(right, "en"),
    );
  }
  const previousState = new Map(
    effectiveProviderState(previous, comparisonDepth).map((source) => [
      source.sourceId,
      JSON.stringify(source.entries),
    ]),
  );
  return [...new Set([...currentState.keys(), ...previousState.keys()])]
    .filter(
      (sourceId) => currentState.get(sourceId) !== previousState.get(sourceId),
    )
    .sort((left, right) => left.localeCompare(right, "en"));
}

export function hasEffectiveProviderChanges(
  current: PredictionAggregateV2,
  previous: PredictionAggregateV2 | null,
) {
  if (!previous || !sameScope(current, previous)) return true;
  return (
    effectiveProviderStateKey(current) !== effectiveProviderStateKey(previous)
  );
}

export function buildRealProviderCuts(
  snapshots: SnapshotHistoryEntry[],
  captureDates: ReadonlyMap<string, string> = new Map(),
): RealProviderCut[] {
  const ordered = snapshots
    .map((snapshot) => {
      const aggregate = projectComparableAggregate(
        snapshot.aggregate,
        captureDates,
      );
      return {
        ...snapshot,
        aggregate,
        comparableProjection: aggregate !== snapshot.aggregate,
        comparisonDateIncomplete: hasIncompleteComparisonDates(
          snapshot.aggregate,
          captureDates,
        ),
      };
    })
    .sort(
      (left, right) =>
        Date.parse(left.lockedAt) - Date.parse(right.lockedAt) ||
        left.id.localeCompare(right.id, "en"),
    );
  const latestByUtcDay = new Map<
    string,
    SnapshotHistoryEntry & {
      comparableProjection: boolean;
      comparisonDateIncomplete: boolean;
    }
  >();
  for (const snapshot of ordered) {
    latestByUtcDay.set(
      new Date(snapshot.lockedAt).toISOString().slice(0, 10),
      snapshot,
    );
  }
  const cuts: RealProviderCut[] = [];

  for (const snapshot of latestByUtcDay.values()) {
    const previous = cuts.at(-1) ?? null;
    if (
      previous &&
      !hasEffectiveProviderChanges(snapshot.aggregate, previous.aggregate)
    ) {
      continue;
    }
    cuts.push({
      ...snapshot,
      changedSourceIds: changedProviderSourceIds(
        snapshot.aggregate,
        previous?.aggregate ?? null,
      ),
    });
  }

  return cuts;
}
