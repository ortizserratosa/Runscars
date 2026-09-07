import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteUrl, buildLocalizedMetadata } from "../../src/lib/seo";
import {
  loginDestination,
  safeReturnPath,
} from "../../src/lib/auth/return-path";

afterEach(() => vi.unstubAllEnvs());
describe("canonical URLs and login destinations", () => {
  it("uses the public origin with reciprocal language alternatives", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://runscars.app");
    const metadata = buildLocalizedMetadata({
      locale: "en",
      path: "/festivales",
      title: "Festivals",
      description: "Official festival selections.",
    });
    expect(metadata.alternates).toMatchObject({
      canonical: "/en/festivales",
      languages: {
        es: "/festivales",
        en: "/en/festivales",
        "x-default": "/festivales",
      },
    });
    expect(absoluteUrl("/en/festivales")).toBe(
      "https://runscars.app/en/festivales",
    );
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "invalid");
    expect(absoluteUrl("/")).toBe("https://runscars.app/");
  });
  it("preserves the destination, language, filters and cut through login", () => {
    expect(
      loginDestination(
        "/temporadas/2027/mejor-pelicula?corte=earlier#ranking",
        "en",
      ),
    ).toBe("/en/temporadas/2027/mejor-pelicula?corte=earlier#ranking");
    expect(loginDestination("/en/comunidad?categoria=actor", "es")).toBe(
      "/comunidad?categoria=actor",
    );
  });
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/\nevil.test",
    "/api/locale",
    "/en/acceso?next=/acceso",
  ])("rejects an unsafe or recursive login destination: %s", (value) => {
    expect(safeReturnPath(value)).toBe("/cuenta");
  });
});
