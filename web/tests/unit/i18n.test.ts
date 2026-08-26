import { describe, expect, it } from "vitest";
import {
  localeFromPathname,
  localizedPath,
  stripLocalePrefix,
} from "../../src/lib/i18n/config";

describe("localized public paths", () => {
  it("keeps Spanish unprefixed and prefixes English", () => {
    expect(localizedPath("/", "es")).toBe("/");
    expect(localizedPath("/", "en")).toBe("/en");
    expect(localizedPath("/comunidad?q=ana#resultados", "es")).toBe(
      "/comunidad?q=ana#resultados",
    );
    expect(localizedPath("/comunidad?q=ana#results", "en")).toBe(
      "/en/comunidad?q=ana#results",
    );
  });

  it("switches locale without duplicating an existing prefix", () => {
    expect(localizedPath("/en/fuentes", "en")).toBe("/en/fuentes");
    expect(localizedPath("/en/fuentes", "es")).toBe("/fuentes");
    expect(localizedPath("/es/fuentes", "en")).toBe("/en/fuentes");
    expect(stripLocalePrefix("/en/temporadas/2027")).toBe("/temporadas/2027");
  });

  it("does not rewrite API, static or external URLs", () => {
    expect(localizedPath("/api/health", "en")).toBe("/api/health");
    expect(localizedPath("/og.png", "en")).toBe("/og.png");
    expect(localizedPath("https://example.com/path", "en")).toBe(
      "https://example.com/path",
    );
  });

  it("recognizes only supported path prefixes", () => {
    expect(localeFromPathname("/en")).toBe("en");
    expect(localeFromPathname("/es/fuentes")).toBe("es");
    expect(localeFromPathname("/english")).toBeNull();
  });
});
