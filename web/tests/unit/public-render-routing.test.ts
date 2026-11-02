import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  canonicalPublicRenderPath,
  selectPublicRenderPath,
} from "../../src/lib/rendering/public-route";
import { proxy } from "../../src/proxy";

const state = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("../../src/lib/supabase/proxy", () => ({
  updateSupabaseSessionWithResponse: state.updateSession,
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.updateSession.mockImplementation(
    (
      request: NextRequest,
      options: { requestHeaders: Headers; rewriteUrl?: URL },
    ) =>
      options.rewriteUrl
        ? NextResponse.rewrite(options.rewriteUrl, {
            request: { headers: options.requestHeaders },
          })
        : NextResponse.next({ request: { headers: request.headers } }),
  );
});

function select(
  path: string,
  options: { method?: string; cookie?: string; headers?: HeadersInit } = {},
) {
  const headers = new Headers(options.headers);
  if (options.cookie) headers.set("cookie", options.cookie);
  const request = new NextRequest(`https://runscars.test${path}`, {
    method: options.method ?? "GET",
    headers,
  });
  return selectPublicRenderPath({
    method: request.method,
    pathname: request.nextUrl.pathname,
    searchParams: request.nextUrl.searchParams,
    cookies: request.cookies.getAll(),
    headers: request.headers,
  });
}

describe("public HTML routing boundary", () => {
  it.each([
    ["/", "/public-render/es"],
    ["/en", "/public-render/en"],
    ["/peliculas/film-1", "/public-render/es/peliculas/film-1"],
    ["/en/peliculas/film-1", "/public-render/en/peliculas/film-1"],
    ["/personas/person-1", "/public-render/es/personas/person-1"],
    ["/en/personas/person-1", "/public-render/en/personas/person-1"],
  ])("routes anonymous %s by its URL", (path, target) => {
    expect(select(path)).toBe(target);
    expect(select(path, { method: "HEAD" })).toBe(target);
    expect(select(path, { cookie: "runscars-locale=en" })).toBe(target);
  });

  it("allows campaign and RSC parameters without treating them as content", () => {
    expect(
      select("/en?utm_source=test&gclid=1&fbclid=2&msclkid=3&_rsc=abc"),
    ).toBe("/public-render/en");
    expect(
      select("/", { cookie: "sb-example-auth-token-code-verifier=pkce" }),
    ).toBe("/public-render/es");
  });

  it.each(["POST", "PUT", "DELETE", "OPTIONS", "PATCH"])(
    "keeps %s requests on the existing action/SSR route",
    (method) => expect(select("/peliculas/film-1", { method })).toBeNull(),
  );

  it.each([
    "sb-example-auth-token",
    "sb-example-auth-token.0",
    "sb-example-auth-token.12",
    "__prerender_bypass",
    "__next_preview_data",
  ])("bypasses ISR for supplied %s cookies even if invalid", (name) => {
    expect(
      select("/en/peliculas/film-1", { cookie: `${name}=invalid` }),
    ).toBeNull();
  });

  it.each(["next-action", "authorization"])(
    "bypasses ISR when the %s header is supplied",
    (name) => expect(select("/", { headers: { [name]: "" } })).toBeNull(),
  );

  it.each([
    "/cuenta",
    "/en/admin",
    "/acceso",
    "/comunidad",
    "/usuarios/reader",
    "/temporadas/2027/mejor-pelicula",
    "/peliculas/film-1/extra",
    "/personas",
  ])("keeps %s outside the public HTML families", (path) => {
    expect(select(path)).toBeNull();
  });

  it.each(["corte=archive", "next=%2Fcuenta", "page=2", "lang=en", "unknown="])(
    "keeps a semantic or unknown query (%s) in SSR",
    (query) => expect(select(`/peliculas/film-1?${query}`)).toBeNull(),
  );

  it("does not let supplied internal headers choose the render or language", async () => {
    const response = await proxy(
      new NextRequest("https://runscars.test/personas/person-1", {
        headers: {
          "x-runscars-locale": "en",
          "x-runscars-path": "/cuenta",
          "x-middleware-rewrite": "/public-render/en",
        },
      }),
    );
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://runscars.test/public-render/es/personas/person-1",
    );
    expect(
      state.updateSession.mock.calls[0][1].requestHeaders.get(
        "x-runscars-locale",
      ),
    ).toBe("es");
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("preserves the English legacy rewrite for a supplied session", async () => {
    const response = await proxy(
      new NextRequest("https://runscars.test/en/peliculas/film-1", {
        headers: { cookie: "sb-example-auth-token.0=invalid" },
      }),
    );
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://runscars.test/peliculas/film-1",
    );
  });

  it("does not write a locale cookie for English public requests or Spanish aliases", async () => {
    const publicResponse = await proxy(
      new NextRequest("https://runscars.test/en"),
    );
    expect(publicResponse.headers.get("x-middleware-rewrite")).toBe(
      "https://runscars.test/public-render/en",
    );
    expect(publicResponse.headers.has("set-cookie")).toBe(false);
    const alias = await proxy(
      new NextRequest("https://runscars.test/es/peliculas/film-1"),
    );
    expect(alias.status).toBe(308);
    expect(alias.headers.get("location")).toBe(
      "https://runscars.test/peliculas/film-1",
    );
    expect(alias.headers.has("set-cookie")).toBe(false);
  });
});

describe("internal public render namespace", () => {
  it.each([
    ["/public-render/es", "/"],
    ["/public-render/en", "/en"],
    ["/public-render/es/peliculas/film-1", "/peliculas/film-1"],
    ["/public-render/en/personas/person-1", "/en/personas/person-1"],
  ])(
    "redirects direct GET requests for %s to the canonical path",
    async (path, canonical) => {
      expect(canonicalPublicRenderPath(path)).toBe(canonical);
      const response = await proxy(
        new NextRequest(`https://runscars.test${path}?utm_source=test`),
      );
      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(
        `https://runscars.test${canonical}?utm_source=test`,
      );
      expect(state.updateSession).not.toHaveBeenCalled();
    },
  );

  it.each(["/public-render", "/public-render/fr", "/public-render/es/cuenta"])(
    "does not expose an unsupported internal route %s",
    async (path) => {
      const response = await proxy(
        new NextRequest(`https://runscars.test${path}`),
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );

  it("rejects POST and action requests through the internal namespace", async () => {
    for (const options of [
      { method: "POST" },
      { headers: { "next-action": "action" } },
    ]) {
      const response = await proxy(
        new NextRequest("https://runscars.test/public-render/es", options),
      );
      expect(response.status).toBe(404);
      expect(response.headers.has("x-middleware-rewrite")).toBe(false);
    }
    expect(state.updateSession).not.toHaveBeenCalled();
  });
});
