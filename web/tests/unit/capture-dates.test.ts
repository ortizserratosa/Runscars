import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AGGREGATION_METHOD_VERSION_V2,
  AGGREGATION_METHOD_VERSION_V3,
  type PredictionAggregateV2,
} from "../../src/lib/aggregation/v2";
import { loadCaptureDatesForHistory } from "../../src/lib/snapshots/capture-dates";
import type { SnapshotHistoryEntry } from "../../src/lib/snapshots/provider-cuts";

vi.mock("server-only", () => ({}));

function snapshot(
  methodVersion: PredictionAggregateV2["methodVersion"],
  sourceLists: PredictionAggregateV2["sourceLists"],
): SnapshotHistoryEntry {
  return {
    id: "snapshot",
    contentHash: "hash",
    lockedAt: "2026-08-01T00:00:00Z",
    methodVersion,
    schemaVersion: "v2",
    aggregate: {
      methodVersion,
      seasonId: "season",
      categoryId: "best-picture",
      intention: "nomination",
      cutoffDate: "2026-08-01T00:00:00Z",
      isConsensus: false,
      minimumOrderedSources: 4,
      orderedSourceCount: 0,
      applicableSourceCount: 0,
      sourceLists,
      ranking: [],
      includedObservationIds: [],
      excludedObservationIds: [],
    },
  };
}

function source(
  publishedAt: string | null,
  orderedObservationIds: string[],
  selectionObservationIds: string[] = [],
): PredictionAggregateV2["sourceLists"][number] {
  return {
    sourceId: "source",
    sourceName: "Source",
    publicationId: "publication",
    publicationUrl: "https://example.com",
    publishedAt,
    listLength: orderedObservationIds.length || null,
    orderedObservationIds,
    selectionObservationIds,
  };
}

describe("public capture dates for comparable history", () => {
  it("deduplicates undated v2 IDs and limits each public query to 200 rows", async () => {
    const batches: number[][] = [];
    const client = {
      from(table: string) {
        expect(table).toBe("professional_observations");
        return {
          select(columns: string) {
            expect(columns).toBe("id,captured_at");
            return {
              async in(column: string, ids: number[]) {
                expect(column).toBe("id");
                batches.push(ids);
                return {
                  data: [
                    ...ids.map((id) => ({
                      id,
                      captured_at:
                        id === 2 ? "invalid" : "2026-07-01T00:00:00Z",
                    })),
                    { id: 999, captured_at: "2026-07-01T00:00:00Z" },
                  ],
                  error: null,
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;
    const ids = Array.from({ length: 205 }, (_, index) => String(index + 1));

    const captures = await loadCaptureDatesForHistory(client, [
      snapshot(AGGREGATION_METHOD_VERSION_V2, [
        source(null, ids.slice(0, 200), ["1", "0", "bad"]),
        source("2026-07-01T00:00:00Z", ["500"]),
      ]),
      snapshot(AGGREGATION_METHOD_VERSION_V2, [
        source(null, ["200", ...ids.slice(200)]),
      ]),
      snapshot(AGGREGATION_METHOD_VERSION_V3, [source(null, ["501"])]),
    ]);

    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(200);
    expect(batches[1]).toEqual([201, 202, 203, 204, 205]);
    expect(captures.size).toBe(204);
    expect(captures.get("1")).toBe("2026-07-01T00:00:00Z");
    expect(captures.has("2")).toBe(false);
    expect(captures.has("500")).toBe(false);
    expect(captures.has("999")).toBe(false);
  });

  it("keeps dates absent after a failed batch while using later successful batches", async () => {
    let calls = 0;
    const client = {
      from() {
        return {
          select() {
            return {
              async in(_column: string, ids: number[]) {
                calls += 1;
                if (calls === 1) throw new Error("Public read failed");
                return {
                  data: ids.map((id) => ({
                    id,
                    captured_at: "2026-07-02T00:00:00Z",
                  })),
                  error: null,
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;
    const ids = Array.from({ length: 201 }, (_, index) => String(index + 1));

    const captures = await loadCaptureDatesForHistory(client, [
      snapshot(AGGREGATION_METHOD_VERSION_V2, [source(null, ids)]),
    ]);

    expect(calls).toBe(2);
    expect(captures.has("1")).toBe(false);
    expect(captures.get("201")).toBe("2026-07-02T00:00:00Z");
  });
});
