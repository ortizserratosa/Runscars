import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Read-only HTTP verification of an already published artifact. No credentials,
// environment files, browser session, database writes or protection bypasses.
const usage =
  "Usage: node scripts/check-public-html-cache.mjs <base-url> <report.json> [--rsc]";
const arguments_ = process.argv.slice(2);
if (arguments_.includes("--help")) {
  console.log(usage);
  process.exit(0);
}
const [baseArgument, reportArgument, ...flags] = arguments_;
if (
  !baseArgument ||
  !reportArgument ||
  flags.some((flag) => flag !== "--rsc")
) {
  console.error(usage);
  process.exit(2);
}

let base;
try {
  base = new URL(baseArgument);
  assert.ok(["http:", "https:"].includes(base.protocol));
  assert.equal(base.username, "");
  assert.equal(base.password, "");
  assert.equal(base.pathname, "/");
  assert.equal(base.search, "");
  assert.equal(base.hash, "");
} catch {
  console.error(
    "Base URL must be an HTTP(S) origin without credentials, query or path.",
  );
  process.exit(2);
}

const includeRsc = flags.includes("--rsc");
const canonicalOrigin = "https://runscars.app";
const requestBudget = 36;
const reportPath = path.resolve(reportArgument);
const routes = [
  "/",
  "/en",
  "/peliculas/the-odyssey",
  "/en/peliculas/the-odyssey",
  "/personas/tmdb-7",
  "/en/personas/tmdb-7",
];
const sharedHits = new Set(["HIT", "PRERENDER"]);
const sharedResponses = new Set([...sharedHits, "STALE"]);
const report = {
  capturedAt: new Date().toISOString(),
  baseOrigin: base.origin,
  canonicalOrigin,
  scope:
    "Public HTML cache, URL locale, metadata and anonymous/session isolation",
  limitations: [
    "Read-only anonymous and invalid-cookie requests do not establish a real signed-in user's behavior.",
    "Cache hits prove the sampled artifact behavior, not monthly CPU savings or team quota recovery.",
  ],
  includeRsc,
  requestBudget,
  requestCount: 0,
  samples: [],
  pass: false,
};

function attribute(tag, name) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  return match?.[1] ?? match?.[2] ?? null;
}

async function sample(route, kind, headers = {}) {
  assert.ok(
    report.requestCount < requestBudget,
    `Request budget exhausted (${requestBudget}); no additional request sent.`,
  );
  const url = new URL(route, base);
  assert.equal(
    url.origin,
    base.origin,
    "A check attempted to leave the selected origin.",
  );
  report.requestCount += 1;
  const started = performance.now();
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      "User-Agent": "Runscars-Public-HTML-Cache-Check/1.0",
      ...headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.text();
  const item = {
    kind,
    route: `${url.pathname}${url.search}`,
    method: "GET",
    status: response.status,
    cache: response.headers.get("x-vercel-cache")?.toUpperCase() ?? null,
    cacheControl: response.headers.get("cache-control"),
    contentType: response.headers.get("content-type"),
    hasSetCookie: response.headers.has("set-cookie"),
    bytes: Buffer.byteLength(body),
    wallMs: Math.round(performance.now() - started),
  };
  // Retain only these safe response fields: never cookie values, tokens or bodies.
  report.samples.push(item);
  assert.ok(
    ![401, 403].includes(response.status),
    `${kind} ${url.pathname}: deployment returned ${response.status}; protected or unavailable, so verification is not approved. No bypass attempted.`,
  );
  return { response, body, item, url };
}

function assertAnonymous(sampled) {
  assert.equal(
    sampled.item.hasSetCookie,
    false,
    `${sampled.item.kind}: public response set a cookie.`,
  );
  assert.ok(
    !sampled.body.includes("account-nav-links"),
    `${sampled.item.kind}: signed-in navigation appeared in an anonymous response.`,
  );
  assert.ok(
    !sampled.body.includes("watched-button"),
    `${sampled.item.kind}: private watch state appeared in an anonymous response.`,
  );
}

function assertHtml(sampled, route) {
  assert.equal(
    sampled.item.status,
    200,
    `${sampled.item.kind} ${route}: expected HTTP 200.`,
  );
  assert.match(
    sampled.item.contentType ?? "",
    /^text\/html\b/i,
    `${route}: expected an HTML document.`,
  );
  assertAnonymous(sampled);
  const expectedLocale =
    route === "/en" || route.startsWith("/en/") ? "en-GB" : "es-ES";
  const htmlTag = sampled.body.match(/<html\b[^>]*>/i)?.[0] ?? "";
  assert.equal(
    attribute(htmlTag, "lang"),
    expectedLocale,
    `${route}: incorrect document language.`,
  );
  const canonicals = (sampled.body.match(/<link\b[^>]*>/gi) ?? []).filter(
    (tag) => attribute(tag, "rel")?.toLowerCase() === "canonical",
  );
  assert.equal(
    canonicals.length,
    1,
    `${route}: expected exactly one canonical link.`,
  );
  const canonical = attribute(canonicals[0], "href");
  assert.ok(canonical, `${route}: canonical URL missing.`);
  assert.equal(
    new URL(canonical).href,
    new URL(route, canonicalOrigin).href,
    `${route}: canonical must use the visible path on runscars.app.`,
  );
  sampled.item.lang = expectedLocale;
  sampled.item.canonical = new URL(canonical).href;
}

async function assertCachedHtml(route, kind) {
  let result = await sample(route, kind);
  assertHtml(result, route);
  if (result.item.cache === "STALE") {
    result = await sample(route, `${kind}-after-stale`);
    assertHtml(result, route);
  }
  assert.ok(
    sharedHits.has(result.item.cache),
    `${kind} ${route}: expected x-vercel-cache HIT/PRERENDER after warming; received ${result.item.cache ?? "missing"}.`,
  );
  assert.ok(
    !/\b(?:private|no-store)\b/i.test(result.item.cacheControl ?? ""),
    `${kind} ${route}: cached public response has private/no-store cache directives.`,
  );
}

async function checkRsc(route) {
  const headers = { RSC: "1", "next-router-prefetch": "1" };
  // Next 16.4 hashes [prefetch, segment-prefetch, router-state-tree, next-url].
  // This request intentionally asks for a complete prefetch without a tree.
  const hash = createHash("sha256")
    .update("1,0,0,0")
    .digest()
    .subarray(0, 12)
    .toString("base64url");
  let current = new URL(route, base);
  current.searchParams.set("_rsc", hash);
  let result = await sample(
    `${current.pathname}${current.search}`,
    "anonymous-rsc",
    headers,
  );
  if (result.item.status === 307) {
    assertAnonymous(result);
    const location = result.response.headers.get("location");
    assert.ok(location, "RSC normalization redirect is missing Location.");
    const target = new URL(location, current);
    assert.equal(
      target.origin,
      base.origin,
      "RSC normalization tried to leave the selected origin.",
    );
    assert.equal(
      target.pathname,
      current.pathname,
      "RSC normalization changed the visible pathname.",
    );
    const before = new URL(current);
    const after = new URL(target);
    before.searchParams.delete("_rsc");
    after.searchParams.delete("_rsc");
    assert.equal(
      after.href,
      before.href,
      "RSC normalization changed parameters other than _rsc.",
    );
    assert.match(
      target.searchParams.get("_rsc") ?? "",
      /^[A-Za-z0-9_-]{1,128}$/,
      "RSC normalization supplied an invalid discriminator.",
    );
    assert.notEqual(
      target.searchParams.get("_rsc"),
      current.searchParams.get("_rsc"),
      "RSC normalization did not change the discriminator.",
    );
    result.item.normalizationRedirect = true;
    current = target;
    // One same-origin, same-path, hash-only redirect is sufficient. A second
    // redirect fails below instead of creating a loop or hiding protection.
    result = await sample(
      `${current.pathname}${current.search}`,
      "anonymous-rsc-normalized",
      headers,
    );
  }
  assert.equal(
    result.item.status,
    200,
    `${route}: RSC response did not resolve to HTTP 200.`,
  );
  assert.match(
    result.item.contentType ?? "",
    /^text\/x-component\b/i,
    `${route}: Flight request received a non-Flight response.`,
  );
  assert.ok(
    !/<(?:html|!doctype)\b/i.test(result.body),
    `${route}: Flight response contains an HTML document.`,
  );
  assertAnonymous(result);
}

try {
  for (const route of routes) {
    assertHtml(await sample(route, "anonymous-warm"), route);
    await assertCachedHtml(route, "anonymous-repeat-1");
    await assertCachedHtml(route, "anonymous-repeat-2");
  }

  for (const route of ["/personas/tmdb-7", "/en/personas/tmdb-7"]) {
    for (const suffix of ["", ".0"]) {
      const result = await sample(
        route,
        suffix ? "invalid-session-chunk" : "invalid-session-full",
        {
          Cookie: `sb-public-cache-check-auth-token${suffix}=invalid-cache-isolation-check`,
        },
      );
      assert.equal(
        result.item.status,
        200,
        `${route}: invalid-session request failed.`,
      );
      assert.match(
        result.item.cacheControl ?? "",
        /\bprivate\b/i,
        `${route}: session-selected response is not private.`,
      );
      assert.match(
        result.item.cacheControl ?? "",
        /\bno-store\b/i,
        `${route}: session-selected response is not no-store.`,
      );
      assert.ok(
        !sharedResponses.has(result.item.cache),
        `${route}: session-selected response was served from shared cache.`,
      );
      assert.ok(
        !result.body.includes("account-nav-links"),
        `${route}: invalid cookie was accepted as identity.`,
      );
    }
  }

  for (const locale of ["es", "en"]) {
    const result = await sample(
      `/public-render/${locale}`,
      "internal-namespace-canonical",
    );
    assert.equal(
      result.item.status,
      308,
      "Internal rendering namespace must redirect to its canonical URL.",
    );
    assert.equal(
      result.item.hasSetCookie,
      false,
      "Internal canonical redirect set a cookie.",
    );
    const location = result.response.headers.get("location");
    assert.ok(location, "Internal canonical redirect is missing Location.");
    assert.equal(
      new URL(location, base).href,
      new URL(locale === "es" ? "/" : "/en", base).href,
      "Internal rendering namespace redirected to an unexpected URL.",
    );
  }

  if (includeRsc) {
    for (const route of routes) await checkRsc(route);
  }
  report.pass = true;
} catch (error) {
  report.error =
    error instanceof Error
      ? error.message
      : "Public cache verification failed.";
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({
      pass: report.pass,
      requests: report.requestCount,
      budget: requestBudget,
      report: reportPath,
      ...(report.error ? { error: report.error } : {}),
    }),
  );
}
