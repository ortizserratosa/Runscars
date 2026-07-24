import { describe, expect, it } from "vitest";
import {
  awardsWatchRadar,
  awardsWatchRanking,
  candidates,
} from "../../src/app/data";
import {
  filmFixtures,
  filmHref,
  filmHrefForLabel,
  findFilmById,
} from "../../src/data/films";

describe("film routes", () => {
  it("gives every candidate a canonical detail route", () => {
    for (const candidate of candidates) {
      expect(findFilmById(candidate.id)?.title).toBe(candidate.title);
      expect(filmHref(candidate.id)).toBe(`/peliculas/${candidate.id}`);
    }
  });

  it("resolves every film label shown on the AwardsWatch page", () => {
    for (const label of [...awardsWatchRanking, ...awardsWatchRadar]) {
      expect(filmHrefForLabel(label), label).toMatch(
        /^\/peliculas\/[a-z0-9-]+$/,
      );
    }
  });

  it("keeps the complete 20-film phase 1 fixture", () => {
    expect(filmFixtures).toHaveLength(20);
    expect(new Set(filmFixtures.map((film) => film.id)).size).toBe(20);
  });
});
