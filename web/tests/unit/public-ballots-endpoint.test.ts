import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/comunidad/quinielas/route";

const state = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../../src/lib/repositories/community", () => ({
  listPublicRankings: state.list,
}));

function ranking(index: number) {
  return {
    id: `ranking-${index}`,
    categorySlug: "mejor-pelicula",
    entriesCount: 5,
    watchedCount: 2,
    profile: {
      slug: `film-fan-${index}`,
      displayName: `Film Fan ${index}`,
      initials: "FF",
      userId: `private-account-${index}`,
      email: `private-${index}@example.com`,
    },
    userId: `private-account-${index}`,
    updatedAt: "2026-11-24T09:00:00Z",
    isPublic: true,
    entries: [{ label: "A ranking entry is not needed by the summary" }],
  };
}

beforeEach(() => {
  state.list.mockReset().mockResolvedValue({
    total: 8,
    rankings: Array.from({ length: 8 }, (_, index) => ranking(index)),
    page: 1,
    pageSize: 12,
  });
});

describe("live public-ballot summaries", () => {
  it("returns only three minimal public summaries and never enables response caching", async () => {
    const response = await GET(
      new Request(
        "https://runscars.example/api/comunidad/quinielas?categoria=best-picture&season=private-season&page=9",
        { headers: { cookie: "sb-test-auth-token=untrusted-session" } },
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(state.list).toHaveBeenCalledExactlyOnceWith({
      seasonId: "oscars-2027",
      categoryId: "best-picture",
    });
    const result = await response.json();
    expect(Object.keys(result).sort()).toEqual(["rankings", "total"]);
    expect(result.total).toBe(8);
    expect(result.rankings).toHaveLength(3);
    for (const summary of result.rankings) {
      expect(Object.keys(summary).sort()).toEqual([
        "categorySlug",
        "entriesCount",
        "id",
        "profile",
        "watchedCount",
      ]);
      expect(Object.keys(summary.profile).sort()).toEqual([
        "displayName",
        "initials",
        "slug",
      ]);
    }
    expect(JSON.stringify(result)).not.toMatch(
      /private-account|private-\d@|updatedAt|isPublic|ranking entry/,
    );
  });

  it.each(["", "not-a-category", "mejor-pelicula", "../../cuenta"])(
    "rejects the invalid category %j before consulting community data",
    async (category) => {
      const response = await GET(
        new Request(
          `https://runscars.example/api/comunidad/quinielas?categoria=${encodeURIComponent(category)}`,
        ),
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(state.list).not.toHaveBeenCalled();
    },
  );

  it("reports an unavailable backend without leaking its error or caching the failure", async () => {
    state.list.mockRejectedValueOnce(
      new Error("Sensitive backend error detail"),
    );
    const request = () =>
      new Request(
        "https://runscars.example/api/comunidad/quinielas?categoria=best-picture",
      );
    const failed = await GET(request());
    expect(failed.status).toBe(503);
    expect(failed.headers.get("cache-control")).toBe("private, no-store");
    expect(await failed.json()).toEqual({
      error: "Public ballots unavailable",
    });
    expect((await GET(request())).status).toBe(200);
    expect(state.list).toHaveBeenCalledTimes(2);
  });

  it("re-reads the repository after a public ballot is revoked", async () => {
    const request = () =>
      new Request(
        "https://runscars.example/api/comunidad/quinielas?categoria=best-picture",
      );
    const first = await GET(request());
    expect((await first.json()).rankings).toHaveLength(3);
    state.list.mockResolvedValue({ total: 0, rankings: [] });
    const revoked = await GET(request());
    expect(revoked.headers.get("cache-control")).toBe("private, no-store");
    expect(await revoked.json()).toEqual({ total: 0, rankings: [] });
    expect(state.list).toHaveBeenCalledTimes(2);
  });
});
