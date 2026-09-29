import { beforeEach, describe, expect, it, vi } from "vitest";
import { phase71FixtureAggregate } from "../../src/data/phase71-fixture";
import type { PublicCategoryId } from "../../src/lib/categories/config";
import type { PredictionAggregateV2 } from "../../src/lib/aggregation/v2";
import {
  getPublicHistorySelection,
  getCurrentPublicSnapshotPointers,
} from "../../src/lib/snapshots/public-history";
import { getCurrentCategoryPredictions } from "../../src/lib/repositories/signals";
import {
  getCategoryView,
  type ActiveCategoryView,
} from "../../src/lib/categories/data";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  calls: [] as {
    table: string;
    columns: string;
    range: [number, number] | null;
  }[],
  cache: new Map<string, { expires: number; json: string }>(),
  now: 0,
  failPage: -1,
  failCaptures: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const cacheContext = new AsyncLocalStorage<boolean>();
  return {
    unstable_cache:
      (
        fn: (...args: unknown[]) => Promise<unknown>,
        keys: string[],
        options: { revalidate: number },
      ) =>
      async (...args: unknown[]) => {
        // Next skips nested unstable_cache reads. Reject that structure here so
        // a simple memoization mock cannot conceal recurring heavy queries.
        if (cacheContext.getStore()) throw new Error("Nested unstable_cache");
        const key = JSON.stringify([keys, args]);
        const stored = state.cache.get(key);
        if (stored && stored.expires > state.now)
          return JSON.parse(stored.json);
        const value = await cacheContext.run(true, () => fn(...args));
        state.cache.set(key, {
          expires: state.now + options.revalidate * 1000,
          json: JSON.stringify(value),
        });
        return value;
      },
  };
});
vi.mock("../../src/lib/environment", () => ({
  isSupabaseConfigured: () => true,
}));
vi.mock("../../src/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    from(table: string) {
      let rows = [...(state.tables[table] ?? [])];
      let columns = "";
      let page: [number, number] | null = null;
      const orders: [string, boolean][] = [];
      const execute = () => {
        state.calls.push({ table, columns, range: page });
        if (
          (page && page[0] === state.failPage) ||
          (table === "professional_observations" && state.failCaptures)
        ) {
          return {
            data: null,
            error: { message: "Transient database failure" },
          };
        }
        rows.sort((left, right) => {
          for (const [column, ascending] of orders) {
            const a = String(left[column]);
            const b = String(right[column]);
            const result = a < b ? -1 : a > b ? 1 : 0;
            if (result) return ascending ? result : -result;
          }
          return 0;
        });
        const data = (page ? rows.slice(page[0], page[1] + 1) : rows).map(
          (row) =>
            Object.fromEntries(
              columns.split(",").map((column) => [column, row[column]]),
            ),
        );
        return { data, error: null };
      };
      const query = {
        select(value: string) {
          columns = value;
          return query;
        },
        eq(column: string, value: unknown) {
          rows = rows.filter((row) => row[column] === value);
          return query;
        },
        in(column: string, values: unknown[]) {
          rows = rows.filter((row) => values.includes(row[column]));
          return query;
        },
        lte(column: string, value: string) {
          rows = rows.filter((row) => String(row[column]) <= value);
          return query;
        },
        order(column: string, options: { ascending: boolean }) {
          orders.push([column, options.ascending]);
          return query;
        },
        range(start: number, end: number) {
          page = [start, end];
          return query;
        },
        limit: () => query,
        async single() {
          const result = execute();
          return { ...result, data: result.data?.[0] ?? null };
        },
        then(resolve: (result: unknown) => unknown) {
          return Promise.resolve(execute()).then(resolve);
        },
      };
      return query;
    },
  }),
}));

function snapshot(
  id: string,
  date: string,
  categoryId: PublicCategoryId = "best-picture",
  changed = false,
) {
  const aggregate: PredictionAggregateV2 = structuredClone(
    phase71FixtureAggregate(categoryId),
  );
  aggregate.cutoffDate = date;
  if (changed) {
    for (const candidate of aggregate.ranking) {
      candidate.candidateId = `changed-${candidate.candidateId}`;
    }
  }
  return {
    id,
    season_id: "oscars-2027",
    category_id: categoryId,
    prediction_intention: "nomination",
    kind: "periodic",
    content_hash: id,
    locked_at: date,
    method_version: aggregate.methodVersion,
    schema_version: "runscars-snapshot-v2",
    payload: { aggregate },
  };
}

function pointer(id: string, categoryId = "best-picture") {
  return {
    season_id: "oscars-2027",
    category_id: categoryId,
    prediction_intention: "nomination",
    kind: "periodic",
    snapshot_id: id,
  };
}

function historyReads() {
  return state.calls.filter((call) => call.range !== null);
}

beforeEach(() => {
  state.tables = {};
  state.calls = [];
  state.cache.clear();
  state.now = 0;
  state.failPage = -1;
  state.failCaptures = false;
});

describe("public prediction history cache", () => {
  it("paginates beyond 1000 envelopes and retains intraday URL aliases", async () => {
    const first = snapshot("first", "2026-07-20T00:00:00.000Z");
    const intraday = Array.from({ length: 1005 }, (_, index) =>
      snapshot(
        `intraday-${String(index).padStart(4, "0")}`,
        new Date(
          Date.parse("2026-07-21T00:00:00Z") + index * 1000,
        ).toISOString(),
        "best-picture",
        true,
      ),
    );
    const latest = intraday.at(-1)!;
    state.tables.aggregate_snapshots = [first, ...intraday];
    const current = await getPublicHistorySelection("best-picture", latest.id);
    expect(current.cuts.map((cut) => cut.id)).toEqual(["first", latest.id]);
    expect(current.selected?.id).toBe(latest.id);
    expect(historyReads()).toHaveLength(41);
    expect(historyReads().at(-1)?.range).toEqual([1000, 1024]);
    expect(
      historyReads().every((call) => call.range![1] - call.range![0] === 24),
    ).toBe(true);
    const alias = await getPublicHistorySelection(
      "best-picture",
      latest.id,
      intraday[0].id,
    );
    expect(alias.selected?.id).toBe("first");
    expect(historyReads()).toHaveLength(41);
  });

  it("shares history between signals and categories while polling pointers every minute", async () => {
    const first = snapshot("first", "2026-07-20T04:47:00Z");
    const second = snapshot(
      "second",
      "2026-07-21T04:47:00Z",
      "best-picture",
      true,
    );
    const third = snapshot("third", "2026-07-22T04:47:00Z");
    const director = snapshot("director", "2026-07-21T04:47:00Z", "directing");
    state.tables.aggregate_snapshots = [third, first, director, second];
    state.tables.current_aggregate_snapshots = [
      pointer("second"),
      pointer("director", "directing"),
    ];
    const signals = await getCurrentCategoryPredictions();
    const reads = historyReads().length;
    expect(reads).toBe(2);
    const category = (await getCategoryView(
      2027,
      "best-picture",
    )) as ActiveCategoryView;
    expect(category.dataState).toBe("database");
    expect(category.aggregate).toEqual(signals[0].aggregate);
    expect(historyReads()).toHaveLength(reads);
    state.now = 61_000;
    await getCurrentCategoryPredictions();
    await getCategoryView(2027, "best-picture", {
      snapshotId: "random-url-id",
    });
    expect(historyReads()).toHaveLength(reads);
    expect(
      state.calls.filter(
        (call) => call.table === "current_aggregate_snapshots",
      ),
    ).toHaveLength(2);
    state.tables.current_aggregate_snapshots = [
      pointer("third"),
      pointer("director", "directing"),
    ];
    state.now = 122_000;
    const updated = await getCurrentCategoryPredictions();
    expect(updated[0].lockedAt).toBe(third.locked_at);
    expect(historyReads()).toHaveLength(reads + 1);
    expect(updated[1]).toEqual(signals[1]);
    expect(state.tables.aggregate_snapshots).toEqual([
      third,
      first,
      director,
      second,
    ]);
  });

  it("loads only the selected old comparison instead of re-reading all history", async () => {
    const rows = Array.from({ length: 5 }, (_, index) =>
      snapshot(
        `cut-${index}`,
        `2026-07-${20 + index}T04:47:00Z`,
        "best-picture",
        index % 2 === 1,
      ),
    );
    state.tables.aggregate_snapshots = rows;
    await getPublicHistorySelection("best-picture", "cut-4");
    const before = state.calls.length;
    const historic = await getPublicHistorySelection(
      "best-picture",
      "cut-4",
      "cut-1",
    );
    expect(historic.selected?.id).toBe("cut-1");
    expect(historic.previous?.id).toBe("cut-0");
    expect(state.calls.slice(before)).toHaveLength(2);
    expect(historyReads()).toHaveLength(1);
    await getPublicHistorySelection("best-picture", "cut-4", "cut-1");
    expect(state.calls).toHaveLength(before + 2);
  });

  it("does not cache an incomplete history after a failed page", async () => {
    const rows = Array.from({ length: 26 }, (_, index) =>
      snapshot(
        `cut-${String(index).padStart(2, "0")}`,
        new Date(
          Date.parse("2026-07-20T00:00:00Z") + index * 1000,
        ).toISOString(),
      ),
    );
    state.tables.aggregate_snapshots = rows;
    state.failPage = 25;
    await expect(
      getPublicHistorySelection("best-picture", rows[25].id),
    ).rejects.toThrow("Transient database failure");
    expect(state.cache.size).toBe(0);
    state.failPage = -1;
    const recovered = await getPublicHistorySelection(
      "best-picture",
      rows[25].id,
    );
    expect(recovered.selected?.id).toBe(rows[25].id);
  });

  it("retries missing capture evidence after an hour without inventing movements", async () => {
    const row = snapshot("old-v2", "2026-07-25T04:47:00Z");
    row.method_version = "runscars-aggregation-v2";
    row.payload.aggregate.methodVersion = "runscars-aggregation-v2";
    const source = row.payload.aggregate.sourceLists[0];
    source.publishedAt = null;
    source.orderedObservationIds = ["123"];
    source.selectionObservationIds = [];
    state.tables.aggregate_snapshots = [row];
    state.tables.professional_observations = [
      { id: 123, captured_at: "2026-07-24T00:00:00Z" },
    ];
    state.failCaptures = true;
    const incomplete = await getPublicHistorySelection("best-picture", row.id);
    expect(incomplete.selected?.comparisonDateIncomplete).toBe(true);
    state.failCaptures = false;
    state.now = 3_601_000;
    const recovered = await getPublicHistorySelection("best-picture", row.id);
    expect(recovered.selected?.comparisonDateIncomplete).toBe(false);
    expect(
      recovered.selected?.aggregate.sourceLists.some(
        (item) => item.sourceId === source.sourceId,
      ),
    ).toBe(true);
  });

  it("never crosses the pointer category or returns an unscoped pointer", async () => {
    state.tables.aggregate_snapshots = [
      snapshot("director", "2026-07-21T04:47:00Z", "directing"),
    ];
    await expect(
      getPublicHistorySelection("best-picture", "director"),
    ).rejects.toThrow("snapshot vigente");
    state.tables.current_aggregate_snapshots = [pointer("other", "not-public")];
    expect(await getCurrentPublicSnapshotPointers()).toEqual([]);
  });

  it("does not publish an older history for an unsupported or invalid pointer", async () => {
    const previous = snapshot("previous", "2026-07-20T04:47:00Z");
    const unsupported = snapshot("unsupported", "2026-07-21T04:47:00Z");
    unsupported.schema_version = "runscars-snapshot-v1";
    const invalid = snapshot("invalid", "2026-07-22T04:47:00Z");
    invalid.method_version = "runscars-aggregation-v2";
    state.tables.aggregate_snapshots = [previous, unsupported, invalid];
    expect(
      (await getPublicHistorySelection("best-picture", unsupported.id))
        .selected,
    ).toBeNull();
    expect(historyReads()).toHaveLength(0);
    expect(
      (await getPublicHistorySelection("best-picture", invalid.id)).selected,
    ).toBeNull();
  });
});
