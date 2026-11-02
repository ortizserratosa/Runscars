import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { homeMetadata, renderHome } from "../../src/app/views/HomeView";
import { filmMetadata, renderFilm } from "../../src/app/views/FilmPageView";
import {
  personMetadata,
  renderPerson,
} from "../../src/app/views/PersonPageView";
import { FilmWatchPanel } from "../../src/app/components/FilmWatchPanel";
import { phase71FixtureAggregate } from "../../src/data/phase71-fixture";
import type { ActiveCategoryView } from "../../src/lib/categories/data";

const state = vi.hoisted(() => ({
  locale: vi.fn(),
  auth: vi.fn(),
  film: vi.fn(),
  person: vi.fn(),
  category: null as ActiveCategoryView | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: state.locale,
  getRequestPath: () => {
    throw new Error("Unexpected request pathname read");
  },
}));
vi.mock("../../src/lib/auth/session", () => ({
  getCurrentUser: state.auth,
  requireCurrentUser: () => {
    throw new Error("Unexpected private action");
  },
}));
vi.mock("../../src/lib/repositories/catalog", () => ({
  getFilmCatalogDetail: state.film,
  getPersonCatalogDetail: state.person,
}));
vi.mock("../../src/lib/repositories/signals", () => ({
  getFilmPredictions: async () => [],
  getFilmMetacriticScore: async () => null,
}));
vi.mock("../../src/lib/categories/data", () => ({
  getCategoryView: async () => state.category,
}));
vi.mock("../../src/lib/repositories/artwork", () => ({
  getFilmArtwork: async () => ({}),
}));
vi.mock("../../src/lib/festivals/data", () => ({
  getFilmFestivalContext: async () => [],
}));
vi.mock("../../src/lib/precursors/data", () => ({
  getFilmPrecursorContext: async () => [],
}));

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://runscars.example");
  state.auth.mockReset().mockImplementation(() => {
    throw new Error("Unexpected private session read");
  });
  state.locale.mockReset().mockImplementation(() => {
    throw new Error("Unexpected request locale/header read");
  });
  state.film.mockReset().mockImplementation(async (id: string) => ({
    id,
    title: "Editorial film",
    alternateTitles: [],
    releaseStatus: "upcoming",
    editorialReleaseDate: null,
    verificationUrl: null,
    notes: null,
    tmdb: null,
    credits: [],
  }));
  state.person.mockReset().mockImplementation(async (id: string) => ({
    id,
    name: "Public Person",
    tmdb: null,
    films: [
      { id: "public-film", title: "Editorial film", roles: ["Director"] },
    ],
  }));
  state.category = {
    mode: "active",
    seasonYear: 2027,
    aggregate: phase71FixtureAggregate("best-picture"),
    markets: { kalshi: [], polymarket: [] },
    dataState: "database",
    sourceFreshness: [],
    currentCandidates: [],
    snapshot: null,
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function findPersonalPanel(node: ReactNode): boolean {
  if (Array.isArray(node)) return node.some(findPersonalPanel);
  if (!React.isValidElement<{ children?: ReactNode }>(node)) return false;
  return node.type === FilmWatchPanel || findPersonalPanel(node.props.children);
}

describe("locale-explicit anonymous render views", () => {
  it.each(["es", "en"] as const)(
    "renders all three full public views without reading a session or request in %s",
    async (locale) => {
      const home = renderToStaticMarkup(await renderHome(locale));
      const filmTree = await renderFilm("public-film", locale, true);
      const film = renderToStaticMarkup(filmTree);
      const person = renderToStaticMarkup(
        await renderPerson("public-person", locale),
      );
      expect(home).toContain(
        locale === "en" ? "Oscar predictions 2027" : "Predicciones Oscar 2027",
      );
      expect(film).toContain(
        locale === "en" ? "Have you seen it?" : "¿Ya la has visto?",
      );
      expect(film).toContain(
        `href="${locale === "en" ? "/en/acceso" : "/acceso"}"`,
      );
      expect(film).not.toContain("<form");
      expect(findPersonalPanel(filmTree)).toBe(false);
      expect(person).toContain(
        locale === "en" ? "Related films" : "Películas relacionadas",
      );
      for (const html of [home, film, person]) {
        expect(html).toContain(
          `"inLanguage":"${locale === "en" ? "en-GB" : "es-ES"}"`,
        );
        expect(html).not.toContain("public-render");
      }
      expect(state.film).toHaveBeenCalledWith(
        "public-film",
        locale === "en" ? "en-US" : "es-ES",
      );
      expect(state.person).toHaveBeenCalledWith(
        "public-person",
        locale === "en" ? "en-US" : "es-ES",
      );
      expect(state.auth).not.toHaveBeenCalled();
      expect(state.locale).not.toHaveBeenCalled();
    },
  );

  it.each(["es", "en"] as const)(
    "builds visible canonical metadata independently of the internal render path in %s",
    async (locale) => {
      const prefix = locale === "en" ? "/en" : "";
      const metadata = await Promise.all([
        homeMetadata(locale),
        filmMetadata("public-film", locale),
        personMetadata("public-person", locale),
      ]);
      expect(metadata.map((item) => item.alternates?.canonical)).toEqual([
        prefix || "/",
        `${prefix}/peliculas/public-film`,
        `${prefix}/personas/public-person`,
      ]);
      expect(JSON.stringify(metadata)).not.toContain("public-render");
      expect(state.locale).not.toHaveBeenCalled();
      expect(state.auth).not.toHaveBeenCalled();
    },
  );

  it("retains the personal server panel for the legacy session route", async () => {
    expect(findPersonalPanel(await renderFilm("public-film", "en"))).toBe(true);
    // The session-aware component still performs its normal checks. Selecting
    // the anonymous variant never replaces authorization on this SSR path.
    state.auth.mockResolvedValue(null);
    state.locale.mockResolvedValue("en");
    const panel = await FilmWatchPanel({ filmId: "public-film" });
    expect(renderToStaticMarkup(panel)).toContain(
      "Sign in to save this state privately.",
    );
    expect(state.auth).toHaveBeenCalledOnce();
    expect(state.locale).toHaveBeenCalledOnce();
  });
});
