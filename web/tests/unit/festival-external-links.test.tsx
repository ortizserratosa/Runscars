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
} from "../../src/lib/festivals/presentation";

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

function renderEntry(
  overrides: Partial<FestivalEntryView>,
  locale: "es" | "en" = "en",
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
    <FestivalEntries set={set} locale={locale} artwork={{}} />,
  );
}

describe("verified external festival links", () => {
  it("links a festival title to IMDb while leaving its catalogue matching unchanged", () => {
    const html = renderEntry({
      imdbId: "tt99990001",
      sourceFilmUrl: "https://festival.example/film",
    });
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
        imdbId: "tt99990002",
      },
      "es",
    );
    expect(html).toContain('href="/peliculas/catalog-film"');
    expect(html).toContain('href="https://www.imdb.com/title/tt99990002/"');
    expect(html).toContain("Festival only film");
  });

  it("renders unresolved identities as plain text and rejects malformed external destinations", () => {
    const html = renderEntry({
      imdbId: "javascript:invalid",
      sourceFilmUrl: "http://festival.example/film",
    });
    expect(html).toContain("Festival only film");
    expect(html).not.toContain("<a ");
    expect(festivalImdbUrl("tt1234567/path")).toBeNull();
    expect(festivalSourceFilmUrl("javascript:alert(1)")).toBeNull();
  });
});
