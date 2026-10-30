import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSupabaseSessionWithResponse } from "../../src/lib/supabase/proxy";
import { getCurrentUser } from "../../src/lib/auth/session";

const state = vi.hoisted(() => ({
  cookies: [] as Array<{ name: string; value: string }>,
  getClaims: vi.fn(),
  getUser: vi.fn(),
  createServerClient: vi.fn(),
  createAuthClient: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => state.cookies }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: state.createServerClient,
}));
vi.mock("../../src/lib/supabase/server", () => ({
  createSupabaseAuthServerClient: state.createAuthClient,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://session-test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anonymous-key-long-enough");
  state.cookies = [];
  state.createServerClient.mockReturnValue({
    auth: { getClaims: state.getClaims },
  });
  state.createAuthClient.mockResolvedValue({
    auth: { getUser: state.getUser },
  });
  state.getUser.mockResolvedValue({
    data: { user: { id: "verified-user" } },
    error: null,
  });
});

describe("anonymous session work", () => {
  it("preserves English rewrites and request headers without constructing auth for locale-only cookies", async () => {
    const request = new NextRequest(
      "https://runscars.test/en/personas/example",
      {
        headers: { cookie: "runscars-locale=en" },
      },
    );
    const response = await updateSupabaseSessionWithResponse(request, {
      requestHeaders: new Headers({ "x-runscars-locale": "en" }),
      rewriteUrl: new URL("https://runscars.test/personas/example"),
    });
    expect(state.createServerClient).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://runscars.test/personas/example",
    );
    expect(response.headers.get("x-middleware-request-x-runscars-locale")).toBe(
      "en",
    );
  });

  it.each(["sb-session-test-auth-token", "sb-session-test-auth-token.0"])(
    "still verifies and refreshes a supplied %s cookie",
    async (name) => {
      const request = new NextRequest("https://runscars.test/cuenta", {
        headers: { cookie: `${name}=untrusted-value` },
      });
      state.createServerClient.mockImplementation((_url, _key, options) => ({
        auth: {
          getClaims: async () => {
            state.getClaims();
            options.cookies.setAll(
              [{ name, value: "refreshed", options: { httpOnly: true } }],
              {},
            );
          },
        },
      }));
      const response = await updateSupabaseSessionWithResponse(request);
      expect(state.getClaims).toHaveBeenCalledOnce();
      expect(response.cookies.get(name)?.value).toBe("refreshed");
    },
  );

  it("returns anonymous without a session, including the OAuth verifier-only state", async () => {
    state.cookies = [
      { name: "sb-session-test-auth-token-code-verifier", value: "verifier" },
    ];
    expect(await getCurrentUser()).toBeNull();
    expect(state.createAuthClient).not.toHaveBeenCalled();
  });

  it("does not accept a cookie as identity without checking getUser", async () => {
    state.cookies = [
      { name: "sb-session-test-auth-token.1", value: "untrusted" },
    ];
    expect((await getCurrentUser())?.user.id).toBe("verified-user");
    state.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid session"),
    });
    expect(await getCurrentUser()).toBeNull();
    expect(state.getUser).toHaveBeenCalledTimes(2);
  });
});
