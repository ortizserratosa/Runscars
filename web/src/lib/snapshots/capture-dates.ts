import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AGGREGATION_METHOD_VERSION_V2 } from "../aggregation/v2";
import type { Database } from "../../types/database.generated";
import type { SnapshotHistoryEntry } from "./provider-cuts";

const OBSERVATION_BATCH_SIZE = 200;

type ObservationRow = Pick<
  Database["public"]["Tables"]["professional_observations"]["Row"],
  "id" | "captured_at"
>;

type PublicSupabaseClient = SupabaseClient | SupabaseClient<Database>;

function undatedObservationIds(snapshots: readonly SnapshotHistoryEntry[]) {
  const ids = new Set<number>();

  for (const snapshot of snapshots) {
    if (snapshot.aggregate.methodVersion !== AGGREGATION_METHOD_VERSION_V2) {
      continue;
    }

    for (const source of snapshot.aggregate.sourceLists) {
      if (source.publishedAt !== null) continue;

      for (const id of [
        ...source.orderedObservationIds,
        ...source.selectionObservationIds,
      ]) {
        if (!/^[1-9]\d*$/.test(id)) continue;
        const numericId = Number(id);
        if (Number.isSafeInteger(numericId)) ids.add(numericId);
      }
    }
  }

  return [...ids].sort((left, right) => left - right);
}

/**
 * Returns public observation capture dates needed to date undated v2 lists.
 * Missing, hidden, or invalid rows remain absent so the projection can retain
 * their historical contribution instead of guessing a capture date.
 */
export async function loadCaptureDatesForHistory(
  supabase: PublicSupabaseClient,
  snapshots: readonly SnapshotHistoryEntry[],
): Promise<Map<string, string>> {
  const ids = undatedObservationIds(snapshots);
  const captures = new Map<string, string>();
  if (ids.length === 0) return captures;

  // Both typed and untyped public clients query the same fixed table/columns.
  const client = supabase as SupabaseClient<Database>;
  for (let offset = 0; offset < ids.length; offset += OBSERVATION_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + OBSERVATION_BATCH_SIZE);
    try {
      const { data, error } = await client
        .from("professional_observations")
        .select("id,captured_at")
        .in("id", batch);
      if (error || !data) continue;

      const requested = new Set(batch);
      for (const row of data as ObservationRow[]) {
        if (
          requested.has(row.id) &&
          typeof row.captured_at === "string" &&
          Number.isFinite(Date.parse(row.captured_at))
        ) {
          captures.set(String(row.id), row.captured_at);
        }
      }
    } catch {
      // A failed public/RLS read cannot prove when these votes expired.
    }
  }

  return captures;
}
