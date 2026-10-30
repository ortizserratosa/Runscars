import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Build and run the real Next production server against a deterministic local
// Supabase substitute. This command replaces web/.next; run a normal build
// afterwards before deploying. No production service or credential is used.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(path.join(tmpdir(), "runscars-cache-smoke-"));
const cpuLog = path.join(temporary, "cpu.jsonl");
const preload = path.join(temporary, "measure-cpu.cjs");
const reads = [];
let nextServer;
let serverOutput = "";

function rowsFor(url) {
  const table = url.pathname.split("/").at(-1);
  const id = url.searchParams.get("id")?.replace(/^eq\./, "");
  const locales = url.searchParams.get("locale") ?? "";
  const english =
    locales.includes("en-US") &&
    (!locales.includes("es-ES") ||
      locales.indexOf("en-US") < locales.indexOf("es-ES"));
  if (table === "people" && id)
    return { id, name: `Smoke person ${id}`, tmdb_id: 100 };
  if (table === "films" && id)
    return {
      id,
      title: "Editorial smoke film",
      alternate_titles: [],
      release_status: "upcoming",
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
        overview: "Deterministic catalog cache smoke fixture.",
        genres: [],
        fetched_at: "2026-10-01T00:00:00.000Z",
        expires_at: "2099-01-01T00:00:00.000Z",
      },
    ];
  return [];
}

const upstream = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  reads.push(`${url.pathname}${url.search}`);
  response.setHeader("Content-Type", "application/json");
  if (!url.pathname.startsWith("/rest/v1/")) {
    response.writeHead(500);
    response.end(JSON.stringify({ message: "Unexpected non-catalog request" }));
    return;
  }
  response.end(JSON.stringify(rowsFor(url)));
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
  const processChild = spawn(
    process.execPath,
    [path.join(root, "node_modules/next/dist/bin/next"), ...args],
    {
      cwd: path.join(root, "web"),
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const output of [processChild.stdout, processChild.stderr])
    output.on("data", (chunk) => {
      serverOutput = `${serverOutput}${chunk}`.slice(-30_000);
    });
  return processChild;
}

async function untilReady(url) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (nextServer.exitCode !== null) throw new Error("Next server exited");
    try {
      if ((await fetch(`${url}/api/health`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Next server did not start within 30 seconds");
}

const samples = [];
async function sample(origin, route, expected) {
  const before = reads.length;
  const started = performance.now();
  const response = await fetch(`${origin}${route}`);
  const html = await response.text();
  assert.equal(response.status, 200, route);
  assert.ok(
    html.includes(expected),
    `${route}: expected localized content; reads=${JSON.stringify(reads.slice(before))}; response=${JSON.stringify([...response.headers])}; lang=${html.match(/<html[^>]*lang="([^"]+)"/)?.[1]}; biographies=${html.match(/.{0,30}(?:biography|Biografía).{0,50}/g)}`,
  );
  assert.ok(!html.includes('"digest":'), `${route}: render error`);
  const sampleResult = {
    route,
    responseBytes: Buffer.byteLength(html),
    wallMs: Math.round((performance.now() - started) * 10) / 10,
    databaseReads: reads.slice(before),
  };
  samples.push(sampleResult);
  return sampleResult;
}

try {
  const upstreamPort = await bind(upstream);
  const appPort = await freePort();
  const environment = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${upstreamPort}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-anonymous-cache-smoke-key",
    NEXT_PUBLIC_SITE_URL: `http://localhost:${appPort}`,
    NEXT_PUBLIC_ALLOW_INDEXING: "false",
    SUPABASE_SERVICE_ROLE_KEY: "",
    CRON_SECRET: "",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  console.log("Building Next against local catalog fixtures...");
  const build = child(["build"], environment);
  const buildExit = await new Promise((resolve) => build.once("exit", resolve));
  assert.equal(buildExit, 0, "Fixture build failed");
  await writeFile(
    preload,
    `const { Server } = require('node:http');
const { appendFileSync } = require('node:fs');
const original = Server.prototype.emit;
Server.prototype.emit = function(event, request, response, ...rest) {
  if (event === 'request') {
    const started = process.cpuUsage();
    response.once('finish', () => appendFileSync(${JSON.stringify(cpuLog)}, JSON.stringify({ path: request.url, cpuMicroseconds: process.cpuUsage(started) }) + '\\n'));
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
  // NextURL normalizes loopback hosts to localhost. Use that same host so an
  // English rewrite remains internal instead of making a second HTTP request.
  const origin = `http://localhost:${appPort}`;
  await untilReady(origin);
  reads.length = 0;
  await sample(
    origin,
    "/en/personas/cache-english-first",
    "English smoke biography",
  );
  const personFirst = await sample(
    origin,
    "/personas/cache-smoke-person",
    "Biografía de prueba",
  );
  const personRepeat = await sample(
    origin,
    "/personas/cache-smoke-person",
    "Biografía de prueba",
  );
  assert.ok(personFirst.databaseReads.length >= 3);
  assert.equal(
    personRepeat.databaseReads.length,
    0,
    "Person repeat reread the database",
  );
  const english = await sample(
    origin,
    "/en/personas/cache-smoke-person",
    "English smoke biography",
  );
  assert.ok(english.databaseReads.length >= 3, "Locale cache was not isolated");
  const filmFirst = await sample(
    origin,
    "/peliculas/cache-smoke-film",
    "Película de prueba",
  );
  const filmRepeat = await sample(
    origin,
    "/peliculas/cache-smoke-film",
    "Película de prueba",
  );
  const catalogRead = (read) =>
    /\/rest\/v1\/(films|film_credits|tmdb_movie_snapshots)\?/.test(read);
  assert.ok(filmFirst.databaseReads.some(catalogRead));
  assert.equal(
    filmRepeat.databaseReads.filter(catalogRead).length,
    0,
    "Film repeat reread the catalog",
  );
  assert.ok(
    !reads.some((read) => read.startsWith("/auth/")),
    "Anonymous request called Auth",
  );
  const cpuSamples = (await readFile(cpuLog, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const report = {
    capturedAt: new Date().toISOString(),
    runtime:
      "next build + next start, deterministic localhost Supabase fixture",
    scope:
      "Separate HTTP requests with real Next Data Cache; no production credentials/services",
    cpuLimit:
      "Local process CPU includes rendering, cache and runtime overhead; it is not Vercel billed CPU or a monthly savings forecast",
    samples,
    cpuSamples,
    pass: true,
  };
  const output = process.env.RUNSCARS_CACHE_SMOKE_REPORT;
  if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  nextServer?.kill("SIGTERM");
  await new Promise((resolve) => upstream.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
