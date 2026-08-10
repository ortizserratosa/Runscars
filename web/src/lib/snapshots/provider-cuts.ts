import type { PredictionAggregateV2 } from "../aggregation/v2";

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
    current.seasonId === previous.seasonId &&
    current.categoryId === previous.categoryId &&
    current.intention === previous.intention &&
    current.methodVersion === previous.methodVersion
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
          return [
            {
              candidateId: candidate.candidateId,
              appearanceKind: contribution.appearanceKind,
              rank: contribution.rank,
              listLength: contribution.listLength,
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
  const currentState = new Map(
    effectiveProviderState(current).map((source) => [
      source.sourceId,
      JSON.stringify(source.entries),
    ]),
  );
  if (!previous || !sameScope(current, previous)) {
    return [...currentState.keys()].sort((left, right) =>
      left.localeCompare(right, "en"),
    );
  }
  const previousState = new Map(
    effectiveProviderState(previous).map((source) => [
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
): RealProviderCut[] {
  const ordered = [...snapshots].sort(
    (left, right) =>
      Date.parse(left.lockedAt) - Date.parse(right.lockedAt) ||
      left.id.localeCompare(right.id, "en"),
  );
  const latestByUtcDay = new Map<string, SnapshotHistoryEntry>();
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
