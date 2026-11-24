import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LivePublicRankingModule } from "../../src/app/comunidad/LivePublicRankingModule";

type Effect = () => void | (() => void);
const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  dependencies: null as unknown[] | null,
  pending: null as Effect | null,
  cleanup: null as (() => void) | null,
}));

// A tiny hook dispatcher keeps this race test independent of a DOM emulator.
// Fetches can resolve after abort deliberately, exercising the generation guard.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = hooks.cursor++;
      if (index >= hooks.values.length) hooks.values[index] = initial;
      return [
        hooks.values[index],
        (value: unknown) => {
          hooks.values[index] = value;
        },
      ];
    },
    useEffect: (effect: Effect, dependencies: unknown[]) => {
      if (
        !hooks.dependencies ||
        dependencies.some(
          (value, index) => value !== hooks.dependencies?.[index],
        )
      ) {
        hooks.dependencies = dependencies;
        hooks.pending = effect;
      }
    },
  };
});
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

let documentState: EventTarget & { visibilityState: string };
let fetchMock: ReturnType<typeof vi.fn>;

function draw(categoryId = "best-picture") {
  hooks.cursor = 0;
  const node = LivePublicRankingModule({
    categoryId,
    categoryName: "Mejor película",
    locale: "en",
  });
  const effect = hooks.pending;
  hooks.pending = null;
  if (effect) {
    hooks.cleanup?.();
    hooks.cleanup = effect() ?? null;
  }
  return renderToStaticMarkup(node);
}
function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}
function response(name: string | null) {
  return Response.json({
    total: name ? 1 : 0,
    rankings: name
      ? [
          {
            id: name,
            categorySlug: "mejor-pelicula",
            profile: { slug: "film-fan", displayName: name, initials: "FF" },
            entriesCount: 5,
            watchedCount: 2,
          },
        ]
      : [],
  });
}
async function flush() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}
function visibility(value: string) {
  documentState.visibilityState = value;
  documentState.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  hooks.values = [];
  hooks.cursor = 0;
  hooks.dependencies = null;
  hooks.pending = null;
  hooks.cleanup = null;
  documentState = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  fetchMock = vi.fn();
  vi.stubGlobal("React", React);
  vi.stubGlobal("document", documentState);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  hooks.cleanup?.();
  vi.unstubAllGlobals();
});

describe("revocable live public ballots", () => {
  it("waits for visibility when mounted in a background tab", async () => {
    documentState.visibilityState = "hidden";
    fetchMock.mockResolvedValue(response(null));
    expect(draw()).toContain("Loading public ballots");
    expect(fetchMock).not.toHaveBeenCalled();
    visibility("visible");
    expect(fetchMock).toHaveBeenCalledOnce();
    await flush();
    expect(draw()).toContain("There are no public ballots");
  });

  it("fetches only an uncached anonymous summary after the initial professional render", async () => {
    fetchMock.mockResolvedValue(response("Public Fan"));
    expect(draw()).toContain("Loading public ballots");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "/api/comunidad/quinielas?categoria=best-picture",
      expect.objectContaining({ cache: "no-store", credentials: "omit" }),
    );
    await flush();
    expect(draw()).toContain("Public Fan");
  });

  it("does not show the previous category or accept its late response after navigation", async () => {
    fetchMock.mockResolvedValueOnce(response("Previous Category Fan"));
    draw();
    await flush();
    expect(draw()).toContain("Previous Category Fan");
    const next = deferredResponse();
    fetchMock.mockReturnValueOnce(next.promise);
    expect(draw("directing")).not.toContain("Previous Category Fan");
    next.resolve(response("Directing Fan"));
    await flush();
    expect(draw("directing")).toContain("Directing Fan");

    const obsolete = deferredResponse();
    const latest = deferredResponse();
    fetchMock
      .mockReturnValueOnce(obsolete.promise)
      .mockReturnValueOnce(latest.promise);
    draw("actor");
    draw("actress");
    latest.resolve(response("Latest Category Fan"));
    await flush();
    obsolete.resolve(response("Obsolete Category Fan"));
    await flush();
    const html = draw("actress");
    expect(html).toContain("Latest Category Fan");
    expect(html).not.toContain("Obsolete Category Fan");
  });

  it("discards an in-flight result while hidden and re-reads revocations on return", async () => {
    const old = deferredResponse();
    const refreshed = deferredResponse();
    fetchMock
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(refreshed.promise);
    draw();
    const options = fetchMock.mock.calls[0][1] as { signal: AbortSignal };
    visibility("hidden");
    expect(options.signal.aborted).toBe(true);
    old.resolve(response("Revoked Fan"));
    await flush();
    expect(draw()).not.toContain("Revoked Fan");
    visibility("visible");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    refreshed.resolve(response(null));
    await flush();
    const html = draw();
    expect(html).toContain("There are no public ballots");
    expect(html).not.toContain("Revoked Fan");
  });

  it("shows an unavailable status after a failed refresh instead of restoring revoked data", async () => {
    fetchMock.mockResolvedValueOnce(response("Old Fan"));
    draw();
    await flush();
    expect(draw()).toContain("Old Fan");
    visibility("hidden");
    fetchMock.mockResolvedValueOnce(
      new Response("Unavailable", { status: 503 }),
    );
    visibility("visible");
    await flush();
    const html = draw();
    expect(html).toContain("Public ballots could not be loaded");
    expect(html).not.toContain("Old Fan");
  });
});
