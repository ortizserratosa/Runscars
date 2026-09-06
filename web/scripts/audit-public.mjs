import { writeFile } from "node:fs/promises";

const base = new URL(
  process.env.RUNSCARS_AUDIT_BASE_URL ?? "https://runscars.app",
);
const canonicalOrigin =
  process.env.RUNSCARS_CANONICAL_ORIGIN ?? "https://runscars.app";
const reportPath =
  process.env.RUNSCARS_AUDIT_REPORT ?? "/tmp/runscars-public-audit.json";
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
      const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (response.status >= 500 && attempt < 2) continue;
      return response;
    } catch (error) {
      if (attempt === 2) throw error;
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
let queue = [...sitemap];
const auxiliary = /^\/(?:en\/)?(?:api|auth)(?:\/|$)/;
while (queue.length) {
  const batch = queue.splice(0, 6).filter((url) => !seen.has(url));
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
          for (const language of ["es", "en", "x-default"])
            if (!alternates.some(([lang]) => lang === language))
              failures.push({ url, error: `Missing alternate ${language}` });
        }
        if (response.ok)
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
  if (seen.size % 150 < 6)
    console.log(
      `Crawled ${seen.size}; queued ${queue.length}; findings ${failures.length}`,
    );
}
const report = {
  startedAt,
  completedAt: new Date().toISOString(),
  baseUrl: base.href,
  sitemapUrls: sitemap.size,
  visited: seen.size,
  externalLinks: external.size,
  failures,
  pages,
};
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    sitemapUrls: sitemap.size,
    visited: seen.size,
    failures: failures.length,
    reportPath,
  }),
);
if (failures.length) process.exitCode = 1;
