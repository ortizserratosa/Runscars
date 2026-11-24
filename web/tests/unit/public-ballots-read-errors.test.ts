import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/comunidad/quinielas/route";
import { listPublicRankings } from "../../src/lib/repositories/community";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  failTable: "",
  reads: [] as string[],
  clients: 0,
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/environment", () => ({
  isSupabaseConfigured: () => true,
}));
vi.mock("../../src/lib/supabase/server", () => ({
  createSupabaseServerClient: () => {
    state.clients += 1;
    return {
      from(table: string) {
        let rows = [...(state.tables[table] ?? [])];
        const query = {
          select: () => query,
          eq(column: string, value: unknown) {
            rows = rows.filter((row) => row[column] === value);
            return query;
          },
          in(column: string, values: unknown[]) {
            rows = rows.filter((row) => values.includes(row[column]));
            return query;
          },
          or: () => query,
          order: () => query,
          then(resolve: (value: unknown) => unknown) {
            state.reads.push(table);
            return Promise.resolve(
              table === state.failTable
                ? {
                    data: null,
                    count: null,
                    error: {
                      code: "57014",
                      message: "Sensitive database failure detail",
                    },
                  }
                : {
                    data: structuredClone(rows),
                    count: rows.length,
                    error: null,
                  },
            ).then(resolve);
          },
        };
        return query;
      },
    };
  },
  createSupabaseAuthServerClient: () => {
    throw new Error("An anonymous summary must not use a cookie-aware client");
  },
}));

beforeEach(() => {
  state.clients = 0;
  state.reads = [];
  state.failTable = "";
  state.tables = {
    user_rankings: [
      {
        id: "ranking",
        user_id: "account-id",
        season_id: "oscars-2027",
        category_id: "best-picture",
        is_public: true,
        updated_at: "2026-11-24T09:00:00Z",
      },
    ],
    user_profiles: [
      {
        user_id: "account-id",
        slug: "film-fan",
        display_name: "Film Fan",
        is_public: true,
      },
    ],
    user_ranking_entries: [
      {
        id: "entry",
        ranking_id: "ranking",
        category_candidate_id: "candidate",
        custom_label: null,
        position: 1,
      },
    ],
    category_candidates: [
      { id: "candidate", film_id: "film", display_label: "Public film" },
    ],
    films: [{ id: "film", title: "Public film" }],
    user_film_states: [
      { user_id: "account-id", film_id: "film", status: "watched" },
    ],
  };
});

function request() {
  return new Request(
    "https://runscars.example/api/comunidad/quinielas?categoria=best-picture",
    { headers: { cookie: "sb-test-auth-token=ignored-session" } },
  );
}

describe("returned PostgREST errors in public ballot reads", () => {
  it.each([
    "user_rankings",
    "user_profiles",
    "user_ranking_entries",
    "category_candidates",
    "films",
    "user_film_states",
  ])(
    "returns an uncached 503 when %s fails rather than a fabricated empty success",
    async (table) => {
      state.failTable = table;
      const failed = await GET(request());
      expect(state.reads).toContain(table);
      expect(failed.status).toBe(503);
      expect(failed.headers.get("cache-control")).toBe("private, no-store");
      expect(await failed.json()).toEqual({
        error: "Public ballots unavailable",
      });

      state.failTable = "";
      const recovered = await GET(request());
      expect(recovered.status).toBe(200);
      expect(await recovered.json()).toEqual({
        total: 1,
        rankings: [
          {
            id: "ranking",
            categorySlug: "mejor-pelicula",
            profile: {
              slug: "film-fan",
              displayName: "Film Fan",
              initials: "FF",
            },
            entriesCount: 1,
            watchedCount: 1,
          },
        ],
      });
      expect(state.clients).toBe(2);
    },
  );

  it("also propagates a returned error when filtering by a public profile query", async () => {
    state.failTable = "user_profiles";
    await expect(
      listPublicRankings({
        seasonId: "oscars-2027",
        categoryId: "best-picture",
        query: "Film",
      }),
    ).rejects.toThrow("Sensitive database failure detail");
  });

  it("re-reads public visibility with the anonymous client and removes revoked ballots", async () => {
    const first = await GET(request());
    expect((await first.json()).rankings).toHaveLength(1);
    state.tables.user_rankings[0].is_public = false;
    const revoked = await GET(request());
    expect(revoked.status).toBe(200);
    expect(await revoked.json()).toEqual({ total: 0, rankings: [] });
    expect(state.clients).toBe(2);
    expect(
      state.reads.filter((table) => table === "user_rankings"),
    ).toHaveLength(2);
  });
});
