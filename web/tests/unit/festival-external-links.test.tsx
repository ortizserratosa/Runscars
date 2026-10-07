import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FestivalEntries } from "../../src/app/festivales/FestivalEntries";
import type {
  FestivalEntryView,
  FestivalSetView,
} from "../../src/lib/festivals/data";
import {
  festivalImdbUrl,
  festivalSourceFilmUrl,
  festivalTmdbUrl,
} from "../../src/lib/festivals/presentation";
import type { FestivalFilmArtwork } from "../../src/lib/repositories/artwork";
import { PosterBlock } from "../../src/app/components/PosterBlock";

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

function renderEntry(
  overrides: Partial<FestivalEntryView>,
  locale: "es" | "en" = "en",
  artwork: Record<string, FestivalFilmArtwork> = {},
) {
  const entry: FestivalEntryView = {
    id: "test-entry",
    order: 1,
    section: "Competition",
    originalTitle: "Festival only film",
    originalRecipient: "Director",
    awardType: null,
    filmId: null,
    filmTitle: null,
    matchStatus: "unmatched",
    ...overrides,
  };
  const set: FestivalSetView = {
    id: "test-set",
    kind: "selection",
    version: 1,
    sourceUrl: "https://festival.example/selection",
    sourceTitle: "Official selection",
    publishedAt: null,
    capturedAt: "2026-10-07T09:00:00Z",
    extractorVersion: "test",
    entries: [entry],
  };
  return renderToStaticMarkup(
    <FestivalEntries set={set} locale={locale} artwork={artwork} />,
  );
}

describe("verified external festival links", () => {
  it("uses verified TMDB for a festival title and poster outside the Oscar catalogue, with IMDb secondary", () => {
    const html = renderEntry(
      {
        tmdbId: 1470198,
        imdbId: "tt99990001",
        sourceFilmUrl: "https://festival.example/film",
      },
      "en",
      {
        "test-entry": {
          title: "Localized movie title",
          releaseDate: "2026-01-24",
          runtime: 118,
          posterPath: "/verified-poster.jpg",
          backdropPath: null,
        },
      },
    );
    expect(html).toMatch(
      /<h3><a href="https:\/\/www.themoviedb.org\/movie\/1470198"/,
    );
    expect(html).toContain('class="festival-entry-poster"');
    expect(html).toContain("verified-poster.jpg");
    expect(html).toContain("Localized movie title · 2026 · 118 min");
    expect(html).toMatch(/<h3><a[^>]*>Festival only film /);
    expect(html).not.toContain("OSCAR");
    expect(html).toContain('href="https://www.imdb.com/title/tt99990001/"');
    expect(html).toContain('href="https://festival.example/film"');
    expect(html).toContain("Film in the source");
    expect(html).not.toContain("/peliculas/");
  });

  it("retains the catalogue title link and provides a separate IMDb link when both exist", () => {
    const html = renderEntry(
      {
        filmId: "catalog-film",
        filmTitle: "Catalogue film",
        matchStatus: "matched",
        tmdbId: 1470198,
        imdbId: "tt99990002",
      },
      "es",
    );
    expect(html).toContain('href="/peliculas/catalog-film"');
    expect(html).toContain('href="https://www.imdb.com/title/tt99990002/"');
    expect(html).toContain('href="https://www.themoviedb.org/movie/1470198"');
    expect(html).toContain("Festival only film");
  });

  it("renders unresolved identities as plain text and rejects malformed external destinations", () => {
    const html = renderEntry({
      imdbId: "javascript:invalid",
      tmdbId: -42,
      sourceFilmUrl: "http://festival.example/film",
    });
    expect(html).toContain("Festival only film");
    expect(html).not.toContain("<a ");
    expect(festivalImdbUrl("tt1234567/path")).toBeNull();
    expect(festivalSourceFilmUrl("javascript:alert(1)")).toBeNull();
    expect(festivalTmdbUrl(1.5)).toBeNull();
    expect(festivalTmdbUrl(Number.NaN)).toBeNull();
  });

  it("keeps a verified TMDB link and an unbranded title placeholder when no poster is available", () => {
    const html = renderEntry({ tmdbId: 1558701, imdbId: null });
    expect(html).toContain('href="https://www.themoviedb.org/movie/1558701"');
    expect(html).toContain('class="poster-title"');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("OSCAR");
    expect(html).not.toContain("IMDb");
  });

  it("preserves the default Oscar label outside festival context", () => {
    const html = renderToStaticMarkup(<PosterBlock title="Catalogue film" />);
    expect(html).toContain("OSCAR · 2027");
  });
});
