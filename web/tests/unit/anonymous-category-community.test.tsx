import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryPageView } from "../../src/app/temporadas/CategoryPageView";
import { PublicRankingView } from "../../src/app/comunidad/PublicRankingView";
import { phase71FixtureAggregate } from "../../src/data/phase71-fixture";
import { PUBLIC_CATEGORIES } from "../../src/lib/categories/config";
import type { ActiveCategoryView } from "../../src/lib/categories/data";

const state = vi.hoisted(() => ({
  auth: vi.fn(),
  locale: vi.fn(),
  community: vi.fn(),
  slots: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("../../src/lib/auth/session", () => ({
  getCurrentUser: state.auth,
  requireCurrentUser: state.auth,
}));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: state.locale,
}));
vi.mock("../../src/lib/repositories/community", () => ({
  listPublicRankings: state.community,
}));
vi.mock("../../src/lib/categories/nominee-slots", () => ({
  getNomineeSlots: state.slots,
}));
vi.mock("../../src/lib/festivals/data", () => ({
  getFestivalFilmIds: async () => new Set(),
}));

beforeEach(() => {
  vi.stubGlobal("React", React);
  for (const read of Object.values(state))
    read.mockReset().mockImplementation(() => {
      throw new Error("Unexpected request, session or community read");
    });
});
afterEach(() => vi.unstubAllGlobals());

describe("anonymous category community isolation", () => {
  it.each(["es", "en"] as const)(
    "renders the complete public category in %s without any request or user lookup",
    async (locale) => {
      const view: ActiveCategoryView = {
        mode: "active",
        seasonYear: 2027,
        aggregate: phase71FixtureAggregate("best-picture"),
        markets: { kalshi: [], polymarket: [] },
        dataState: "database",
        sourceFreshness: [],
        snapshot: null,
        currentCandidates: [
          { id: "candidate", label: "PRIVATE_PANEL_SENTINEL", filmId: null },
        ],
      };
      const html = renderToStaticMarkup(
        await CategoryPageView({
          category: PUBLIC_CATEGORIES[0],
          view,
          locale,
          anonymous: true,
        }),
      );
      const prefix = locale === "en" ? "/en" : "";
      expect(html).toContain(
        locale === "en"
          ? "Loading public ballots"
          : "Cargando quinielas públicas",
      );
      expect(html).toContain(
        `href="${prefix}/comunidad?category=best-picture"`,
      );
      expect(html).toContain(
        `href="${prefix}/quiniela?categoria=mejor-pelicula"`,
      );
      expect(html).toContain('aria-busy="true"');
      expect(html).not.toMatch(/PRIVATE_PANEL_SENTINEL|public-render|<form/);
      for (const read of Object.values(state))
        expect(read).not.toHaveBeenCalled();
    },
  );

  it.each(["es", "en"] as const)(
    "renders localized public links and escapes profile names in %s",
    (locale) => {
      const html = renderToStaticMarkup(
        <PublicRankingView
          categoryId="best-picture"
          categoryName="Mejor película"
          locale={locale}
          result={{
            total: 1,
            rankings: [
              {
                id: "ranking",
                categorySlug: "mejor-pelicula",
                profile: {
                  slug: "film-fan",
                  displayName: '<img src="x" onerror="alert(1)">',
                  initials: "FF",
                },
                entriesCount: 5,
                watchedCount: 2,
              },
            ],
          }}
        />,
      );
      expect(html).toContain(
        `href="${locale === "en" ? "/en" : ""}/usuarios/film-fan/mejor-pelicula"`,
      );
      expect(html).toContain("&lt;img");
      expect(html).not.toContain('<img src="x"');
      expect(state.auth).not.toHaveBeenCalled();
      expect(state.community).not.toHaveBeenCalled();
    },
  );
});
