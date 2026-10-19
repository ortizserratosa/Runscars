import { describe, expect, it, vi } from "vitest";
import {
  getPredictionSourceEvidence,
  getPredictionSourceStatuses,
} from "../../src/lib/repositories/prediction-evidence-reads";

const state = vi.hoisted(() => ({
  reads: [] as string[],
  keys: [] as string[][],
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown, keys: string[]) => {
    state.keys.push(keys);
    return fn;
  },
}));
// Model React's request-local cache dispatcher so simultaneous category reads
// share their pending promise, without relying on a Next server in this unit.
vi.mock("react", () => ({
  cache: (fn: (...args: unknown[]) => unknown) => {
    const values = new Map<string, unknown>();
    return (...args: unknown[]) => {
      const key = JSON.stringify(args);
      if (!values.has(key)) values.set(key, fn(...args));
      return values.get(key);
    };
  },
}));
vi.mock("../../src/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    from: (table: string) => {
      let source = "all";
      const query = {
        select: () => query,
        eq: (key: string, value: string) => {
          if (key === "source_id") source = value;
          return query;
        },
        order: () => query,
        range: async () => {
          state.reads.push(`${table}:${source}`);
          return { data: [], error: null };
        },
      };
      return query;
    },
  }),
}));

describe("bounded public prediction evidence reads", () => {
  it("shares one pending status read across all categories and the source index", async () => {
    const results = await Promise.all(
      Array.from({ length: 9 }, () => getPredictionSourceStatuses()),
    );
    expect(
      state.reads.filter(
        (read) => read === "public_prediction_source_status:all",
      ),
    ).toHaveLength(1);
    expect(results.every((rows) => rows === results[0])).toBe(true);
    expect(
      state.keys.some((key) => key[0] === "public-prediction-source-status-v2"),
    ).toBe(true);
  });
  it("keeps full-source fact caches separate by source and deduplicates repeated requests", async () => {
    await Promise.all([
      getPredictionSourceEvidence("the-movie-state"),
      getPredictionSourceEvidence("the-movie-state"),
      getPredictionSourceEvidence("variety"),
    ]);
    expect(
      state.reads.filter(
        (read) => read === "public_prediction_source_evidence:the-movie-state",
      ),
    ).toHaveLength(1);
    expect(
      state.reads.filter(
        (read) => read === "public_prediction_source_evidence:variety",
      ),
    ).toHaveLength(1);
  });
});
