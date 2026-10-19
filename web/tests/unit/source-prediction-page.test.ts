import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import SourcePage from "../../src/app/fuentes/[slug]/page";

const state = vi.hoisted(() => ({ locale: "es" }));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/precursors/data", () => ({
  getPrecursorIndex: async () => [],
}));
vi.mock("../../src/lib/repositories/sources", () => ({
  getSourceDetail: async () => ({
    id: "radar",
    name: "Radar",
    homepageUrl: "https://example.com",
    sourceTypes: ["prediction"],
    health: "ok",
    lastSuccessfulCheckAt: "2026-10-19T04:17:00Z",
    lastFailureAt: null,
    lastCapturedAt: "2026-10-19T04:17:00Z",
    lastPublishedAt: "2026-09-01T00:00:00Z",
    lastChangedAt: null,
    festivalEditions: [],
    categories: [
      {
        categoryId: "best-picture",
        categorySlug: "mejor-pelicula",
        categoryName: "Mejor película",
        lastChangedAt: null,
        publication: {
          title: "Original prediction",
          url: "https://example.com/article",
          author: "Author",
          publishedAt: "2026-09-01T00:00:00Z",
          capturedAt: "2026-10-19T04:17:00Z",
        },
        originalCount: 50,
        matchedCount: 1,
        consideredCount: 0,
        scoringDepth: 20,
        expired: true,
        freshnessAt: "2026-09-01T00:00:00Z",
        expiresAt: "2026-10-01T00:00:00Z",
        health: "ok",
        lastSuccessfulCheckAt: "2026-10-19T04:17:00Z",
        entries: [
          {
            observationId: "1",
            candidateId: "tail",
            label: "Original tail",
            appearanceKind: "ordered",
            rank: 50,
            listLength: 50,
            considered: false,
            originalValue: { raw: "Unchanged original tail" },
            aggregatePosition: 0,
          },
        ],
      },
    ],
  }),
}));
afterEach(() => vi.unstubAllGlobals());

describe("expired source transparency in both languages", () => {
  it.each(["es", "en"])(
    "shows the original expired publication and its tail alongside a successful check in %s",
    async (locale) => {
      state.locale = locale;
      vi.stubGlobal("React", React);
      const html = renderToStaticMarkup(
        await SourcePage({ params: Promise.resolve({ slug: "radar" }) }),
      );
      expect(html).toContain(
        locale === "en" ? "EXPIRED PUBLICATION" : "PUBLICACIÓN VENCIDA",
      );
      expect(html).toContain(
        locale === "en" ? "Original entries" : "Candidaturas originales",
      );
      expect(html).toContain(
        locale === "en"
          ? "Considered in the current ranking"
          : "Consideradas en la clasificación actual",
      );
      expect(html).toContain(
        locale === "en"
          ? "does not renew the publication"
          : "no renueva la publicación",
      );
      expect(html).toContain(locale === "en" ? "Healthy" : "Correcto");
      expect(html).toContain("Original tail");
      expect(html).toContain("Unchanged original tail");
      expect(html).toContain("https://example.com/article");
      expect(html).not.toContain(
        locale === "en" ? "Coverage only" : "Solo cobertura",
      );
    },
  );
});
