import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const database = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  fail: false,
  requests: [] as Array<{
    table: string;
    movieIds: number[];
    range: [number, number] | null;
  }>,
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (callback: unknown) => callback,
}));
vi.mock("../../src/lib/environment", () => ({
  isSupabaseConfigured: () => true,
}));
vi.mock("../../src/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    from(table: string) {
      let rows = [...(database.tables[table] ?? [])];
      const request = {
        table,
        movieIds: [] as number[],
        range: null as [number, number] | null,
      };
      const orders: Array<{ column: string; descending: boolean }> = [];
      const query = {
        select: () => query,
        in(column: string, ids: unknown[]) {
          if (column === "tmdb_id") {
            if (ids.length > 200) throw new Error("Oversized ID filter");
            request.movieIds = ids as number[];
          }
          rows = rows.filter((row) => ids.includes(row[column]));
          return query;
        },
        gt(column: string, value: string) {
          rows = rows.filter((row) => String(row[column]) > value);
          return query;
        },
        order(column: string, options?: { ascending?: boolean }) {
          orders.push({ column, descending: options?.ascending === false });
          return query;
        },
        range(from: number, to: number) {
          request.range = [from, to];
          return query;
        },
        then(resolve: (result: unknown) => unknown) {
          database.requests.push(request);
          rows.sort((a, b) => {
            for (const order of orders) {
              const comparison = String(a[order.column]).localeCompare(
                String(b[order.column]),
              );
              if (comparison)
                return order.descending ? -comparison : comparison;
            }
            return 0;
          });
          const from = request.range?.[0] ?? 0;
          const limit = request.range ? request.range[1] - from + 1 : 1000;
          return Promise.resolve(
            database.fail
              ? { data: null, error: { message: "Snapshot cache unavailable" } }
              : {
                  data: rows.slice(from, from + Math.min(limit, 1000)),
                  error: null,
                },
          ).then(resolve);
        },
      };
      return query;
    },
  }),
}));

import { getFestivalArtwork } from "../../src/lib/repositories/artwork";

// Synthetic snapshot rows exercise cache choices without calling external APIs.
function snapshot(overrides: Row = {}): Row {
  return {
    id: 1,
    tmdb_id: 1470198,
    locale: "es-ES",
    title: "Título localizado",
    release_date: "2026-01-24",
    runtime: 118,
    poster_path: null,
    backdrop_path: null,
    fetched_at: "2026-09-01T00:00:00Z",
    last_verified_at: "2026-10-07T10:00:00Z",
    expires_at: "2099-01-01T00:00:00Z",
    ...overrides,
  };
}
beforeEach(() => {
  database.tables = {};
  database.requests = [];
  database.fail = false;
});

describe("festival metadata independently of the Oscar catalogue", () => {
  it("uses only confirmed IDs and current localised snapshots, falling back to the other current poster", async () => {
    database.tables.tmdb_movie_snapshots = [
      snapshot({
        id: 1,
        last_verified_at: "2026-09-01T00:00:00Z",
        poster_path: "/withdrawn.jpg",
      }),
      snapshot({ id: 2 }),
      snapshot({
        id: 3,
        locale: "en-US",
        title: "Original title",
        poster_path: "/current-en.jpg",
      }),
      snapshot({
        id: 4,
        title: "Expired title",
        poster_path: "/expired.jpg",
        expires_at: "2000-01-01T00:00:00Z",
      }),
    ];
    const artwork = await getFestivalArtwork(
      [
        { id: "confirmed", filmId: null, tmdbId: 1470198 },
        { id: "unresolved-same-title", filmId: null, tmdbId: null },
      ],
      "es",
    );
    expect(artwork.confirmed).toMatchObject({
      title: "Título localizado",
      posterPath: "/current-en.jpg",
      runtime: 118,
      releaseDate: "2026-01-24",
    });
    expect(artwork["unresolved-same-title"]).toMatchObject({
      title: null,
      posterPath: null,
    });
    expect(
      database.requests.every(
        (request) => request.table === "tmdb_movie_snapshots",
      ),
    ).toBe(true);
  });

  it("does not revive withdrawn posters or borrow an uncorroborated catalogue poster", async () => {
    database.tables.films = [{ id: "legacy-title-only", tmdb_id: 999 }];
    database.tables.tmdb_movie_snapshots = [
      snapshot({
        id: 1,
        last_verified_at: "2026-09-01T00:00:00Z",
        poster_path: "/withdrawn.jpg",
      }),
      snapshot({ id: 2 }),
      snapshot({ id: 3, tmdb_id: 999, poster_path: "/different-film.jpg" }),
    ];
    const artwork = await getFestivalArtwork(
      [{ id: "entry", filmId: "legacy-title-only", tmdbId: 1470198 }],
      "es",
    );
    expect(artwork.entry.posterPath).toBeNull();
    expect(artwork.entry.title).toBe("Título localizado");
    expect(
      database.requests.every(
        (request) => request.table === "tmdb_movie_snapshots",
      ),
    ).toBe(true);
  });

  it("orders restored identical snapshots by their latest verification, retaining legacy fetched-at fallback", async () => {
    database.tables.tmdb_movie_snapshots = [
      snapshot({
        id: 1,
        fetched_at: "2026-01-01T00:00:00Z",
        last_verified_at: "2026-10-07T10:00:00Z",
        poster_path: "/restored.jpg",
      }),
      snapshot({
        id: 2,
        fetched_at: "2026-09-01T00:00:00Z",
        last_verified_at: "2026-09-01T00:00:00Z",
        poster_path: "/replaced.jpg",
      }),
      snapshot({
        id: 3,
        tmdb_id: 1558701,
        last_verified_at: null,
        poster_path: "/legacy.jpg",
      }),
    ];
    const artwork = await getFestivalArtwork(
      [
        { id: "restored", filmId: null, tmdbId: 1470198 },
        { id: "legacy", filmId: null, tmdbId: 1558701 },
      ],
      "en",
    );
    expect(artwork.restored.posterPath).toBe("/restored.jpg");
    expect(artwork.legacy.posterPath).toBe("/legacy.jpg");
  });

  it("reads over 2,000 confirmed IDs in bounded batches and paginates long cache histories", async () => {
    database.tables.tmdb_movie_snapshots = Array.from(
      { length: 2053 },
      (_, i) => snapshot({ id: i + 1, tmdb_id: 1000000 + i }),
    );
    database.tables.tmdb_movie_snapshots.push(
      ...Array.from({ length: 601 }, (_, i) =>
        snapshot({
          id: 3000 + i,
          tmdb_id: 1000000,
          last_verified_at: "2025-01-01T00:00:00Z",
        }),
      ),
    );
    const artwork = await getFestivalArtwork(
      Array.from({ length: 2053 }, (_, i) => ({
        id: `entry-${i}`,
        filmId: null,
        tmdbId: 1000000 + i,
      })),
      "en",
    );
    expect(Object.keys(artwork)).toHaveLength(2053);
    expect(artwork["entry-2052"].title).toBe("Título localizado");
    expect(
      database.requests.every((request) => request.movieIds.length <= 200),
    ).toBe(true);
    expect(
      database.requests.some((request) => request.range?.[0] === 500),
    ).toBe(true);
  });

  it("keeps festival entries renderable if the optional metadata cache is unavailable", async () => {
    database.fail = true;
    const artwork = await getFestivalArtwork(
      [{ id: "entry", filmId: null, tmdbId: 1470198 }],
      "en",
    );
    expect(artwork.entry).toEqual({
      title: null,
      releaseDate: null,
      runtime: null,
      posterPath: null,
      backdropPath: null,
    });
  });
});
