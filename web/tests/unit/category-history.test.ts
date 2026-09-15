import { describe, expect, it, vi } from "vitest";
import {
  phase71FixtureAggregate,
  phase71FixturePreviousAggregate,
} from "../../src/data/phase71-fixture";
import {
  getCategoryView,
  type ActiveCategoryView,
} from "../../src/lib/categories/data";
import { getCurrentCategoryPredictions } from "../../src/lib/repositories/signals";
import {
  getWeeklyReport,
  listDigestWeeks,
} from "../../src/lib/discovery/report";

const database = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("../../src/lib/environment", () => ({
  isSupabaseConfigured: () => true,
}));
vi.mock("../../src/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    from(table: string) {
      let rows = [...(database.tables[table] ?? [])];
      const query = {
        select: () => query,
        eq(key: string, value: unknown) {
          rows = rows.filter((row) => row[key] === value);
          return query;
        },
        lte(key: string, value: string) {
          rows = rows.filter((row) => String(row[key]) <= value);
          return query;
        },
        in(key: string, values: unknown[]) {
          rows = rows.filter((row) => values.includes(row[key]));
          return query;
        },
        order: () => query,
        limit: () => query,
        single: async () => ({ data: rows[0], error: null }),
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then: (resolve: (result: unknown) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return query;
    },
  }),
}));

describe("preserved prediction history across a methodology change", () => {
  it("restores old cuts and weekly editions without comparing different rules", async () => {
    const first = phase71FixturePreviousAggregate("best-picture");
    const changed = phase71FixtureAggregate("best-picture");
    const history = [
      {
        id: "july",
        date: "2026-07-20T04:47:00Z",
        aggregate: { ...first, methodVersion: "runscars-aggregation-v2" },
      },
      {
        id: "august",
        date: "2026-08-31T04:47:00Z",
        aggregate: { ...changed, methodVersion: "runscars-aggregation-v2" },
      },
      { id: "september", date: "2026-09-09T04:47:00Z", aggregate: changed },
    ];
    database.tables = {
      current_aggregate_snapshots: [
        {
          season_id: "oscars-2027",
          category_id: "best-picture",
          prediction_intention: "nomination",
          kind: "periodic",
          snapshot_id: "september",
        },
      ],
      aggregate_snapshots: history.map((item) => ({
        id: item.id,
        season_id: "oscars-2027",
        category_id: "best-picture",
        prediction_intention: "nomination",
        kind: "periodic",
        content_hash: item.id,
        locked_at: item.date,
        schema_version: "runscars-snapshot-v2",
        method_version: item.aggregate.methodVersion,
        payload: { aggregate: item.aggregate },
      })),
    };
    const original = structuredClone(database.tables);
    const current = (await getCategoryView(
      2027,
      "best-picture",
    )) as ActiveCategoryView;
    expect(current.dataState).toBe("database");
    expect(current.snapshot?.cuts.map((cut) => cut.id)).toEqual([
      "september",
      "august",
      "july",
    ]);
    expect(current.snapshot?.methodologyChanged).toBe(true);
    expect(current.snapshot?.previous).toBeNull();
    expect(
      current.aggregate?.ranking.every(
        (candidate) => candidate.movement === null,
      ),
    ).toBe(true);
    const archived = (await getCategoryView(2027, "best-picture", {
      snapshotId: "august",
    })) as ActiveCategoryView;
    expect(archived.snapshot?.id).toBe("august");
    expect(archived.snapshot?.isLatest).toBe(false);
    expect(archived.snapshot?.previous?.id).toBe("july");
    expect(archived.aggregate?.methodVersion).toBe("runscars-aggregation-v2");
    expect(archived.aggregate?.ranking[0].movement).toBe(1);
    expect(archived.currentCandidates).toEqual(current.currentCandidates);
    const earliest = (await getCategoryView(2027, "best-picture", {
      snapshotId: "july",
    })) as ActiveCategoryView;
    expect(earliest.snapshot?.previous).toBeNull();
    expect(earliest.snapshot?.methodologyChanged).toBe(false);
    const signals = await getCurrentCategoryPredictions();
    expect(signals[0].aggregate.methodVersion).toBe(changed.methodVersion);
    expect(
      signals[0].aggregate.ranking.every(
        (candidate) => candidate.movement === null,
      ),
    ).toBe(true);
    expect(await listDigestWeeks()).toEqual([
      "2026-09-07",
      "2026-08-31",
      "2026-07-20",
    ]);
    const oldWeek = await getWeeklyReport("2026-08-31");
    expect(oldWeek.categories[0].hasBaseline).toBe(true);
    expect(oldWeek.categories[0].movements[0].movement).toBe(1);
    const transition = await getWeeklyReport("2026-09-07");
    expect(transition.categories[0].hasBaseline).toBe(false);
    expect(transition.categories[0].methodologyChanged).toBe(true);
    expect(transition.categories[0].movements).toEqual([]);
    expect(database.tables).toEqual(original);
  });
});
