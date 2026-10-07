import { describe, expect, it, vi } from "vitest";
import festivalManifest from "../../data/festivals/2026.json";
import { FESTIVAL_IDENTITY_EVIDENCE } from "../../../supabase/functions/_shared/festivals/identity-evidence.mjs";
import {
  corroborateFestivalMovie,
  enrichFestivalLinks,
  festivalIdentityClaim,
  FestivalTmdbResolver,
} from "../../../supabase/functions/_shared/festivals/external-links.mjs";

const entry = {
  entryId: 1,
  editionId: "sundance-2026",
  kind: "selection",
  originalTitle: "A Common Story",
  originalRecipient: "Anna Foglietta",
  originalData: {},
  originalSourceUrl: "https://festival.example/programme",
  originalCapturedAt: "2026-10-07T08:00:00Z",
};
const movie = (
  id: number,
  director = "Anna Foglietta",
  imdbId: string | null = "tt39307632",
) => ({
  id,
  title: "A Common Story",
  original_title: "Una storia",
  release_date: "2026-09-10",
  credits: { crew: [{ job: "Director", name: director }] },
  external_ids: { imdb_id: imdbId },
});
function api(
  searchPages: number[][],
  movies: Record<number, ReturnType<typeof movie>>,
) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname.endsWith("/search/movie")) {
      const page = Number(url.searchParams.get("page"));
      return Response.json({
        total_pages: searchPages.length,
        results: (searchPages[page - 1] ?? []).map((id) => ({ id })),
      });
    }
    return Response.json(movies[Number(url.pathname.split("/").at(-1))]);
  });
}

describe("festival identities separate from Oscar eligibility", () => {
  it("corroborates all archived Locarno award titles including verified parenthetical original/translated forms", () => {
    const awards = festivalManifest.sets.find(
      (set) => set.editionId === "locarno-2026" && set.kind === "awards",
    )!;
    expect(
      awards.entries.some(
        (award) =>
          award.originalTitle === "NU E LOCUL TAU AICI (YOU DON’T BELONG HERE)",
      ),
    ).toBe(true);
    for (const award of awards.entries) {
      const claim = festivalIdentityClaim(
        {
          ...entry,
          editionId: "locarno-2026",
          kind: "awards",
          originalTitle: award.originalTitle,
          originalRecipient: award.originalRecipient,
        },
        FESTIVAL_IDENTITY_EVIDENCE,
      );
      expect(claim.directors.length, award.originalTitle).toBeGreaterThan(0);
      const proof =
        FESTIVAL_IDENTITY_EVIDENCE.find((fact) =>
          fact.officialTitles.includes(award.originalTitle),
        ) ??
        FESTIVAL_IDENTITY_EVIDENCE.find(
          (fact) => fact.directors.join("|") === claim.directors.join("|"),
        )!;
      expect(
        corroborateFestivalMovie(
          {
            ...movie(11),
            title: proof.officialTitles[0],
            original_title: proof.officialTitles[0],
            credits: {
              crew: proof.directors.map((name) => ({ job: "Director", name })),
            },
          },
          claim,
        ),
        award.originalTitle,
      ).toMatchObject({ tmdbId: 11 });
    }
  });

  it("checks every page and exact homonym director before linking, with a shared identity cache", async () => {
    const fetcher = api([[11], [12]], {
      11: movie(11, "Wrong Director"),
      12: movie(12),
    });
    const resolver = new FestivalTmdbResolver({ token: "test-only", fetcher });
    const claim = festivalIdentityClaim(entry);
    expect(await resolver.resolve(claim)).toMatchObject({
      status: "confirmed",
      tmdbId: 12,
    });
    await resolver.resolve({
      ...claim,
      evidenceSourceUrl: "https://other.example/film",
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(
      fetcher.mock.calls.some(([input]) =>
        String(input).includes("primary_release_year"),
      ),
    ).toBe(false);
  });

  it("keeps ambiguity when another exact title/director has no IMDb ID", async () => {
    const resolver = new FestivalTmdbResolver({
      token: "test-only",
      fetcher: api([[11, 12]], {
        11: movie(11),
        12: movie(12, "Anna Foglietta", null),
      }),
    });
    expect(await resolver.resolve(festivalIdentityClaim(entry))).toMatchObject({
      status: "pending_review",
      reason: "ambiguous-exact-title-director",
    });
  });

  it("does not claim uniqueness for incomplete candidate pools", async () => {
    const resolver = new FestivalTmdbResolver({
      token: "test-only",
      fetcher: api([[11], [], [], [], [], []], { 11: movie(11) }),
    });
    expect(await resolver.resolve(festivalIdentityClaim(entry))).toMatchObject({
      status: "pending_review",
      reason: "incomplete-search-too-many-pages",
    });
  });

  it("preserves non-Latin identities and rejects empty punctuation keys", () => {
    const claim = {
      ...festivalIdentityClaim(entry),
      officialTitles: ["春天"],
      directors: ["王明"],
    };
    expect(
      corroborateFestivalMovie(
        { ...movie(11, "李明"), title: "秋天", original_title: "秋天" },
        claim,
      ),
    ).toBeNull();
    expect(
      corroborateFestivalMovie(
        { ...movie(11, "王明"), title: "春天", original_title: "春天" },
        claim,
      ),
    ).toMatchObject({ tmdbId: 11 });
    expect(
      corroborateFestivalMovie(
        { ...movie(11, "!!!"), title: "!!!", original_title: "!!!" },
        { ...claim, officialTitles: ["..."], directors: ["..."] },
      ),
    ).toBeNull();
  });

  it("distinguishes explicit production and release years without using the festival year", () => {
    const noYear = festivalIdentityClaim(entry);
    expect(noYear.productionYear).toBeNull();
    expect(noYear.releaseYear).toBeNull();
    const production = festivalIdentityClaim({
      ...entry,
      originalData: { countryAndYear: "Italy 2025" },
    });
    expect(corroborateFestivalMovie(movie(11), production)).toMatchObject({
      evidence: { sourceYearMatchesReleaseYear: false },
    });
    expect(
      corroborateFestivalMovie(
        { ...movie(11), release_date: "2019-01-01" },
        production,
      ),
    ).toBeNull();
    const release = festivalIdentityClaim({
      ...entry,
      originalData: { releaseYear: 2025 },
    });
    expect(corroborateFestivalMovie(movie(11), release)).toBeNull();
  });

  it("requires all explicitly credited directors, including crews longer than thirty people", () => {
    const claim = {
      ...festivalIdentityClaim(entry),
      directors: ["Naël Khleifi", "Lisa Debauche"],
    };
    const crew = Array.from({ length: 35 }, (_, index) => ({
      job: "Other",
      name: `Other ${index}`,
    }));
    crew.push(
      { job: "Director", name: "Nael Khleifi" },
      { job: "Director", name: "Lisa Debauche" },
    );
    expect(
      corroborateFestivalMovie({ ...movie(11), credits: { crew } }, claim),
    ).toMatchObject({ tmdbId: 11 });
    expect(
      corroborateFestivalMovie(movie(11, "Nael Khleifi"), claim),
    ).toBeNull();
  });

  it("requires a valid IMDb ID for the unique identity", async () => {
    const resolver = new FestivalTmdbResolver({
      token: "test-only",
      fetcher: api([[11]], {
        11: movie(11, "Anna Foglietta", "https://wrong.example/id"),
      }),
    });
    expect(await resolver.resolve(festivalIdentityClaim(entry))).toMatchObject({
      status: "pending_review",
      reason: "unique-identity-without-valid-imdb-id",
    });
  });

  it("does not interpret an actor award recipient as director; inherits only unique same-edition selection evidence", async () => {
    const award = {
      ...entry,
      entryId: 2,
      kind: "awards",
      originalRecipient: "An Actor",
    };
    expect(festivalIdentityClaim(award).directors).toEqual([]);
    const resolver = new FestivalTmdbResolver({
      token: "test-only",
      fetcher: api([[11]], { 11: movie(11) }),
    });
    const persist = vi.fn();
    const report = await enrichFestivalLinks({
      repository: { currentEntries: async () => [entry, award], persist },
      resolver,
      limit: 1,
      afterEntryId: 1,
      apply: true,
    });
    expect(report).toMatchObject({
      confirmed: 1,
      nextEntryId: 2,
      hasMore: false,
    });
    expect(persist.mock.calls[0][0]).toMatchObject({
      evidence: {
        claim: {
          evidenceKind: "same-edition-exact-title-selection-director",
          directors: ["Anna Foglietta"],
        },
      },
      originalSourceUrl: entry.originalSourceUrl,
    });
  });

  it("isolates network failures, supports a retry cursor and remains read-only by default", async () => {
    const resolver = {
      resolve: vi
        .fn()
        .mockRejectedValueOnce(new Error("HTTP 503"))
        .mockResolvedValueOnce({
          status: "pending_review",
          reason: "missing-explicit-director",
          candidates: [],
        }),
    };
    const persist = vi.fn();
    const report = await enrichFestivalLinks({
      repository: {
        currentEntries: async () => [entry, { ...entry, entryId: 10 }],
        persist,
      },
      resolver,
      limit: 2,
    });
    expect(report).toMatchObject({
      failed: 1,
      pending: 1,
      retryAfterEntryId: 0,
      nextEntryId: 10,
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("retries 429 with bounded backoff and a network timeout", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 429, headers: { "retry-after": "1" } }),
      )
      .mockResolvedValueOnce(Response.json({ total_pages: 0, results: [] }));
    const sleep = vi.fn(async () => {});
    const resolver = new FestivalTmdbResolver({
      token: "test-only",
      fetcher,
      sleep,
    });
    expect(await resolver.resolve(festivalIdentityClaim(entry))).toMatchObject({
      status: "unmatched",
    });
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
