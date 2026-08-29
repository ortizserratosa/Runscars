import { describe, expect, it } from "vitest";
import {
  isMetacriticTitleUrl,
  metascoreTone,
  parseMetacriticValues,
} from "../../src/lib/critical/metacritic";

describe("Metacritic film context", () => {
  it("uses the official Metascore colour thresholds", () => {
    expect(metascoreTone(100)).toBe("positive");
    expect(metascoreTone(61)).toBe("positive");
    expect(metascoreTone(60)).toBe("mixed");
    expect(metascoreTone(40)).toBe("mixed");
    expect(metascoreTone(39)).toBe("negative");
    expect(metascoreTone(0)).toBe("negative");
  });

  it("preserves score and critic count without normalising them", () => {
    expect(
      parseMetacriticValues(
        { score: 88, critic_review_count: 63 },
        { denominator: 63 },
      ),
    ).toEqual({ score: 88, reviewCount: 63 });
    expect(parseMetacriticValues({ score: 101 }, {})).toBeNull();
    expect(parseMetacriticValues({ score: 88.5 }, {})).toBeNull();
    expect(parseMetacriticValues({ score: "88" }, {})).toBeNull();
  });

  it("accepts only canonical HTTPS Metacritic movie pages", () => {
    expect(
      isMetacriticTitleUrl(
        "https://www.metacritic.com/movie/the-odyssey-2026/",
      ),
    ).toBe(true);
    expect(
      isMetacriticTitleUrl("https://www.metacritic.com/tv/the-odyssey/"),
    ).toBe(false);
    expect(
      isMetacriticTitleUrl(
        "https://www.metacritic.com/movie/the-odyssey-2026/critic-reviews/",
      ),
    ).toBe(false);
    expect(isMetacriticTitleUrl("https://example.com/movie/the-odyssey/")).toBe(
      false,
    );
  });
});
