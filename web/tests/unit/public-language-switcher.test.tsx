import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicLanguageSwitcher } from "../../src/app/components/PublicLanguageSwitcher";

const state = vi.hoisted(() => ({
  pathname: "/public-render/es/peliculas/example",
  query: "",
  requestAvailable: false,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => {
    if (!state.requestAvailable) throw new Promise(() => {});
    return new URLSearchParams(state.query);
  },
}));

beforeEach(() => {
  state.pathname = "/public-render/es/peliculas/example";
  state.query = "";
  state.requestAvailable = false;
});

describe("public language links", () => {
  it("prerenders a usable link for the same film without request query data", () => {
    const html = renderToStaticMarkup(<PublicLanguageSwitcher locale="es" />);
    expect(html).toContain('href="/en/peliculas/example"');
    expect(html).toContain('hrefLang="en"');
    expect(html).not.toContain("public-render");
  });

  it("prerenders the canonical Spanish person link from the English render path", () => {
    state.pathname = "/public-render/en/personas/example";
    const html = renderToStaticMarkup(<PublicLanguageSwitcher locale="en" />);
    expect(html).toContain('href="/personas/example"');
    expect(html).not.toContain("public-render");
  });

  it("preserves query parameters once the browser provides them", () => {
    state.pathname = "/en/peliculas/example";
    state.query = "utm_source=weekly&corte=historic";
    state.requestAvailable = true;
    const html = renderToStaticMarkup(<PublicLanguageSwitcher locale="en" />);
    expect(html).toContain(
      'href="/peliculas/example?utm_source=weekly&amp;corte=historic"',
    );
  });
});
