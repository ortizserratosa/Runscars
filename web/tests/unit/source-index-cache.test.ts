import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSourceDetail,
  getSourceIndex,
} from "../../src/lib/repositories/sources";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  reads: [] as { table: string; columns: string; id: string | null }[],
  cache: new Map<string, { expires: number; json: string }>(),
  pending: new Map<string, Promise<unknown>>(),
  configurations: [] as { keys: string[]; revalidate: number }[],
  now: 0,
  request: 0,
  failures: new Set<string>(),
}));
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: (fn: (...args: unknown[]) => unknown) => {
    const values = new Map<string, unknown>();
    return (...args: unknown[]) => {
      const key = JSON.stringify([state.request, args]);
      if (!values.has(key)) values.set(key, fn(...args));
      return values.get(key);
    };
  },
}));
vi.mock("next/cache", async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const context = new AsyncLocalStorage<boolean>();
  return {
    unstable_cache: (
      fn: (...args: unknown[]) => Promise<unknown>,
      keys: string[],
      options: { revalidate: number },
    ) => {
      state.configurations.push({ keys, revalidate: options.revalidate });
      return async (...args: unknown[]) => {
        if (context.getStore()) throw new Error("Nested unstable_cache");
        const key = JSON.stringify([keys, args]);
        const stored = state.cache.get(key);
        if (stored && stored.expires > state.now)
          return JSON.parse(stored.json);
        if (state.pending.has(key)) return state.pending.get(key);
        const pending = context
          .run(true, () => fn(...args))
          .then((value) => {
            state.cache.set(key, {
              expires: state.now + options.revalidate * 1000,
              json: JSON.stringify(value),
            });
            return value;
          });
        state.pending.set(key, pending);
        try {
          return await pending;
        } finally {
          state.pending.delete(key);
        }
      };
    },
  };
});
vi.mock("../../src/lib/environment", () => ({
  isSupabaseConfigured: () => true,
}));
vi.mock("../../src/lib/repositories/signals", () => ({
  getCurrentCategoryPredictions: async () => [],
}));
vi.mock("../../src/lib/repositories/prediction-evidence-reads", () => ({
  getPredictionSourceStatuses: async () => [],
  getPredictionSourceEvidence: async () => [],
}));
vi.mock("../../src/lib/precursors/data", () => ({
  getPrecursorIndex: async () => [],
}));
vi.mock("../../src/lib/festivals/data", () => ({
  getFestivalIndex: async () => [],
}));
vi.mock("../../src/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    from(table: string) {
      let columns = "";
      let id: string | null = null;
      let rows = [...(state.tables[table] ?? [])];
      const execute = () => {
        state.reads.push({ table, columns, id });
        return state.failures.has(table)
          ? { data: null, error: { message: "Temporary source read failure" } }
          : { data: structuredClone(rows), error: null };
      };
      const query = {
        select(value: string) {
          columns = value;
          return query;
        },
        eq(column: string, value: string) {
          if (column === "id" || column === "source_id") id = value;
          rows = rows.filter((row) => row[column] === value);
          return query;
        },
        async single() {
          const result = execute();
          return { ...result, data: result.data?.[0] ?? null };
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(execute()).then(resolve);
        },
      };
      return query;
    },
  }),
}));

function source(id: string, types = ["prediction"]) {
  return {
    id,
    name: id,
    homepage_url: `https://example.com/${id}`,
    source_types: types,
    editorial_status: "selected",
    technical_status: "automated",
    publication_status: "publishable",
    last_reviewed_on: "2026-11-24",
    notes: `Notes for ${id}`,
  };
}
beforeEach(() => {
  state.tables = {
    sources: [source("variety")],
    public_source_freshness: [
      {
        source_id: "variety",
        last_successful_check_at: "2026-11-24T04:00:00Z",
        last_failure_at: null,
        has_current_failure: false,
        has_active_connector: true,
      },
    ],
  };
  state.reads = [];
  state.cache.clear();
  state.pending.clear();
  state.failures.clear();
  state.now = 0;
  state.request += 1;
});
afterEach(() => vi.unstubAllEnvs());

describe("public source-index cache leaves", () => {
  it("shares pending index composition in a request and reuses independent leaves for sixty seconds", async () => {
    const indexes = await Promise.all(
      Array.from({ length: 9 }, () => getSourceIndex()),
    );
    expect(indexes.every((index) => index === indexes[0])).toBe(true);
    expect(indexes[0][0].health).toBe("ok");
    expect(state.reads.map((read) => read.table).sort()).toEqual([
      "market_connectors",
      "public_festival_freshness",
      "public_source_freshness",
      "sources",
    ]);
    state.request += 1;
    state.now = 59_000;
    state.tables.sources[0].name = "Updated Variety";
    expect((await getSourceIndex())[0].name).toBe("variety");
    expect(state.reads).toHaveLength(4);
    state.request += 1;
    state.now = 60_001;
    expect((await getSourceIndex())[0].name).toBe("Updated Variety");
    expect(state.reads).toHaveLength(8);
    expect(
      state.configurations.every(
        (configuration) => configuration.revalidate === 60,
      ),
    ).toBe(true);
  });

  it("does not cache a connector failure as an empty successful read", async () => {
    state.failures.add("public_source_freshness");
    expect((await getSourceIndex())[0].health).toBe("unknown");
    state.failures.clear();
    state.request += 1;
    expect((await getSourceIndex())[0].health).toBe("ok");
    expect(
      state.reads.filter((read) => read.table === "public_source_freshness"),
    ).toHaveLength(2);
    expect(state.reads.filter((read) => read.table === "sources")).toHaveLength(
      1,
    );
  });

  it("retries failed registry reads instead of caching demo sources in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    state.failures.add("sources");
    await expect(getSourceIndex()).rejects.toThrow(
      "Temporary source read failure",
    );
    state.failures.clear();
    state.request += 1;
    expect((await getSourceIndex())[0].id).toBe("variety");
    expect(state.reads.filter((read) => read.table === "sources")).toHaveLength(
      2,
    );
  });

  it("keeps notes and category health scoped to their source across requests", async () => {
    state.tables.sources.push(
      source("cannes", ["festival"]),
      source("bafta", ["official"]),
    );
    await Promise.all([
      getSourceDetail("variety"),
      getSourceDetail("cannes"),
      getSourceDetail("bafta"),
    ]);
    state.request += 1;
    expect((await getSourceDetail("cannes"))?.notes).toBe("Notes for cannes");
    expect((await getSourceDetail("bafta"))?.notes).toBe("Notes for bafta");
    await getSourceDetail("variety");
    expect(
      state.reads
        .filter((read) => read.columns === "notes")
        .map((read) => read.id)
        .sort(),
    ).toEqual(["bafta", "cannes"]);
    expect(
      state.reads.filter(
        (read) => read.table === "public_prediction_connector_freshness",
      ),
    ).toEqual([
      {
        table: "public_prediction_connector_freshness",
        columns: "*",
        id: "variety",
      },
    ]);
  });
});
