import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../../src/app/page";
import { CategoryPageView } from "../../src/app/temporadas/CategoryPageView";
import { aggregatePredictionsV2 } from "../../src/lib/aggregation/v2";
import { phase71FixtureObservations } from "../../src/data/phase71-fixture";
import type { ActiveCategoryView } from "../../src/lib/categories/data";
import { PUBLIC_CATEGORIES } from "../../src/lib/categories/config";

const state = vi.hoisted(() => ({
  view: null as ActiveCategoryView | null,
  locale: "es" as "es" | "en",
  artwork: vi.fn(async () => ({})),
}));
vi.mock("../../src/lib/categories/data", () => ({
  getCategoryView: async () => state.view,
}));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/repositories/artwork", () => ({
  getFilmArtwork: state.artwork,
}));
vi.mock("../../src/lib/festivals/data", () => ({
  getFestivalFilmIds: async () => new Set(),
}));
vi.mock("../../src/app/temporadas/UserRankingPanel", () => ({
  UserRankingPanel: () => null,
}));
vi.mock("../../src/app/comunidad/PublicRankingModule", () => ({
  PublicRankingModule: () => null,
}));
vi.mock("../../src/app/components/ShareButton", () => ({
  ShareButton: () => null,
}));
vi.mock("../../src/app/components/PosterBlock", () => ({
  PosterBlock: () => null,
}));

function view(sourceCount: number, expired = false): ActiveCategoryView {
  const all = phase71FixtureObservations("best-picture");
  const orderedSources = [
    ...new Set(
      all
        .filter((item) => item.dataType === "prediction_ordered")
        .map((item) => item.sourceId),
    ),
  ].slice(0, sourceCount);
  const aggregate = aggregatePredictionsV2(
    all.filter((item) => orderedSources.includes(item.sourceId)),
    {
      seasonId: "oscars-2027",
      categoryId: "best-picture",
      intention: "nomination",
      cutoffDate: expired ? "2026-09-01T04:47:00Z" : "2026-07-25T04:47:00Z",
    },
  );
  return {
    mode: "active",
    seasonYear: 2027,
    aggregate,
    dataState: "database",
    markets: { kalshi: [], polymarket: [] },
    sourceFreshness: [],
    currentCandidates: [],
    snapshot: {
      id: "test-cut",
      contentHash: "a".repeat(64),
      lockedAt: aggregate.cutoffDate,
      isLatest: true,
      methodologyChanged: false,
      comparableProjection: false,
      comparisonDateIncomplete: false,
      comparisonLimited: false,
      previous: null,
      cuts: [
        {
          id: "test-cut",
          lockedAt: aggregate.cutoffDate,
          changedSources: [],
          isSelected: true,
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  state.locale = "es";
  state.artwork.mockClear();
});

afterEach(() => vi.unstubAllGlobals());

describe("public prediction states", () => {
  it.each(["es", "en"] as const)(
    "renders the empty homepage without a fabricated leader or error in %s",
    async (locale) => {
      state.locale = locale;
      state.view = view(5, true);
      const html = renderToStaticMarkup(await Home());
      expect(html).toContain(
        locale === "en"
          ? "No professional predictions are currently eligible"
          : "No hay predicciones profesionales vigentes",
      );
      expect(html).toContain(
        locale === "en"
          ? "View Best Picture history"
          : "Ver historial de Mejor película",
      );
      expect(html).not.toContain("hero-leader-name");
      expect(state.artwork).not.toHaveBeenCalled();
    },
  );

  it.each([2, 3])(
    "labels %i ranked sources as provisional across homepage and category",
    async (count) => {
      state.view = view(count);
      const home = renderToStaticMarkup(await Home());
      expect(home).toContain("Predicciones provisionales");
      expect(home).toContain("lidera el ranking provisional");
      expect(home).toContain(`${count} fuentes ordenadas disponibles`);
      const category = renderToStaticMarkup(
        await CategoryPageView({
          category: PUBLIC_CATEGORIES[0],
          view: state.view,
        }),
      );
      expect(category).toContain("Predicciones profesionales provisionales");
      expect(category).toContain(
        "El consenso profesional requiere al menos cuatro",
      );
      expect(category).not.toContain("Consenso profesional vigente");
      expect(category).not.toContain("<h2>Consenso profesional</h2>");
    },
  );

  it("calls four ranked sources consensus and keeps empty category history accessible", async () => {
    state.view = view(4);
    expect(renderToStaticMarkup(await Home())).toContain("lidera el consenso");
    expect(
      renderToStaticMarkup(
        await CategoryPageView({
          category: PUBLIC_CATEGORIES[0],
          view: state.view,
        }),
      ),
    ).toContain("<h2>Consenso profesional</h2>");
    state.view = view(4, true);
    const empty = renderToStaticMarkup(
      await CategoryPageView({
        category: PUBLIC_CATEGORIES[0],
        view: state.view,
      }),
    );
    expect(empty).toContain(
      "No hay predicciones profesionales vigentes en este corte",
    );
    expect(empty).toContain("corte=test-cut");
  });
});
