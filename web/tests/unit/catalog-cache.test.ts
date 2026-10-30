import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configured: true,
  reads: [] as string[],
  entries: new Map<string, unknown>(),
  expiresAt: "2099-01-01T00:00:00.000Z",
  failPeople: false,
}));
vi.mock("server-only", () => ({}));
// React's cache is scoped to one render. Keep separate invocations separate in
// this unit so it cannot mask the public cache's ID/locale/privacy boundary.
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: (...args: unknown[]) => Promise<unknown>, keys: string[]) =>
    async (...args: unknown[]) => {
      const key = JSON.stringify([keys, args]);
      if (state.entries.has(key)) return state.entries.get(key);
      const value = await fn(...args);
      state.entries.set(key, value);
      return value;
    },
}));
vi.mock("../../src/lib/environment", () => ({
  isSupabaseConfigured: () => state.configured,
}));
vi.mock("../../src/lib/supabase/server", () => ({
  // Auth/admin clients are deliberately absent: shared catalog data must use
  // the anonymous RLS client even when called from a signed-in page.
  createSupabaseServerClient: () => ({
    from(table: string) {
      let id = "";
      let locale = "es-ES";
      let expiresAfter: string | undefined;
      function result() {
        state.reads.push(`${table}:${id}:${locale}`);
        if (table === "people")
          return state.failPeople
            ? { data: null, error: { message: "unavailable" } }
            : { data: { id, name: id, tmdb_id: 1 }, error: null };
        if (table === "films")
          return {
            data: {
              id,
              title: "Editorial title",
              alternate_titles: [],
              release_status: "upcoming",
              tmdb_id: 1,
            },
            error: null,
          };
        if (table === "tmdb_movie_snapshots")
          return {
            data:
              expiresAfter && state.expiresAt <= expiresAfter
                ? []
                : [
                    {
                      tmdb_id: 1,
                      locale,
                      title: locale === "en-US" ? "English title" : "Título",
                      genres: [],
                      expires_at: state.expiresAt,
                    },
                  ],
            error: null,
          };
        return { data: [], error: null };
      }
      const query = {
        select: () => query,
        eq: (_key: string, value: string) => {
          id = value;
          return query;
        },
        in: (_key: string, values: string[]) => {
          locale = values[0];
          return query;
        },
        gt: (_key: string, value: string) => {
          expiresAfter = value;
          return query;
        },
        order: () => query,
        maybeSingle: async () => result(),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  }),
}));

import {
  getFilmCatalogDetail,
  getPersonCatalogDetail,
} from "../../src/lib/repositories/catalog";

beforeEach(() => {
  state.configured = true;
  state.reads.length = 0;
  state.entries.clear();
  state.expiresAt = "2099-01-01T00:00:00.000Z";
  state.failPeople = false;
  vi.useRealTimers();
});

describe("anonymous catalog cache boundaries", () => {
  it("reuses person reads while keeping IDs and locales separate", async () => {
    await getPersonCatalogDetail("person-a");
    const firstReads = state.reads.length;
    await getPersonCatalogDetail("person-a");
    expect(state.reads).toHaveLength(firstReads);
    await getPersonCatalogDetail("person-b");
    await getPersonCatalogDetail("person-a", "en-US");
    expect(
      state.reads.filter((read) => read.startsWith("people:")),
    ).toHaveLength(3);
  });

  it("keeps localized film metadata separate", async () => {
    expect((await getFilmCatalogDetail("film"))?.title).toBe("Título");
    expect((await getFilmCatalogDetail("film", "en-US"))?.title).toBe(
      "English title",
    );
    const firstReads = state.reads.length;
    await getFilmCatalogDetail("film");
    expect(state.reads).toHaveLength(firstReads);
  });

  it("does not extend TMDB expiry with the cache lifetime", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    state.expiresAt = "2026-10-30T12:00:01.000Z";
    expect((await getFilmCatalogDetail("film"))?.tmdb).not.toBeNull();
    vi.setSystemTime(new Date("2026-10-30T12:00:02Z"));
    const expired = await getFilmCatalogDetail("film");
    expect(expired?.tmdb).toBeNull();
    expect(expired?.title).toBe("Editorial title");
    expect(expired?.credits).toEqual([]);
  });

  it("preserves errors and retries after a failed anonymous read", async () => {
    state.failPeople = true;
    await expect(getPersonCatalogDetail("person-a")).rejects.toThrow(
      "unavailable",
    );
    state.failPeople = false;
    expect((await getPersonCatalogDetail("person-a"))?.id).toBe("person-a");
  });

  it("keeps unconfigured fixtures outside the database cache", async () => {
    state.configured = false;
    expect(await getPersonCatalogDetail("person-a")).toBeNull();
    expect((await getFilmCatalogDetail("the-odyssey"))?.id).toBe("the-odyssey");
    expect(state.reads).toEqual([]);
    expect(state.entries.size).toBe(0);
  });
});
