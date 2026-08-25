import { describe, expect, it } from "vitest";
import { tmdbImageUrl } from "../../src/lib/tmdb/images";

describe("TMDB image URLs", () => {
  it("requests a pre-sized CDN asset", () => {
    expect(tmdbImageUrl("/poster.jpg")).toBe(
      "https://image.tmdb.org/t/p/w500/poster.jpg",
    );
    expect(tmdbImageUrl("/portrait.jpg", "w185")).toBe(
      "https://image.tmdb.org/t/p/w185/portrait.jpg",
    );
  });

  it("rejects paths that could escape the TMDB image endpoint", () => {
    expect(tmdbImageUrl("https://example.com/poster.jpg")).toBeNull();
    expect(tmdbImageUrl("/folder/poster.jpg")).toBeNull();
    expect(tmdbImageUrl(null)).toBeNull();
  });
});
