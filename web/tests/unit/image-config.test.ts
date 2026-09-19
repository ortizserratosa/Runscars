import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("image optimization configuration", () => {
  it("serves images directly without app-owned optimizer sources", () => {
    expect(nextConfig.images).toMatchObject({
      unoptimized: true,
      localPatterns: [],
      remotePatterns: [],
    });
  });
});
