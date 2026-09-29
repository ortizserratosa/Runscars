import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import type { PredictionAggregateV2 } from "../aggregation/v2";
import { PUBLIC_CATEGORIES, type PublicCategoryId } from "../categories/config";
import { createSupabaseServerClient } from "../supabase/server";
import { loadCaptureDatesForHistory } from "./capture-dates";
import {
  buildRealProviderCuts,
  type RealProviderCut,
  type SnapshotHistoryEntry,
} from "./provider-cuts";
import { projectComparableAggregate } from "./comparable-projection";

const HISTORY_PAGE_SIZE = 25;
const cacheScope = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "unconfigured";

// Cache leaves independently: nesting unstable_cache skips the inner read in
// Next.js. Composition must stay outside a cache so pointer polling can reuse
// the slower immutable-history projection.
export const getCurrentPublicSnapshotPointers = unstable_cache(
  async () => {
    const result = await createSupabaseServerClient()
      .from("current_aggregate_snapshots")
      .select("category_id,snapshot_id")
      .eq("season_id", "oscars-2027")
      .eq("prediction_intention", "nomination")
      .eq("kind", "periodic")
      .in(
        "category_id",
        PUBLIC_CATEGORIES.map((category) => category.id),
      );
    if (result.error) throw new Error(result.error.message);
    return result.data ?? [];
  },
  ["public-snapshot-pointers-v1", cacheScope],
  { revalidate: 60 },
);

export type PublicCutSummary = Omit<RealProviderCut, "aggregate">;
type SnapshotReference = Pick<SnapshotHistoryEntry, "id" | "lockedAt">;
export type PublicCandidate = {
  id: string;
  label: string;
  filmId: string | null;
};
export type PublicHistorySelection = {
  cuts: PublicCutSummary[];
  selectedIndex: number;
  selected: RealProviderCut | null;
  previous: RealProviderCut | null;
  sourceNames: Record<string, string>;
  currentCandidates: PublicCandidate[];
};
type PublicHistoryIndex = {
  snapshots: SnapshotReference[];
  cuts: PublicCutSummary[];
  recent: RealProviderCut[];
  captures: [string, string][];
  sourceNames: Record<string, string>;
  currentCandidates: PublicCandidate[];
};
function emptyHistory(): PublicHistoryIndex {
  return {
    snapshots: [],
    cuts: [],
    recent: [],
    captures: [],
    sourceNames: {},
    currentCandidates: [],
  };
}
type SnapshotRow = {
  id: string;
  content_hash: string;
  locked_at: string;
  method_version: string;
  schema_version: string;
  payload: unknown;
};
const snapshotColumns =
  "id,content_hash,locked_at,method_version,schema_version,payload";

function snapshotEntry(
  row: SnapshotRow,
  categoryId: PublicCategoryId,
): SnapshotHistoryEntry | null {
  const payload = row.payload as { aggregate?: PredictionAggregateV2 } | null;
  const aggregate = payload?.aggregate;
  if (
    row.schema_version !== "runscars-snapshot-v2" ||
    !aggregate ||
    aggregate.methodVersion !== row.method_version ||
    aggregate.categoryId !== categoryId ||
    aggregate.seasonId !== "oscars-2027" ||
    aggregate.intention !== "nomination"
  ) {
    return null;
  }
  return {
    id: row.id,
    contentHash: row.content_hash,
    lockedAt: row.locked_at,
    methodVersion: row.method_version,
    schemaVersion: row.schema_version,
    aggregate,
  };
}

export function selectedPublicCutIndex(
  snapshots: SnapshotReference[],
  cuts: PublicCutSummary[],
  selectedSnapshotId?: string,
) {
  const requestedIndex = selectedSnapshotId
    ? cuts.findIndex((cut) => cut.id === selectedSnapshotId)
    : -1;
  if (requestedIndex >= 0) return requestedIndex;
  const requested = selectedSnapshotId
    ? snapshots.find((snapshot) => snapshot.id === selectedSnapshotId)
    : null;
  return requested
    ? Math.max(
        0,
        cuts.findLastIndex(
          (cut) => Date.parse(cut.lockedAt) <= Date.parse(requested.lockedAt),
        ),
      )
    : Math.max(0, cuts.length - 1);
}

async function databaseHistoryIndex(
  categoryId: PublicCategoryId,
  currentSnapshotId: string,
): Promise<PublicHistoryIndex> {
  const supabase = createSupabaseServerClient();
  const pointer = await supabase
    .from("aggregate_snapshots")
    .select("id,locked_at,schema_version")
    .eq("id", currentSnapshotId)
    .eq("season_id", "oscars-2027")
    .eq("category_id", categoryId)
    .eq("prediction_intention", "nomination")
    .eq("kind", "periodic")
    .single();
  if (pointer.error) throw new Error(pointer.error.message);
  if (!pointer.data) throw new Error("No se pudo leer el snapshot vigente");
  if (pointer.data.schema_version !== "runscars-snapshot-v2") {
    return emptyHistory();
  }

  const snapshots: SnapshotReference[] = [];
  const latestByDay = new Map<string, SnapshotHistoryEntry>();
  for (let offset = 0; ; offset += HISTORY_PAGE_SIZE) {
    const result = await supabase
      .from("aggregate_snapshots")
      .select(snapshotColumns)
      .eq("season_id", "oscars-2027")
      .eq("category_id", categoryId)
      .eq("prediction_intention", "nomination")
      .eq("kind", "periodic")
      .eq("schema_version", "runscars-snapshot-v2")
      .lte("locked_at", pointer.data.locked_at)
      .order("locked_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + HISTORY_PAGE_SIZE - 1);
    if (result.error) throw new Error(result.error.message);
    const rows = result.data ?? [];
    for (const row of rows) {
      const entry = snapshotEntry(row, categoryId);
      if (!entry) continue;
      snapshots.push({ id: entry.id, lockedAt: entry.lockedAt });
      // Projection is per snapshot: only the last envelope of a UTC day can
      // affect the public series. Keep all IDs for historical URL resolution.
      const day = new Date(entry.lockedAt).toISOString().slice(0, 10);
      const previous = latestByDay.get(day);
      if (
        !previous ||
        Date.parse(entry.lockedAt) > Date.parse(previous.lockedAt) ||
        (Date.parse(entry.lockedAt) === Date.parse(previous.lockedAt) &&
          entry.id.localeCompare(previous.id, "en") > 0)
      ) {
        latestByDay.set(day, entry);
      }
    }
    if (rows.length < HISTORY_PAGE_SIZE) break;
  }
  if (!snapshots.some((snapshot) => snapshot.id === currentSnapshotId)) {
    return emptyHistory();
  }
  const daily = [...latestByDay.values()];
  const captures = await loadCaptureDatesForHistory(supabase, daily);
  const cuts = buildRealProviderCuts(daily, captures);
  return {
    snapshots,
    cuts: cuts.map((cut) => ({
      id: cut.id,
      contentHash: cut.contentHash,
      lockedAt: cut.lockedAt,
      methodVersion: cut.methodVersion,
      schemaVersion: cut.schemaVersion,
      changedSourceIds: cut.changedSourceIds,
      comparableProjection: cut.comparableProjection,
      comparisonDateIncomplete: cut.comparisonDateIncomplete,
    })),
    // Cache a compact index and the current comparison, not every large payload.
    recent: cuts.slice(-2),
    captures: [...captures],
    sourceNames: Object.fromEntries(
      cuts.flatMap((cut) =>
        cut.aggregate.sourceLists.map((source) => [
          source.sourceId,
          source.sourceName,
        ]),
      ),
    ),
    currentCandidates: (cuts.at(-1)?.aggregate.ranking ?? []).map(
      (candidate) => ({
        id: candidate.candidateId,
        label: candidate.label,
        filmId: candidate.film?.id ?? null,
      }),
    ),
  };
}

const cachedHistoryIndex = unstable_cache(
  databaseHistoryIndex,
  ["public-history-index-v1", cacheScope],
  // The pointer is part of the cache key, so a new cut is visible immediately.
  // Retry unavailable public capture dates instead of caching them forever.
  { revalidate: 3600 },
);

const cachedSnapshot = unstable_cache(
  async (categoryId: PublicCategoryId, snapshotId: string) => {
    const result = await createSupabaseServerClient()
      .from("aggregate_snapshots")
      .select(snapshotColumns)
      .eq("id", snapshotId)
      .eq("season_id", "oscars-2027")
      .eq("category_id", categoryId)
      .eq("prediction_intention", "nomination")
      .eq("kind", "periodic")
      .single();
    if (result.error) throw new Error(result.error.message);
    const entry = result.data && snapshotEntry(result.data, categoryId);
    if (!entry) throw new Error("No se pudo leer el corte histórico");
    return entry;
  },
  ["public-history-snapshot-v1", cacheScope],
  { revalidate: 3600 },
);

export const getPublicHistorySelection = cache(async function (
  categoryId: PublicCategoryId,
  currentSnapshotId: string,
  selectedSnapshotId?: string,
): Promise<PublicHistorySelection> {
  const history = await cachedHistoryIndex(categoryId, currentSnapshotId);
  const selectedIndex = selectedPublicCutIndex(
    history.snapshots,
    history.cuts,
    selectedSnapshotId,
  );
  const loadCut = async (index: number): Promise<RealProviderCut | null> => {
    const summary = history.cuts[index];
    if (!summary) return null;
    const recent = history.recent.find((cut) => cut.id === summary.id);
    if (recent) return recent;
    const snapshot = await cachedSnapshot(categoryId, summary.id);
    return {
      ...summary,
      aggregate: projectComparableAggregate(
        snapshot.aggregate,
        new Map(history.captures),
      ),
    };
  };
  const [selected, previous] = await Promise.all([
    loadCut(selectedIndex),
    loadCut(selectedIndex - 1),
  ]);
  return {
    cuts: history.cuts,
    selectedIndex,
    selected,
    previous,
    sourceNames: history.sourceNames,
    currentCandidates: history.currentCandidates,
  };
});
