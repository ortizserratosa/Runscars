import { readFile, writeFile } from "node:fs/promises";

const base = new URL(
  process.env.RUNSCARS_AUDIT_BASE_URL ?? "https://runscars.app",
);
const canonicalOrigin =
  process.env.RUNSCARS_CANONICAL_ORIGIN ?? "https://runscars.app";
const reportPath =
  process.env.RUNSCARS_AUDIT_REPORT ?? "/tmp/runscars-public-audit.json";
const concurrency = Number(process.env.RUNSCARS_AUDIT_CONCURRENCY ?? 6);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 24)
  throw new Error("RUNSCARS_AUDIT_CONCURRENCY must be an integer from 1 to 24");
const mode =
  process.argv.includes("--full") || process.env.RUNSCARS_AUDIT_FULL === "true"
    ? "full"
    : "sample";
const maxRequests = Number(
  process.env.RUNSCARS_AUDIT_MAX_REQUESTS ||
    (mode === "sample" ? 64 : Infinity),
);
if (
  (maxRequests !== Infinity &&
    (!Number.isInteger(maxRequests) || maxRequests < 1)) ||
  (mode === "sample" && maxRequests > 80)
)
  throw new Error(
    "RUNSCARS_AUDIT_MAX_REQUESTS must be a positive integer (at most 80 in sample mode)",
  );
let requests = 0;
let budgetExhausted = false;
class RequestBudgetError extends Error {}
const startedAt = new Date().toISOString();
const failures = [];
const pages = [];
const seen = new Set();
const external = new Set();
const decode = (value) =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"');
async function request(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let target = url;
      let response;
      // Count redirects and retries against the same budget as page requests.
      for (let redirects = 0; ; redirects++) {
        if (requests >= maxRequests) {
          budgetExhausted = true;
          throw new RequestBudgetError("Request budget exhausted");
        }
        requests += 1;
        response = await fetch(target, {
          signal: AbortSignal.timeout(25000),
          redirect: "manual",
          headers: { "User-Agent": "RunscarsAudit/1.0" },
        });
        if (
          ![301, 302, 303, 307, 308].includes(response.status) ||
          !response.headers.get("location")
        )
          break;
        await response.body?.cancel();
        if (redirects >= 5) throw new Error("Too many redirects");
        target = new URL(response.headers.get("location"), target);
      }
      if (response.status >= 500 && attempt < 2) {
        await response.body?.cancel();
        continue;
      }
      return response;
    } catch (error) {
      if (error instanceof RequestBudgetError || attempt === 2) throw error;
    }
  }
}
const sitemapResponse = await request(new URL("/sitemap.xml", base));
if (!sitemapResponse.ok) throw new Error(`Sitemap: ${sitemapResponse.status}`);
const xml = await sitemapResponse.text();
const sitemapUrls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
  decode(match[1]),
);
if (!sitemapUrls.length) throw new Error("Empty sitemap");
function localize(url) {
  const parsed = new URL(url);
  return new URL(parsed.pathname + parsed.search, base).href;
}
const sitemap = new Set(sitemapUrls.map(localize));
function representativeSample(urls) {
  const groups = new Map();
  for (const url of urls) {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const locale = segments[0] === "en" ? segments.shift() : "es";
    const family = segments[0] ?? "home";
    const key = `${family}/${locale}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(url);
  }
  const orderedGroups = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([, urls]) =>
      urls.sort((left, right) => {
        const a = new URL(left).pathname;
        const b = new URL(right).pathname;
        return (
          a.split("/").length - b.split("/").length ||
          a.localeCompare(b, "en", { numeric: true })
        );
      }),
    );
  const selected = [];
  for (let index = 0; selected.length < 32; index++) {
    let found = false;
    for (const urls of orderedGroups) {
      if (urls[index] && selected.length < 32) {
        selected.push(urls[index]);
        found = true;
      }
    }
    if (!found) break;
  }
  return selected;
}
const selectedUrls =
  mode === "full" ? [...sitemap] : representativeSample(sitemap);
const selected = new Set(selectedUrls);
const resumePath = process.env.RUNSCARS_AUDIT_RESUME;
let previousReport = null;
if (resumePath) {
  previousReport = JSON.parse(await readFile(resumePath, "utf8"));
  if (previousReport.baseUrl !== base.href)
    throw new Error("Resume report belongs to another origin");
  // Reports from the original crawler always represented the full graph.
  if ((previousReport.mode ?? "full") !== mode)
    throw new Error("Resume report belongs to another audit mode");
  const failedUrls = new Set(
    previousReport.failures.map((failure) => failure.url),
  );
  for (const page of previousReport.pages) {
    if (
      page.status === 200 &&
      !failedUrls.has(page.url) &&
      (mode === "full" || selected.has(page.url))
    ) {
      pages.push(page);
      seen.add(page.url);
    }
  }
}
let queue = [
  ...new Set([
    ...selectedUrls,
    ...(previousReport?.pendingUrls?.filter(
      (url) => mode === "full" || selected.has(url),
    ) ?? []),
    ...(previousReport?.failures
      .map((failure) => failure.url)
      .filter((url) => mode === "full" || selected.has(url)) ?? []),
  ]),
].filter((url) => !seen.has(url));
const auxiliary = /^\/(?:en\/)?(?:api|auth)(?:\/|$)/;
while (queue.length && !budgetExhausted) {
  const batch = queue.splice(0, concurrency).filter((url) => !seen.has(url));
  batch.forEach((url) => seen.add(url));
  await Promise.all(
    batch.map(async (url) => {
      try {
        const response = await request(url);
        const html = response.headers.get("content-type")?.includes("text/html")
          ? await response.text()
          : "";
        const tags = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);
        const attr = (tag, key) =>
          tag.match(new RegExp(`\\b${key}="([^"]*)"`, "i"))?.[1];
        const canonical = attr(
          tags.find((tag) => attr(tag, "rel") === "canonical") ?? "",
          "href",
        );
        const alternates = tags
          .filter((tag) => attr(tag, "hreflang"))
          .map((tag) => [
            attr(tag, "hreflang"),
            decode(attr(tag, "href") ?? ""),
          ]);
        const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
        const page = {
          url,
          status: response.status,
          canonical,
          title,
          inSitemap: sitemap.has(url),
        };
        pages.push(page);
        if (!response.ok)
          failures.push({ url, error: `HTTP ${response.status}` });
        if (sitemap.has(url)) {
          if (
            /:E\{\\?"digest\\?":/.test(html) ||
            /This page could not be loaded\.|No se ha podido cargar esta página\./.test(
              html,
            )
          )
            failures.push({ url, error: "Server render error in public page" });
          const expected = new URL(new URL(url).pathname, canonicalOrigin).href;
          if (!canonical || new URL(canonical).href !== expected)
            failures.push({
              url,
              error: "Canonical mismatch",
              canonical,
              expected,
            });
          if (html.includes('name="robots" content="noindex'))
            failures.push({ url, error: "Sitemap page is noindex" });
          if (!title) failures.push({ url, error: "Missing title" });
          const pathname = new URL(url).pathname;
          const spanishPath = pathname.replace(/^\/en(?:\/|$)/, "/");
          for (const language of ["es", "en", "x-default"]) {
            const alternate = alternates.find(
              ([lang]) => lang === language,
            )?.[1];
            const alternatePath =
              language === "en"
                ? `/en${spanishPath === "/" ? "" : spanishPath}`
                : spanishPath;
            const expectedAlternate = new URL(alternatePath, canonicalOrigin)
              .href;
            if (!alternate || new URL(alternate).href !== expectedAlternate)
              failures.push({
                url,
                error: `Incorrect alternate ${language}`,
                alternate,
                expected: expectedAlternate,
              });
          }
          for (const script of html.matchAll(
            /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
          )) {
            try {
              JSON.parse(script[1]);
            } catch {
              failures.push({ url, error: "Invalid JSON-LD" });
            }
          }
        }
        if (response.ok && mode === "full")
          for (const [, raw] of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
            const href = decode(raw);
            if (/^(?:mailto:|tel:|#)/.test(href)) continue;
            const parsed = new URL(href, url);
            if (!["http:", "https:"].includes(parsed.protocol)) continue;
            if (parsed.origin === canonicalOrigin) parsed.host = base.host;
            if (parsed.origin !== base.origin) {
              external.add(parsed.href);
              continue;
            }
            parsed.hash = "";
            if (auxiliary.test(parsed.pathname) || seen.has(parsed.href))
              continue;
            queue.push(parsed.href);
          }
      } catch (error) {
        failures.push({ url, error: error.message });
      }
    }),
  );
  queue = [...new Set(queue)].filter((url) => !seen.has(url));
  if (seen.size % 150 < concurrency)
    console.log(
      `Crawled ${seen.size}; queued ${queue.length}; findings ${failures.length}`,
    );
}
const report = {
  startedAt,
  completedAt: new Date().toISOString(),
  baseUrl: base.href,
  mode,
  completeness: budgetExhausted ? "incomplete" : mode,
  fullGraphComplete:
    mode === "full" && !budgetExhausted && !queue.length && !failures.length,
  selectedUrls,
  requests,
  maxRequests: Number.isFinite(maxRequests) ? maxRequests : null,
  budgetExhausted,
  pendingUrls: [...new Set([...selectedUrls, ...seen, ...queue])].filter(
    (url) => !pages.some((page) => page.url === url),
  ),
  sitemapUrls: sitemap.size,
  visited: seen.size,
  ...(previousReport
    ? {
        initialStartedAt: previousReport.startedAt,
        previousReport: resumePath,
        recheckedFindings: previousReport.failures,
        externalLinksInRecheckedPages: [...external],
      }
    : { externalLinks: external.size }),
  failures,
  pages,
};
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    mode: report.mode,
    completeness: report.completeness,
    fullGraphComplete: report.fullGraphComplete,
    sitemapUrls: sitemap.size,
    visited: seen.size,
    requests,
    failures: failures.length,
    reportPath,
  }),
);
if (failures.length || budgetExhausted) process.exitCode = 1;
