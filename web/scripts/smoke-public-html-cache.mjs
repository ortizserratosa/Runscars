import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Run only when no other task is building or serving web/.next. This harness
// replaces that build with local fixtures: a normal npm run build is required
// afterwards before any deployment. It never uses a real Supabase or TMDB key.
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const temporary = await mkdtemp(
  path.join(tmpdir(), "runscars-html-cache-smoke-"),
);
const cpuLog = path.join(temporary, "cpu.jsonl");
const preload = path.join(temporary, "measure-cpu.cjs");
const upstreamReads = [];
const samples = [];
let nextServer;
let serverOutput = "";
let sequence = 0;
let upstreamOrigin = "";
// Test-only signing key and fictional identity. They are accepted solely by
// the HTTP server in this process, never by any real Supabase project.
const fixtureSigningKey = "runscars-local-html-smoke-hmac-key";
const fixtureUser = {
  id: "00000000-0000-4000-8000-000000000002",
  aud: "authenticated",
  role: "authenticated",
  email: "html-smoke@example.invalid",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function validFixtureToken(token) {
  if (!token) return false;
  try {
    const [header, payload, signature] = token.split(".");
    const algorithm = JSON.parse(Buffer.from(header, "base64url")).alg;
    const claims = JSON.parse(Buffer.from(payload, "base64url"));
    const expected = createHmac("sha256", fixtureSigningKey)
      .update(`${header}.${payload}`)
      .digest();
    const supplied = Buffer.from(signature, "base64url");
    return (
      algorithm === "HS256" &&
      claims.sub === fixtureUser.id &&
      claims.iss === `${upstreamOrigin}/auth/v1` &&
      claims.exp > Date.now() / 1000 &&
      supplied.length === expected.length &&
      timingSafeEqual(expected, supplied)
    );
  } catch {
    return false;
  }
}

// Same small PostgREST fixture as scripts/smoke-public-catalog-cache.mjs.
// Empty prediction pointers intentionally exercise the honest no-data home.
function rowsFor(url, signedIn) {
  const table = url.pathname.split("/").at(-1);
  const id = url.searchParams.get("id")?.replace(/^eq\./, "");
  const locales = url.searchParams.get("locale") ?? "";
  const english =
    locales.includes("en-US") &&
    (!locales.includes("es-ES") ||
      locales.indexOf("en-US") < locales.indexOf("es-ES"));
  if (table === "user_film_states")
    return signedIn &&
      url.searchParams.get("user_id") === `eq.${fixtureUser.id}`
      ? {
          user_id: fixtureUser.id,
          film_id: url.searchParams.get("film_id")?.replace(/^eq\./, ""),
          status: "watched",
        }
      : [];
  if (table === "people" && id)
    return { id, name: `Smoke person ${id}`, tmdb_id: 100 };
  if (table === "films" && id)
    return {
      id,
      title: "Editorial smoke film",
      alternate_titles: [],
      release_status: "upcoming",
      release_date: null,
      verification_url: null,
      notes: null,
      tmdb_id: 200,
    };
  if (table === "tmdb_person_snapshots")
    return [
      {
        tmdb_id: 100,
        locale: english ? "en-US" : "es-ES",
        biography: english ? "English smoke biography" : "Biografía de prueba",
        fetched_at: "2026-10-01T00:00:00.000Z",
        expires_at: "2099-01-01T00:00:00.000Z",
      },
    ];
  if (table === "tmdb_movie_snapshots")
    return [
      {
        tmdb_id: 200,
        locale: english ? "en-US" : "es-ES",
        title: english ? "English smoke film" : "Película de prueba",
        original_title: "Smoke film",
        original_language: "en",
        overview: "Deterministic local HTML cache smoke fixture.",
        genres: [],
        fetched_at: "2026-10-01T00:00:00.000Z",
        expires_at: "2099-01-01T00:00:00.000Z",
      },
    ];
  return [];
}

const upstream = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const signedIn = validFixtureToken(bearer);
  // Never retain Authorization or Cookie headers, including dummy tokens.
  upstreamReads.push({
    method: request.method,
    path: url.pathname,
    fixtureIdentity: signedIn,
  });
  response.setHeader("Content-Type", "application/json");
  if (url.pathname.startsWith("/rest/v1/")) {
    response.end(JSON.stringify(rowsFor(url, signedIn)));
    return;
  }
  if (url.pathname.startsWith("/auth/v1/")) {
    if (url.pathname === "/auth/v1/user" && signedIn) {
      response.end(JSON.stringify(fixtureUser));
      return;
    }
    response.writeHead(401);
    response.end(
      JSON.stringify({ message: "Invalid local smoke token", code: "bad_jwt" }),
    );
    return;
  }
  response.writeHead(500);
  response.end(JSON.stringify({ message: "Unexpected fixture endpoint" }));
});

async function bind(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server.address().port;
}

async function freePort() {
  const probe = createServer();
  const port = await bind(probe);
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

function child(args, environment) {
  const instance = spawn(
    process.execPath,
    [path.join(root, "node_modules/next/dist/bin/next"), ...args],
    {
      cwd: path.join(root, "web"),
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const output of [instance.stdout, instance.stderr])
    output.on("data", (chunk) => {
      serverOutput = `${serverOutput}${chunk}`.slice(-30_000);
    });
  return instance;
}

async function untilReady(origin) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (nextServer.exitCode !== null) throw new Error("Next server exited");
    try {
      if ((await fetch(`${origin}/api/health`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Next server did not start within 30 seconds");
}

const decode = (value) =>
  value
    ?.replaceAll("&amp;", "&")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"');
function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [
      key.toLowerCase(),
      decode(value),
    ]),
  );
}

function assertPublicMetadata(html, origin, route, locale) {
  const visiblePath = route.split("?")[0];
  const expectedUrl = new URL(visiblePath, origin).href;
  const spanish = visiblePath.replace(/^\/en(?:\/|$)/, "/");
  const english = `/en${spanish === "/" ? "" : spanish}`;
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map(([tag]) =>
    attributes(tag),
  );
  const metas = [...html.matchAll(/<meta\b[^>]*>/g)].map(([tag]) =>
    attributes(tag),
  );
  const htmlLang = html.match(/<html\b[^>]*\blang="([^"]+)"/)?.[1];
  assert.equal(
    htmlLang,
    locale === "en" ? "en-GB" : "es-ES",
    `${route}: html lang`,
  );
  assert.equal(
    new URL(links.find((link) => link.rel === "canonical")?.href).href,
    expectedUrl,
    `${route}: canonical`,
  );
  assert.equal(
    new URL(metas.find((meta) => meta.property === "og:url")?.content).href,
    expectedUrl,
    `${route}: Open Graph URL`,
  );
  for (const [language, routePath] of [
    ["es", spanish],
    ["en", english],
    ["x-default", spanish],
  ])
    assert.equal(
      new URL(links.find((link) => link.hreflang === language)?.href).href,
      new URL(routePath, origin).href,
      `${route}: ${language} alternate`,
    );
  const schemas = [
    ...html.matchAll(
      /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ].map(([, json]) => JSON.parse(json));
  if (/\/(?:peliculas|personas)\//.test(visiblePath))
    assert.ok(schemas.length, `${route}: missing JSON-LD`);
  for (const schema of schemas)
    assert.ok(
      !JSON.stringify(schema).includes("/public-render"),
      `${route}: internal URL in JSON-LD`,
    );
  for (const [, raw] of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g))
    assert.ok(
      !decode(raw).includes("/public-render"),
      `${route}: internal URL in a public link`,
    );
  const switcher = [...html.matchAll(/<a\b[^>]*>/g)]
    .map(([tag]) => attributes(tag))
    .find((anchor) => anchor.class?.split(/\s+/).includes("language-switcher"));
  assert.ok(switcher, `${route}: language switch must be an SSR anchor`);
  const languageSwitchHref = new URL(switcher.href, origin).href;
  assert.equal(
    languageSwitchHref,
    new URL(locale === "en" ? spanish : english, origin).href,
    `${route}: language switch changes page or needs JavaScript`,
  );
  return {
    canonical: expectedUrl,
    htmlLang,
    jsonLdBlocks: schemas.length,
    languageSwitchHref,
  };
}

async function sample(origin, route, kind, options = {}) {
  const id = `smoke-${++sequence}`;
  const before = upstreamReads.length;
  const started = performance.now();
  const { followRscRedirects = false, ...requestOptions } = options;
  const redirects = [];
  const requestIds = [];
  let target = new URL(route, origin);
  let response;
  for (let hop = 0; ; hop++) {
    const requestId = hop ? `${id}-redirect-${hop}` : id;
    requestIds.push(requestId);
    response = await fetch(target, {
      ...requestOptions,
      redirect: "manual",
      headers: {
        "x-runscars-smoke-id": requestId,
        "User-Agent": "RunscarsLocalSmoke/1.0",
        ...requestOptions.headers,
      },
    });
    if (!followRscRedirects || response.status !== 307) break;
    assert.ok(hop < 3, "RSC hash normalization exceeded three redirects");
    assert.ok(
      response.headers.get("location"),
      "RSC redirect omitted Location",
    );
    const next = new URL(response.headers.get("location"), target);
    assert.equal(
      next.origin,
      origin,
      "RSC redirect left the local fixture origin",
    );
    assert.equal(
      next.pathname,
      target.pathname,
      "RSC redirect changed the public route",
    );
    const beforeParams = new URLSearchParams(target.search);
    const afterParams = new URLSearchParams(next.search);
    beforeParams.delete("_rsc");
    afterParams.delete("_rsc");
    assert.equal(
      afterParams.toString(),
      beforeParams.toString(),
      "RSC redirect changed semantic query parameters",
    );
    assert.ok(
      next.searchParams.get("_rsc"),
      "RSC redirect omitted the cache discriminator",
    );
    assert.notEqual(
      next.searchParams.get("_rsc"),
      target.searchParams.get("_rsc"),
      "RSC redirect did not normalize its hash",
    );
    redirects.push({
      status: response.status,
      from: `${target.pathname}${target.search}`,
      location: `${next.pathname}${next.search}`,
    });
    await response.body?.cancel();
    target = next;
  }
  const html = await response.text();
  const reads = upstreamReads.slice(before);
  const cache = response.headers.get("x-nextjs-cache");
  const result = {
    id,
    requestIds,
    route,
    finalRoute: `${target.pathname}${target.search}`,
    redirects,
    kind,
    method: options.method ?? "GET",
    status: response.status,
    cache,
    contentType: response.headers.get("content-type"),
    cacheControl: response.headers.get("cache-control"),
    rewrittenPath: response.headers.get("x-middleware-rewrite")
      ? new URL(response.headers.get("x-middleware-rewrite"), origin).pathname
      : null,
    location: response.headers.get("location"),
    setsCookie: response.headers.has("set-cookie"),
    databaseReads: reads.filter((read) => read.path.startsWith("/rest/v1/"))
      .length,
    authReads: reads.filter((read) => read.path.startsWith("/auth/v1/")).length,
    verifiedFixtureAuthReads: reads.filter(
      (read) => read.path === "/auth/v1/user" && read.fixtureIdentity,
    ).length,
    privateStateReads: reads.filter(
      (read) =>
        read.path === "/rest/v1/user_film_states" && read.fixtureIdentity,
    ).length,
    upstreamPaths: reads,
    responseBytes: Buffer.byteLength(html),
    wallMs: Math.round((performance.now() - started) * 10) / 10,
  };
  samples.push(result);
  return { response, html, result };
}

function assertNotShared(result) {
  assert.notEqual(
    result.cache,
    "HIT",
    `${result.kind} unexpectedly used shared HTML`,
  );
  assert.ok(
    !result.rewrittenPath?.startsWith("/public-render"),
    `${result.kind} unexpectedly routed to public ISR`,
  );
}

function dummySession(supabaseUrl, valid = false) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    sub: valid ? fixtureUser.id : "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    iss: `${supabaseUrl}/auth/v1`,
    iat: 1700000000,
    exp: 4070908800,
  })}`;
  const signature = valid
    ? createHmac("sha256", fixtureSigningKey)
        .update(unsigned)
        .digest("base64url")
    : Buffer.from("invalid-local-smoke-signature").toString("base64url");
  const token = `${unsigned}.${signature}`;
  return `base64-${encode({
    access_token: token,
    refresh_token: "invalid-local-smoke-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 4070908800,
    user: valid
      ? fixtureUser
      : {
          id: "00000000-0000-4000-8000-000000000001",
          aud: "authenticated",
          role: "authenticated",
        },
  })}`;
}

try {
  const upstreamPort = await bind(upstream);
  const appPort = await freePort();
  const origin = `http://localhost:${appPort}`;
  const supabaseUrl = `http://127.0.0.1:${upstreamPort}`;
  upstreamOrigin = supabaseUrl;
  const environment = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-anonymous-html-smoke-key",
    NEXT_PUBLIC_SITE_URL: origin,
    NEXT_PUBLIC_ALLOW_INDEXING: "false",
    SUPABASE_SERVICE_ROLE_KEY: "",
    TMDB_READ_ACCESS_TOKEN: "",
    CRON_SECRET: "",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  console.log(
    "Building Next against local HTML-cache fixtures; rebuild normally before deploying.",
  );
  const build = child(["build"], environment);
  const buildExit = await new Promise((resolve) => build.once("exit", resolve));
  assert.equal(buildExit, 0, "Fixture build failed");
  const buildReads = [...upstreamReads];
  await writeFile(
    preload,
    `const { Server } = require('node:http');
const { appendFileSync } = require('node:fs');
const original = Server.prototype.emit;
Server.prototype.emit = function(event, request, response, ...rest) {
  if (event === 'request' && request.headers['x-runscars-smoke-id']) {
    const started = process.cpuUsage();
    response.once('finish', () => appendFileSync(${JSON.stringify(cpuLog)}, JSON.stringify({ id: request.headers['x-runscars-smoke-id'], method: request.method, path: request.url, cpuMicroseconds: process.cpuUsage(started) }) + '\\n'));
  }
  return original.call(this, event, request, response, ...rest);
};
`,
  );
  nextServer = child(
    ["start", "--hostname", "localhost", "--port", String(appPort)],
    {
      ...environment,
      NODE_OPTIONS:
        `${process.env.NODE_OPTIONS ?? ""} --require ${preload}`.trim(),
    },
  );
  // NextURL normalizes loopback hosts to localhost. Match it so EN rewrites
  // stay inside Next rather than creating a second external HTTP request.
  await untilReady(origin);
  upstreamReads.length = 0;
  const routes = [
    { route: "/", locale: "es", content: "Predicciones Oscar 2027" },
    { route: "/en", locale: "en", content: "Oscar predictions 2027" },
    {
      route: "/peliculas/cache-html-film",
      locale: "es",
      content: "Película de prueba",
    },
    {
      route: "/en/peliculas/cache-html-film",
      locale: "en",
      content: "English smoke film",
    },
    {
      route: "/personas/cache-html-person",
      locale: "es",
      content: "Biografía de prueba",
    },
    {
      route: "/en/personas/cache-html-person",
      locale: "en",
      content: "English smoke biography",
    },
  ];
  for (const item of routes) {
    for (const kind of ["anonymous-first", "anonymous-repeat"]) {
      const { response, html, result } = await sample(origin, item.route, kind);
      assert.equal(
        response.status,
        200,
        `${item.route}: HTTP ${response.status}`,
      );
      assert.ok(
        html.includes(item.content),
        `${item.route}: missing localized fixture content`,
      );
      assert.ok(
        !/:E\{\\?"digest\\?":/.test(html),
        `${item.route}: server render error`,
      );
      Object.assign(
        result,
        assertPublicMetadata(html, origin, item.route, item.locale),
      );
      assert.equal(
        result.authReads,
        0,
        `${item.route}: anonymous request contacted Auth`,
      );
      assert.equal(
        result.setsCookie,
        false,
        `${item.route}: public HTML response sets a cookie`,
      );
      if (kind === "anonymous-repeat") {
        assert.equal(
          result.cache,
          "HIT",
          `${item.route}: repeat was not an HTML cache HIT`,
        );
        assert.equal(
          result.databaseReads,
          0,
          `${item.route}: HTML HIT reread database`,
        );
      }
    }
  }

  const cookieName = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  const session = dummySession(supabaseUrl);
  const midpoint = Math.ceil(session.length / 2);
  const cookies = [
    ["session-full", `${cookieName}=${session}`],
    [
      "session-chunked",
      `${cookieName}.0=${session.slice(0, midpoint)}; ${cookieName}.1=${session.slice(midpoint)}`,
    ],
  ];
  for (const [kind, cookie] of cookies) {
    for (const route of [
      "/personas/cache-html-person",
      "/en/personas/cache-html-person",
    ]) {
      const { result } = await sample(origin, route, kind, {
        headers: { Cookie: cookie },
      });
      assert.equal(result.status, 200, `${kind}: expected safe SSR response`);
      assertNotShared(result);
      assert.ok(
        result.authReads > 0,
        `${kind}: token was not checked against local Auth`,
      );
    }
  }
  const validSession = dummySession(supabaseUrl, true);
  for (const locale of ["es", "en"]) {
    const route = `${locale === "en" ? "/en" : ""}/peliculas/cache-html-film`;
    const privatePage = await sample(origin, route, "valid-session-private", {
      headers: { Cookie: `${cookieName}=${validSession}` },
    });
    assert.equal(privatePage.result.status, 200);
    assertNotShared(privatePage.result);
    assert.match(
      privatePage.result.cacheControl ?? "",
      /private|no-store/,
      "Signed-in HTML must not be shared",
    );
    assert.ok(
      privatePage.result.verifiedFixtureAuthReads > 0,
      "Local HMAC session was not verified by fixture Auth",
    );
    assert.ok(
      privatePage.result.privateStateReads > 0,
      "Private state was not read with the verified session",
    );
    assert.ok(
      privatePage.html.includes(locale === "en" ? "My account" : "Mi cuenta"),
      "Signed-in account navigation missing",
    );
    assert.ok(
      privatePage.html.includes(
        `<h3>${locale === "en" ? "Watched" : "Vista"}</h3>`,
      ),
      "Verified private watch state missing",
    );
    assert.ok(
      privatePage.html.includes("watched-button"),
      "Private watch-state marker missing",
    );
    Object.assign(
      privatePage.result,
      assertPublicMetadata(privatePage.html, origin, route, locale),
    );

    const anonymousAfter = await sample(
      origin,
      route,
      "anonymous-after-private",
    );
    assert.equal(anonymousAfter.result.status, 200);
    assert.equal(anonymousAfter.result.cache, "HIT");
    assert.equal(
      anonymousAfter.result.databaseReads + anonymousAfter.result.authReads,
      0,
    );
    assert.ok(
      anonymousAfter.html.includes(
        locale === "en" ? "Have you seen it?" : "¿Ya la has visto?",
      ),
      "Anonymous watch panel missing after private request",
    );
    assert.ok(
      !anonymousAfter.html.includes("watched-button"),
      "Private watch state leaked to anonymous HTML",
    );
    assert.ok(
      !anonymousAfter.html.includes(
        locale === "en" ? "My account" : "Mi cuenta",
      ),
      "Private account navigation leaked to anonymous HTML",
    );

    const flight = await sample(
      origin,
      `${route}?_rsc=local-smoke`,
      "anonymous-rsc-after-private",
      {
        headers: { RSC: "1", "next-router-prefetch": "1" },
        followRscRedirects: true,
      },
    );
    assert.equal(flight.result.status, 200);
    assert.match(
      flight.response.headers.get("content-type") ?? "",
      /^text\/x-component\b/,
      "RSC request received cached HTML",
    );
    assert.ok(
      !/<(?:html|!doctype)\b/i.test(flight.html),
      "RSC response contains an HTML document",
    );
    assert.ok(
      !flight.html.includes("watched-button"),
      "Private watch state leaked to anonymous Flight",
    );
    assert.ok(
      !flight.html.includes(locale === "en" ? "My account" : "Mi cuenta"),
      "Private account navigation leaked to anonymous Flight",
    );
    assert.equal(flight.result.authReads + flight.result.privateStateReads, 0);
  }
  for (const route of [
    "/personas/cache-html-person",
    "/en/personas/cache-html-person",
  ]) {
    // Repeat the semantic query too: a one-off MISS could conceal an
    // incorrectly cached variant that would become HIT on the next request.
    for (const kind of ["semantic-query-first", "semantic-query-repeat"]) {
      const queried = await sample(
        origin,
        `${route}?snapshot=local-semantic-cut`,
        kind,
      );
      assert.equal(queried.result.status, 200);
      assertNotShared(queried.result);
      assert.equal(queried.result.authReads, 0);
    }
    const posted = await sample(origin, route, "post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assertNotShared(posted.result);
    assert.ok(
      // A bare POST has no valid Server Action ID. Next may reject that
      // protocol request with 405 or 500; it must never serve shared ISR.
      [200, 400, 403, 404, 405, 500].includes(posted.result.status),
      `Unexpected POST response ${posted.result.status}`,
    );
  }
  for (const locale of ["es", "en"]) {
    const internal = await sample(
      origin,
      `/public-render/${locale}/personas/cache-html-person`,
      "internal-canonical-redirect",
    );
    assert.equal(
      internal.result.status,
      308,
      "Internal rendering namespace must redirect",
    );
    assert.equal(
      new URL(internal.result.location, origin).href,
      `${origin}${locale === "en" ? "/en" : ""}/personas/cache-html-person`,
    );
    assert.equal(internal.result.databaseReads + internal.result.authReads, 0);
  }
  const cpuSamples = (await readFile(cpuLog, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  for (const item of samples) {
    const measured = item.requestIds.map((id) => {
      const entries = cpuSamples.filter((entry) => entry.id === id);
      assert.equal(
        entries.length,
        1,
        `${item.route}: missing or duplicate CPU sample for ${id}`,
      );
      return entries[0];
    });
    item.cpuRequestCount = measured.length;
    item.cpuMicroseconds = measured.reduce(
      (total, entry) => ({
        user: total.user + entry.cpuMicroseconds.user,
        system: total.system + entry.cpuMicroseconds.system,
      }),
      { user: 0, system: 0 },
    );
  }
  const report = {
    capturedAt: new Date().toISOString(),
    pass: true,
    runtime: "next build + next start with local PostgREST/Auth fixtures",
    scope:
      "Real independent HTTP requests; anonymous HTML/Flight ISR versus legacy SSR bypasses. Invalid tokens and a local HMAC fixture identity with private watch state; no real users or external services.",
    cpuLimit:
      "Local process CPU includes cache, render and runtime overhead; this is not Vercel billed CPU or a monthly savings forecast.",
    rebuildRequired:
      "The fixture build replaced web/.next. Run normal npm run build before deploying.",
    buildDatabaseReads: buildReads.filter((read) =>
      read.path.startsWith("/rest/v1/"),
    ).length,
    buildAuthReads: buildReads.filter((read) =>
      read.path.startsWith("/auth/v1/"),
    ).length,
    samples,
  };
  const output = process.env.RUNSCARS_HTML_CACHE_SMOKE_REPORT;
  if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  const output = process.env.RUNSCARS_HTML_CACHE_SMOKE_REPORT;
  if (output)
    await writeFile(
      output,
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          pass: false,
          error: { name: error.name, message: error.message },
          rebuildRequired:
            "The fixture build replaced web/.next. Run normal npm run build before deploying.",
          samples,
        },
        null,
        2,
      )}\n`,
    );
  // Local fixture output only. Tokens and Cookie/Authorization values are never logged.
  console.error(serverOutput);
  throw error;
} finally {
  if (nextServer && nextServer.exitCode === null) {
    nextServer.kill("SIGTERM");
    await new Promise((resolve) => nextServer.once("exit", resolve));
  }
  await new Promise((resolve) => upstream.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
