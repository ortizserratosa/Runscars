import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("image optimization configuration", () => {
  it("serves TMDB images directly instead of using hosted transformations", () => {
    expect(nextConfig.images).toMatchObject({
      unoptimized: true,
      remotePatterns: [
        {
          protocol: "https",
          hostname: "image.tmdb.org",
          pathname: "/t/p/**",
        },
      ],
    });
  });
});
