import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.RUNSCARS_AUDIT_BASE_URL ?? "https://runscars.app";
const output = process.env.RUNSCARS_UI_OUTPUT ?? "/tmp/runscars-ui-audit";
const before = process.env.RUNSCARS_UI_BEFORE === "true";
await mkdir(output, { recursive: true });
const categories = [
  "mejor-pelicula",
  "direccion",
  "actor-protagonista",
  "actriz-protagonista",
  "actor-de-reparto",
  "actriz-de-reparto",
  "guion-original",
  "guion-adaptado",
];
const festivals = [
  "sundance",
  "berlinale",
  "cannes",
  "locarno",
  "venice",
  "tiff",
  "san-sebastian",
  "telluride",
  "nyff",
];
const paths = before
  ? ["/", "/temporadas/2027/mejor-pelicula", "/peliculas/fjord"]
  : [
      "/",
      "/temporadas/2027",
      ...categories.map((c) => `/temporadas/2027/${c}`),
      "/peliculas/fjord",
      "/personas/tmdb-4823100",
      "/fuentes",
      "/fuentes/awardswatch",
      "/comunidad",
      "/evaluacion",
      "/metodologia",
      "/acceso",
      "/festivales",
      ...festivals.map((f) => `/festivales/${f}/2026`),
      ...[2022, 2023, 2024, 2025, 2026].map((y) => `/archivo/${y}`),
    ];
const cases = ["desktop", "mobile"].flatMap((device) =>
  (before ? ["es"] : ["es", "en"]).flatMap((locale) =>
    paths.map((route) => ({ device, locale, route })),
  ),
);
const results = [];
const browser = await chromium.launch();
for (let offset = 0; offset < cases.length; offset += 3)
  await Promise.all(
    cases.slice(offset, offset + 3).map(async ({ device, locale, route }) => {
      const context = await browser.newContext({
        viewport:
          device === "mobile"
            ? { width: 390, height: 844 }
            : { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__vitals = { lcp: 0, cls: 0 };
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) window.__vitals.lcp = e.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries())
            if (!e.hadRecentInput) window.__vitals.cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      const url = `${base}${locale === "en" ? "/en" : ""}${route === "/" && locale === "en" ? "" : route}`;
      try {
        const response = await page.goto(url, {
          waitUntil: "networkidle",
          timeout: 45000,
        });
        const state = await page.evaluate(() => ({
          title: document.title,
          lang: document.documentElement.lang,
          overflow: document.documentElement.scrollWidth > innerWidth,
          brokenImages: [...document.images].filter(
            (i) => i.complete && !i.naturalWidth,
          ).length,
          main: document.querySelectorAll("main").length,
          h1: document.querySelectorAll("h1").length,
          vitals: window.__vitals,
          ttfb: performance.getEntriesByType("navigation")[0]?.responseStart,
          rankingY: [...document.querySelectorAll("h2")]
            .find((h) =>
              ["Consenso profesional", "Professional consensus"].includes(
                h.textContent,
              ),
            )
            ?.getBoundingClientRect().top,
        }));
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        const violations = axe.violations
          .filter((v) => ["serious", "critical"].includes(v.impact))
          .map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          }));
        let screenshot;
        if (
          [
            "/",
            "/temporadas/2027/mejor-pelicula",
            "/peliculas/fjord",
            "/festivales",
          ].includes(route) &&
          locale === "es"
        ) {
          screenshot = path.join(
            output,
            `${device}-${route === "/" ? "home" : route.split("/").at(-1)}.png`,
          );
          await page.screenshot({ path: screenshot, fullPage: false });
        }
        results.push({
          url,
          device,
          status: response.status(),
          ...state,
          errors: [...new Set(errors)],
          violations,
          screenshot,
        });
      } catch (error) {
        results.push({ url, device, error: error.message });
      }
      await context.close();
      if (results.length % 15 === 0)
        console.log(`${results.length}/${cases.length} UI cases completed`);
    }),
  );
await browser.close();
const failed = results.filter(
  (r) =>
    r.error ||
    r.status !== 200 ||
    r.overflow ||
    r.brokenImages ||
    r.main !== 1 ||
    r.h1 !== 1 ||
    r.errors?.length ||
    r.violations?.length,
);
await writeFile(
  path.join(output, "report.json"),
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      base,
      measurement:
        "Unthrottled lab page-load LCP/CLS, not field Core Web Vitals or INP",
      results,
      failed: failed.length,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ cases: results.length, failed: failed.length, output }),
);
if (failed.length) process.exitCode = 1;
