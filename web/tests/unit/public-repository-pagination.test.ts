import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFestivalIndex } from "../../src/lib/festivals/data";
import { getSourceDetail } from "../../src/lib/repositories/sources";

type Row = Record<string, unknown>;
const database = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  requests: [] as Array<{
    table: string;
    range: [number, number] | null;
    filters: Array<{ column: string; ids: unknown[] }>;
  }>,
  predictions: [] as Row[],
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("../../src/lib/environment", () => ({
  isSupabaseConfigured: () => true,
}));
vi.mock("../../src/lib/precursors/data", () => ({
  getPrecursorIndex: async () => [],
}));
vi.mock("../../src/lib/repositories/signals", () => ({
  getCurrentCategoryPredictions: async () => database.predictions,
}));
vi.mock("../../src/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    from(table: string) {
      let rows = [...(database.tables[table] ?? [])];
      const orders: string[] = [];
      const request = {
        table,
        range: null as [number, number] | null,
        filters: [] as Array<{ column: string; ids: unknown[] }>,
      };
      const query = {
        select: () => query,
        eq(column: string, value: unknown) {
          rows = rows.filter((row) => row[column] === value);
          return query;
        },
        in(column: string, ids: unknown[]) {
          if (ids.length > 200) throw new Error("PostgREST URL too long");
          request.filters.push({ column, ids });
          rows = rows.filter((row) =>
            ids.some((id) => String(id) === String(row[column])),
          );
          return query;
        },
        order(column: string) {
          orders.push(column);
          return query;
        },
        range(from: number, to: number) {
          request.range = [from, to];
          return query;
        },
        single: async () => ({ data: rows[0], error: null }),
        then(resolve: (result: unknown) => unknown) {
          database.requests.push(request);
          const sorted = rows.sort((left, right) => {
            for (const column of orders) {
              const a = left[column];
              const b = right[column];
              const comparison =
                typeof a === "number" && typeof b === "number"
                  ? a - b
                  : String(a).localeCompare(String(b));
              if (comparison) return comparison;
            }
            return 0;
          });
          const from = request.range?.[0] ?? 0;
          const requested = request.range ? request.range[1] - from + 1 : 1000;
          // Model Supabase's actual maximum response size, including unpaged reads.
          return Promise.resolve({
            data: sorted.slice(from, from + Math.min(1000, requested)),
            error: null,
          }).then(resolve);
        },
      };
      return query;
    },
  }),
}));

beforeEach(() => {
  database.tables = {};
  database.requests = [];
  database.predictions = [];
});

describe("complete public repository reads", () => {
  it("loads over 2,000 festival facts and every current matching through bounded pages and ID filters", async () => {
    const count = 2053;
    database.tables.festivals = [
      {
        id: "cannes",
        name: "Cannes",
        name_en: "Cannes",
        short_name: "Cannes",
        homepage_url: "https://www.festival-cannes.com/",
        is_competitive: true,
        display_order: 1,
      },
    ];
    database.tables.festival_editions = [
      {
        id: "cannes-2026",
        festival_id: "cannes",
        season_id: "oscars-2027",
        edition_year: 2026,
        edition_number: 79,
        starts_on: "2026-05-12",
        ends_on: "2026-05-23",
        status: "completed",
        awards_status: "pending",
        official_url: "https://www.festival-cannes.com/2026/",
        selection_url: "https://www.festival-cannes.com/selection/",
        awards_url: null,
        last_verified_at: "2026-10-07T08:30:00Z",
      },
    ];
    database.tables.current_festival_sets = [
      { edition_id: "cannes-2026", kind: "selection", set_id: 1 },
    ];
    database.tables.festival_sets = [
      {
        id: 1,
        kind: "selection",
        version: 2,
        source_url: "https://www.festival-cannes.com/selection/",
        source_title: "Official selection",
        published_at: "2026-04-01T00:00:00Z",
        captured_at: "2026-10-07T08:30:00Z",
        extractor_version: "festival-manual-v2",
        coverage_notes: null,
      },
    ];
    database.tables.festival_entries = Array.from(
      { length: count },
      (_, index) => ({
        id: index + 1,
        set_id: 1,
        entry_order: index + 1,
        section: "Competition",
        original_title: `Film ${index + 1}`,
        original_recipient: null,
        award_type: null,
        film_id: "old-film",
        match_status: "unmatched",
        films: { id: "old-film", title: "Old match" },
      }),
    ).reverse();
    database.tables.current_festival_entry_matches = Array.from(
      { length: count },
      (_, index) => ({ entry_id: index + 1, match_history_id: 10000 + index }),
    );
    database.tables.festival_entry_match_history = Array.from(
      { length: count },
      (_, index) => ({
        id: 10000 + index,
        status: "matched",
        film_id: `film-${index + 1}`,
      }),
    );
    database.tables.films = Array.from({ length: count }, (_, index) => ({
      id: `film-${index + 1}`,
      title: `Current film ${index + 1}`,
    }));
    database.tables.public_festival_external_links = Array.from(
      { length: count },
      (_, index) => ({
        entry_id: index + 1,
        tmdb_id: 9000000 + index,
        imdb_id: `tt${String(9000000 + index)}`,
      }),
    );
    const [edition] = await getFestivalIndex();
    expect(edition.selection?.entries).toHaveLength(count);
    expect(
      new Set(edition.selection?.entries.map((entry) => entry.id)).size,
    ).toBe(count);
    expect(edition.selection?.entries[0]).toMatchObject({
      id: "1",
      order: 1,
      filmId: "film-1",
      filmTitle: "Current film 1",
      matchStatus: "matched",
      imdbId: "tt9000000",
      tmdbId: 9000000,
    });
    expect(edition.selection?.entries[count - 1]).toMatchObject({
      id: String(count),
      order: count,
      filmId: `film-${count}`,
      filmTitle: `Current film ${count}`,
      matchStatus: "matched",
      imdbId: `tt${9000000 + count - 1}`,
      tmdbId: 9000000 + count - 1,
    });
    const entryPages = database.requests.filter(
      (request) => request.table === "festival_entries",
    );
    expect(entryPages.map((request) => request.range)).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
      [1500, 1999],
      [2000, 2499],
    ]);
    for (const table of [
      "current_festival_entry_matches",
      "festival_entry_match_history",
      "films",
      "public_festival_external_links",
    ]) {
      const requests = database.requests.filter(
        (request) => request.table === table,
      );
      expect(requests.length).toBeGreaterThan(10);
      expect(
        requests.every(
          (request) =>
            request.filters[0].ids.length <= 200 && request.range !== null,
        ),
      ).toBe(true);
    }
  });

  it("reads the snapshot's exact source observation instead of truncating or choosing newer historical captures", async () => {
    const sourceId = "variety";
    database.tables.sources = [
      {
        id: sourceId,
        name: "Variety",
        homepage_url: "https://variety.com/",
        source_types: ["prediction"],
        editorial_status: "selected",
        technical_status: "automated",
        publication_status: "publishable",
        last_reviewed_on: "2026-10-07",
        notes: null,
      },
    ];
    database.tables.public_source_freshness = [
      {
        source_id: sourceId,
        last_successful_check_at: "2026-10-07T08:30:00Z",
        last_failure_at: null,
        has_current_failure: false,
        has_active_connector: true,
      },
    ];
    database.tables.source_publications = [
      {
        id: 77,
        external_id: "variety-current",
        source_id: sourceId,
        canonical_url: "https://variety.com/lists/current/",
        title: "Current predictions",
        author: "Clayton Davis",
        published_at: "2026-10-01T00:00:00Z",
      },
    ];
    const contribution = {
      sourceId,
      sourceName: "Variety",
      appeared: true,
      appearanceKind: "ordered",
      observationId: "9001",
      rank: 1,
      listLength: 40,
      points: 100,
    };
    database.predictions = [
      {
        categoryId: "best-picture",
        categorySlug: "mejor-pelicula",
        categoryName: "Mejor película",
        lockedAt: "2026-10-06T08:00:00Z",
        sourceLastChangedAt: { variety: "2026-10-01T08:00:00Z" },
        aggregate: {
          intention: "nomination",
          sourceLists: [
            {
              sourceId,
              sourceName: "Variety",
              publicationId: "variety-current",
              publicationUrl: "https://variety.com/lists/current/",
              publishedAt: "2026-10-01T00:00:00Z",
            },
          ],
          ranking: [
            {
              candidateId: "the-odyssey",
              label: "The Odyssey",
              position: 1,
              scoreOutOf100: 100,
              appearances: 1,
              applicableSourceCount: 1,
              sourceContributions: [contribution],
            },
          ],
        },
      },
    ];
    const observation = (id: number, raw: string, capturedAt: string) => ({
      id,
      publication_id: 77,
      source_id: sourceId,
      state: "published",
      original_value: { rank: 1, list_length: 40, raw },
      captured_at: capturedAt,
      extractor_version: "variety-datawrapper-v1",
    });
    database.tables.professional_observations = Array.from(
      { length: 1100 },
      (_, index) =>
        observation(index + 1, "Old capture", "2026-09-01T00:00:00Z"),
    );
    database.tables.professional_observations.push(
      observation(9001, "Exact current original", "2026-10-01T08:00:00Z"),
      observation(9100, "Newer unrelated capture", "2026-10-07T08:00:00Z"),
    );
    const source = await getSourceDetail(sourceId);
    expect(source?.categories[0].entries[0].originalValue).toEqual({
      rank: 1,
      list_length: 40,
      raw: "Exact current original",
    });
    expect(source?.categories[0].publication.capturedAt).toBe(
      "2026-10-01T08:00:00Z",
    );
    const queries = database.requests.filter(
      (request) => request.table === "professional_observations",
    );
    expect(queries).toHaveLength(1);
    expect(queries[0].filters).toEqual([{ column: "id", ids: ["9001"] }]);
  });
});
