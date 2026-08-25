import { describe, expect, it } from "vitest";
import { HISTORICAL_EDITIONS } from "../../src/lib/archive/historical";
import { PUBLIC_CATEGORIES } from "../../src/lib/categories/config";

describe("official historical archive", () => {
  it("covers the five previous ceremonies and all public categories", () => {
    expect(HISTORICAL_EDITIONS.map((edition) => edition.ceremonyYear)).toEqual([
      2026, 2025, 2024, 2023, 2022,
    ]);

    for (const edition of HISTORICAL_EDITIONS) {
      expect(edition.categories.map((category) => category.id)).toEqual(
        PUBLIC_CATEGORIES.map((category) => category.id),
      );
      expect(edition.sourceUrl).toBe(
        `https://www.oscars.org/oscars/ceremonies/${edition.ceremonyYear}`,
      );
      for (const category of edition.categories) {
        expect(category.nominees.length).toBeGreaterThanOrEqual(5);
        expect(
          category.nominees.filter((nominee) => nominee.winner),
        ).toHaveLength(1);
      }
    }
  });
});
