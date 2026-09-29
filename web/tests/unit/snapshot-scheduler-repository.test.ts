import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseSnapshotSchedulerRepository } from "../../src/lib/snapshots/scheduler";
import { aggregatePredictionsV2 } from "../../src/lib/aggregation/v2";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  requests: [] as {
    table: string;
    range: [number, number] | null;
    ids: unknown[];
  }[],
  failedOffset: -1,
  failedTable: "professional_observations",
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      let rows = [...(state.tables[table] ?? [])];
      let page: [number, number] | null = null;
      let ids: unknown[] = [];
      const query = {
        select: () => query,
        eq(column: string, value: unknown) {
          rows = rows.filter((row) => row[column] === value);
          return query;
        },
        not(column: string, _operator: string, value: unknown) {
          rows = rows.filter((row) => row[column] !== value);
          return query;
        },
        in(column: string, values: unknown[]) {
          if (column === "id") ids = values;
          rows = rows.filter((row) => values.includes(row[column]));
          return query;
        },
        order(column: string) {
          rows.sort((a, b) => Number(a[column]) - Number(b[column]));
          return query;
        },
        range(from: number, to: number) {
          page = [from, to];
          return query;
        },
        then(resolve: (value: unknown) => unknown) {
          state.requests.push({ table, range: page, ids });
          if (table === state.failedTable && page?.[0] === state.failedOffset) {
            return Promise.resolve(
              resolve({ data: null, error: { message: "Page failed" } }),
            );
          }
          const data = page ? rows.slice(page[0], page[1] + 1) : rows;
          return Promise.resolve(
            resolve({ data: data.slice(0, 1000), error: null }),
          );
        },
      };
      return query;
    },
  }),
}));

const schedule = {
  id: "picture-daily",
  seasonId: "oscars-2027",
  categoryId: "best-picture",
  intention: "nomination" as const,
  kind: "periodic" as const,
  timeZone: "UTC",
};

function repository() {
  return new SupabaseSnapshotSchedulerRepository({
    NODE_ENV: "test",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "server-fixture-key-without-secrets",
  });
}

beforeEach(() => {
  state.requests = [];
  state.failedOffset = -1;
  state.failedTable = "professional_observations";
  state.tables = {
    sources: [
      { id: "source", name: "Source", publication_status: "publishable" },
    ],
    professional_observations: [],
    source_publications: [],
    category_candidates: [],
  };
  for (let id = 1; id <= 1001; id++) {
    const publishedAt =
      id === 1001 ? "2026-09-29T00:00:00Z" : "2026-09-01T00:00:00Z";
    state.tables.professional_observations.push({
      id,
      source_id: "source",
      publication_id: id,
      category_candidate_id: `candidate-${id}`,
      data_type: "prediction_ordered",
      original_subject: `Film ${id}`,
      original_value: { rank: 1, list_length: 1 },
      author: null,
      published_at: publishedAt,
      captured_at: publishedAt,
      season_id: schedule.seasonId,
      category_id: schedule.categoryId,
      prediction_intention: schedule.intention,
      participates: true,
      state: "published",
    });
    state.tables.source_publications.push({
      id,
      external_id: `publication-${id}`,
      canonical_url: "https://example.com/live",
    });
    state.tables.category_candidates.push({
      id: `candidate-${id}`,
      season_id: schedule.seasonId,
      category_id: schedule.categoryId,
      display_label: `Film ${id}`,
      work_title: null,
      films: { id: `film-${id}`, title: `Film ${id}` },
      category_candidate_people: [],
    });
  }
  state.tables.professional_observations.reverse();
});

function undatedHistoryFixture() {
  const sourceId = "next-best-picture";
  const url = "https://nextbestpicture.com/oscar-predictions/";
  const originalData = {
    source_id: sourceId,
    publication_date: null,
    categories: {
      "best-picture": ["A", "B"].map((subject, index) => ({
        rank: index + 1,
        raw: subject,
        parts: { subject, filmSubject: subject, peopleSubjects: [] },
      })),
    },
  };
  state.tables.sources = [
    {
      id: sourceId,
      name: "Next Best Picture",
      publication_status: "publishable",
    },
  ];
  state.tables.source_publications = [1, 2].map((id) => ({
    id,
    source_id: sourceId,
    external_id: `revision-${id}`,
    canonical_url: url,
  }));
  state.tables.source_publication_captures = [
    {
      id: 101,
      publication_id: 1,
      captured_at: "2026-08-01T04:17:00Z",
      original_data: originalData,
    },
    {
      id: 102,
      publication_id: 2,
      captured_at: "2026-09-29T04:17:00Z",
      original_data: originalData,
    },
  ];
  state.tables.professional_observations = ["A", "B"].map((subject, index) => ({
    id: index + 1,
    source_id: sourceId,
    publication_id: 2,
    capture_id: 102,
    category_candidate_id: index === 0 ? "candidate-1" : null,
    data_type: "prediction_ordered",
    original_subject: subject,
    original_value: { rank: index + 1, list_length: 2 },
    author: null,
    published_at: null,
    captured_at: "2026-09-29T04:17:00Z",
    season_id: schedule.seasonId,
    category_id: schedule.categoryId,
    prediction_intention: schedule.intention,
    participates: true,
    state: index === 0 ? "published" : "pending_review",
  }));
}

describe("snapshot repository undated category evidence", () => {
  it("dates from complete captures even when old observations are absent and current matching is partial", async () => {
    undatedHistoryFixture();
    const observations = await repository().predictionObservationsV2(schedule);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      capturedAt: "2026-09-29T04:17:00Z",
      freshnessAt: "2026-08-01T04:17:00Z",
      listLength: 2,
    });
    const aggregate = aggregatePredictionsV2(observations, {
      ...schedule,
      cutoffDate: "2026-09-29T12:00:00Z",
    });
    expect(aggregate.ranking).toEqual([]);
    expect(aggregate.excludedObservationIds).toEqual(["1"]);
  });

  it("includes an intervening missing category from the page history even without category observations", async () => {
    undatedHistoryFixture();
    state.tables.source_publications.push({
      ...state.tables.source_publications[0],
      id: 3,
      external_id: "missing-category",
    });
    state.tables.source_publication_captures.push({
      id: 103,
      publication_id: 3,
      captured_at: "2026-09-01T04:17:00Z",
      original_data: {
        publication_date: null,
        categories: { cinematography: [] },
      },
    });
    const observations = await repository().predictionObservationsV2(schedule);
    expect(observations[0].freshnessAt).toBe("2026-09-29T04:17:00Z");
  });

  it("does not use an unrelated source or URL as category freshness evidence", async () => {
    undatedHistoryFixture();
    state.tables.source_publications[0].canonical_url =
      "https://nextbestpicture.com/another/";
    const observations = await repository().predictionObservationsV2(schedule);
    expect(observations[0].freshnessAt).toBe("2026-09-29T04:17:00Z");
    state.tables.source_publications[0].canonical_url =
      state.tables.source_publications[1].canonical_url;
    state.tables.source_publications[0].source_id = "another-source";
    const otherSource = await repository().predictionObservationsV2(schedule);
    expect(otherSource[0].freshnessAt).toBe("2026-09-29T04:17:00Z");
  });

  it("retains legacy capture-date fallback for unrecognized evidence and aborts on a failed history read", async () => {
    undatedHistoryFixture();
    state.tables.source_publication_captures[1].original_data = {
      legacy: true,
    };
    const observations = await repository().predictionObservationsV2(schedule);
    expect(observations[0].freshnessAt).toBeUndefined();
    state.failedTable = "source_publication_captures";
    state.failedOffset = 0;
    await expect(
      repository().predictionObservationsV2(schedule),
    ).rejects.toThrow("Page failed");
  });
});

describe("snapshot repository history pagination", () => {
  it("retains the latest revision beyond 1,000 observations and reference rows", async () => {
    const observations = await repository().predictionObservationsV2(schedule);
    expect(observations).toHaveLength(1001);
    const aggregate = aggregatePredictionsV2(observations, {
      ...schedule,
      cutoffDate: "2026-09-29T12:00:00Z",
    });
    expect(aggregate.includedObservationIds).toEqual(["1001"]);
    expect(aggregate.ranking[0].candidateId).toBe("candidate-1001");
    expect(
      state.requests
        .filter((request) => request.table === "professional_observations")
        .map((request) => request.range),
    ).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]);
    expect(state.requests.every((request) => request.ids.length <= 200)).toBe(
      true,
    );
  });

  it("fails the scope instead of locking a truncated history after a failed page", async () => {
    state.failedOffset = 500;
    await expect(
      repository().predictionObservationsV2(schedule),
    ).rejects.toThrow("Page failed");
    expect(
      state.requests.every(
        (request) => request.table === "professional_observations",
      ),
    ).toBe(true);
  });
});
