import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (callback: unknown) => callback,
}));
vi.mock("../../src/lib/environment", () => ({
  isSupabaseConfigured: () => false,
}));
vi.mock("../../src/lib/supabase/server", () => ({
  createSupabaseServerClient: () => null,
}));

import { getFestivalIndex } from "../../src/lib/festivals/data";
import externalLinksFixture from "../../data/festivals/2026-external-links-fixture.json";

describe("festival fixtures use current reviewed captures", () => {
  it("provides verified IMDb identities for films outside the Oscar catalogue", async () => {
    const editions = await getFestivalIndex();
    expect(externalLinksFixture.links).toHaveLength(2);
    for (const link of externalLinksFixture.links) {
      const entry = editions
        .find((edition) => edition.id === link.editionId)
        ?.selection?.entries.find(
          (entry) => entry.originalTitle === link.originalTitle,
        );
      expect(entry).toMatchObject({
        imdbId: link.imdbId,
        filmId: null,
        matchStatus: "unmatched",
      });
    }
  });

  it("picks the latest capture per kind and presents its dates, coverage and publication state", async () => {
    const editions = await getFestivalIndex();
    const cannes = editions.find((edition) => edition.festivalId === "cannes");
    expect(cannes?.selection?.entries).toHaveLength(76);
    expect(cannes?.awards?.entries).toHaveLength(16);
    expect(cannes?.selection?.version).toBe(2);
    expect(cannes?.awards?.version).toBe(2);
    expect(cannes?.awards?.publishedAt).toBe("2026-05-23T20:44:54Z");
    const tiff = editions.find((edition) => edition.festivalId === "tiff");
    expect(tiff?.selection?.entries).toHaveLength(206);
    expect(tiff?.awardsStatus).toBe("published");
    expect(tiff?.status).toBe("completed");
    expect(tiff?.selectionUrl).toBe("https://tiff.net/films?thumbnail");
    expect(
      editions.find((edition) => edition.festivalId === "locarno")?.selection
        ?.coverageNote?.es,
    ).toContain("Selección parcial");
    expect(
      editions.find((edition) => edition.festivalId === "nyff")?.selection
        ?.coverageNote?.en,
    ).toContain("Main Slate");
    expect(
      editions.filter((edition) => edition.status === "completed"),
    ).toHaveLength(8);
    expect(
      editions.find((edition) => edition.festivalId === "nyff")?.status,
    ).toBe("ongoing");
  });
});
