import { describe, expect, it, vi } from "vitest";
import { phase71FixtureObservations } from "../../src/data/phase71-fixture";
import { aggregatePredictionsV2 } from "../../src/lib/aggregation/v2";
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

function fixtureCut(
  publishedAt: string,
  cutoffDate: string,
  reverseRanks: boolean,
) {
  const observations = phase71FixtureObservations("best-picture").map(
    (observation) =>
      observation.sourceId === "the-ringer"
        ? observation
        : {
            ...observation,
            publishedAt,
            capturedAt: publishedAt,
          },
  );
  if (reverseRanks) {
    for (const observation of observations) {
      if (observation.rank !== null && observation.listLength !== null) {
        observation.rank = observation.listLength - observation.rank + 1;
      }
    }
  }
  return aggregatePredictionsV2(observations, {
    seasonId: "oscars-2027",
    categoryId: "best-picture",
    intention: "nomination",
    cutoffDate,
  });
}

describe("comparable prediction history across a freshness change", () => {
  it("restores old cuts and weekly editions with the same scoring rule", async () => {
    const first = fixtureCut(
      "2026-07-19T12:00:00Z",
      "2026-07-20T04:47:00Z",
      true,
    );
    const changed = fixtureCut(
      "2026-08-30T12:00:00Z",
      "2026-08-31T04:47:00Z",
      false,
    );
    const septemberAggregate = fixtureCut(
      "2026-09-08T12:00:00Z",
      "2026-09-09T04:47:00Z",
      true,
    );
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
      {
        id: "september",
        date: "2026-09-09T04:47:00Z",
        aggregate: septemberAggregate,
      },
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
    expect(current.snapshot?.methodologyChanged).toBe(false);
    expect(current.snapshot?.previous?.id).toBe("august");
    expect(current.snapshot?.comparableProjection).toBe(false);
    expect(
      current.aggregate?.ranking.some((candidate) => candidate.movement !== 0),
    ).toBe(true);
    const archived = (await getCategoryView(2027, "best-picture", {
      snapshotId: "august",
    })) as ActiveCategoryView;
    expect(archived.snapshot?.id).toBe("august");
    expect(archived.snapshot?.isLatest).toBe(false);
    expect(archived.snapshot?.previous?.id).toBe("july");
    expect(archived.aggregate?.methodVersion).toBe("runscars-aggregation-v3");
    expect(archived.snapshot?.comparableProjection).toBe(true);
    expect(
      archived.aggregate?.ranking.some((candidate) => candidate.movement !== 0),
    ).toBe(true);
    expect(archived.currentCandidates).toEqual(current.currentCandidates);
    const earliest = (await getCategoryView(2027, "best-picture", {
      snapshotId: "july",
    })) as ActiveCategoryView;
    expect(earliest.snapshot?.previous).toBeNull();
    expect(earliest.snapshot?.methodologyChanged).toBe(false);
    const signals = await getCurrentCategoryPredictions();
    expect(signals[0].aggregate.methodVersion).toBe(
      septemberAggregate.methodVersion,
    );
    expect(signals[0].aggregate.ranking).toEqual(current.aggregate?.ranking);
    expect(await listDigestWeeks()).toEqual([
      "2026-09-07",
      "2026-08-31",
      "2026-07-20",
    ]);
    const oldWeek = await getWeeklyReport("2026-08-31");
    expect(oldWeek.categories[0].hasBaseline).toBe(true);
    expect(oldWeek.categories[0].movements.length).toBeGreaterThan(0);
    const transition = await getWeeklyReport("2026-09-07");
    expect(transition.categories[0].hasBaseline).toBe(true);
    expect(transition.categories[0].methodologyChanged).toBe(false);
    expect(transition.categories[0].movements.length).toBeGreaterThan(0);
    expect(database.tables).toEqual(original);
  });

  it("withholds cross-version movements when an undated old source has no public capture date", async () => {
    const julyAggregate = fixtureCut(
      "2026-07-19T12:00:00Z",
      "2026-07-20T04:47:00Z",
      true,
    );
    const undatedJuly = {
      ...julyAggregate,
      methodVersion: "runscars-aggregation-v2",
      sourceLists: julyAggregate.sourceLists.map((source) =>
        source.sourceId === "midnight-critics"
          ? { ...source, publishedAt: null }
          : source,
      ),
      ranking: julyAggregate.ranking.map((candidate) => ({
        ...candidate,
        sourceContributions: candidate.sourceContributions.map((source) =>
          source.sourceId === "midnight-critics"
            ? { ...source, publishedAt: null }
            : source,
        ),
      })),
    };
    const septemberAggregate = fixtureCut(
      "2026-09-08T12:00:00Z",
      "2026-09-09T04:47:00Z",
      false,
    );
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
      aggregate_snapshots: [
        { id: "july", date: "2026-07-20T04:47:00Z", aggregate: undatedJuly },
        {
          id: "september",
          date: "2026-09-09T04:47:00Z",
          aggregate: septemberAggregate,
        },
      ].map((item) => ({
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

    const current = (await getCategoryView(
      2027,
      "best-picture",
    )) as ActiveCategoryView;
    expect(current.snapshot?.previous).toBeNull();
    expect(current.snapshot?.methodologyChanged).toBe(false);
    expect(current.snapshot?.comparisonDateIncomplete).toBe(false);
    expect(current.snapshot?.comparisonLimited).toBe(true);
    expect(
      current.aggregate?.ranking.every(
        (candidate) => candidate.movement === null,
      ),
    ).toBe(true);
    const old = (await getCategoryView(2027, "best-picture", {
      snapshotId: "july",
    })) as ActiveCategoryView;
    expect(old.snapshot?.comparisonDateIncomplete).toBe(true);
    const signals = await getCurrentCategoryPredictions();
    expect(
      signals[0].aggregate.ranking.every(
        (candidate) => candidate.movement === null,
      ),
    ).toBe(true);
    const weekly = await getWeeklyReport("2026-09-07");
    expect(weekly.categories[0].comparisonLimited).toBe(true);
    expect(weekly.categories[0].hasBaseline).toBe(false);
    expect(weekly.categories[0].movements).toEqual([]);
  });
});
