import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webDirectory = path.resolve(scriptDirectory, "..");
const repositoryDirectory = path.resolve(webDirectory, "..");
const evidenceDirectory = path.join(
  repositoryDirectory,
  "docs",
  "brand",
  "implementation",
);
const baseUrl =
  process.env.RUNSCARS_CAPTURE_BASE_URL ?? "http://127.0.0.1:3000";

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

const routes = [
  ["home", "/"],
  ["season-2027", "/temporadas/2027"],
  ...categories.map((category) => [
    `season-2027-${category}`,
    `/temporadas/2027/${category}`,
  ]),
  ["season-2026", "/temporadas/2026"],
  ...categories.map((category) => [
    `season-2026-${category}`,
    `/temporadas/2026/${category}`,
  ]),
  ["film", "/peliculas/the-odyssey"],
  ["person-empty-fixture", "/personas/fixture-christopher-nolan", 404],
  ["sources", "/fuentes"],
  ["source", "/fuentes/awardswatch"],
  ["methodology", "/metodologia"],
  ["evaluation", "/evaluacion"],
  ["archive", "/archivo"],
  ["archive-year", "/archivo/2025"],
  ["community", "/comunidad"],
  ["public-profile-empty-fixture", "/usuarios/fixture-profile", 404],
  [
    "public-ranking-empty-fixture",
    "/usuarios/fixture-profile/mejor-pelicula",
    404,
  ],
  ["login", "/acceso"],
  ["account-auth-boundary", "/cuenta"],
  ["admin-auth-boundary", "/admin"],
  ["privacy", "/privacidad"],
  ["terms", "/terminos"],
  ["credits", "/creditos"],
  ["retired-critical-route", "/critica"],
  ["not-found", "/__runscars_brand_audit_not_found__", 404],
];

const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};

const evidence = {
  desktop: new Map([
    ["home", "home-desktop.png"],
    ["season-2027-mejor-pelicula", "category-desktop.png"],
    ["film", "film.png"],
    ["sources", "sources.png"],
    ["community", "community.png"],
  ]),
  mobile: new Map([
    ["home", "home-mobile.png"],
    ["season-2027-mejor-pelicula", "category-mobile.png"],
  ]),
};

const resources = [
  ["health", "/api/health", [200], "application/json"],
  ["database-health", "/api/health/database", [200, 503], "application/json"],
  ["community-verification-method", "/api/comunidad/verificar-tmdb", [405]],
  ["snapshot-cron-auth", "/api/cron/snapshots", [401], "application/json"],
  ["account-export-auth", "/api/cuenta/exportar", [401], "application/json"],
  ["auth-callback", "/auth/callback", [307]],
  ["manifest", "/manifest.webmanifest", [200], "application/manifest+json"],
  ["robots", "/robots.txt", [200], "text/plain"],
  ["sitemap", "/sitemap.xml", [200], "application/xml"],
  ["app-icon", "/icon.svg", [200], "image/svg+xml"],
  ["social-card", "/runscars-social-v1.png", [200], "image/png"],
  [
    "public-ranking-social-card",
    "/usuarios/fixture-profile/mejor-pelicula/opengraph-image",
    [200],
    "image/png",
  ],
];

await mkdir(evidenceDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
let homeFoldPath;

for (const [viewportName, viewport] of Object.entries(viewports)) {
  const context = await browser.newContext({
    colorScheme: "light",
    reducedMotion: "reduce",
    viewport,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const [name, route, expectedStatus = 200] of routes) {
    pageErrors.length = 0;
    const response = await page.goto(new URL(route, baseUrl).toString(), {
      waitUntil: "networkidle",
    });
    const status = response?.status() ?? 0;
    const finalUrl = page.url();
    const audit = await page.evaluate(() => {
      const heading = document.querySelector("h1");
      const bodyStyle = getComputedStyle(document.body);
      return {
        boardEmbedded: Boolean(
          document.querySelector(
            'img[src*="runscars-brand-board-v1"], [style*="runscars-brand-board-v1"]',
          ),
        ),
        bodyFont: bodyStyle.fontFamily,
        heading: heading?.textContent?.replace(/\s+/g, " ").trim() ?? null,
        horizontalOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
        htmlLanguage: document.documentElement.lang,
        logoCount: document.querySelectorAll(".brand-logo .brand-mark").length,
        mainCount: document.querySelectorAll("main").length,
      };
    });
    const redirectsToAuth =
      name === "account-auth-boundary" || name === "admin-auth-boundary";
    const retiredRoute = name === "retired-critical-route";
    const statusMatches =
      status === expectedStatus || redirectsToAuth || retiredRoute;
    const passed =
      statusMatches &&
      !audit.horizontalOverflow &&
      !audit.boardEmbedded &&
      audit.logoCount >= 1 &&
      audit.mainCount === 1 &&
      pageErrors.length === 0;

    results.push({
      viewport: viewportName,
      name,
      route,
      status,
      expectedStatus,
      finalPath: new URL(finalUrl).pathname,
      ...audit,
      pageErrors,
      passed,
    });

    const screenshotName = evidence[viewportName].get(name);
    if (screenshotName) {
      await page.screenshot({
        animations: "disabled",
        fullPage: true,
        path: path.join(evidenceDirectory, screenshotName),
      });
    }
    if (viewportName === "desktop" && name === "home") {
      homeFoldPath = path.join(os.tmpdir(), "runscars-home-desktop-fold.png");
      await page.screenshot({
        animations: "disabled",
        fullPage: false,
        path: homeFoldPath,
      });
    }
  }
  await context.close();
}

const languageContext = await browser.newContext({
  colorScheme: "light",
  reducedMotion: "reduce",
  viewport: viewports.desktop,
});
const languagePage = await languageContext.newPage();
await languagePage.goto(
  new URL("/api/locale?locale=en&returnTo=%2F", baseUrl).toString(),
  { waitUntil: "networkidle" },
);
const englishAudit = await languagePage.evaluate(() => ({
  heading: document
    .querySelector("h1")
    ?.textContent?.replace(/\s+/g, " ")
    .trim(),
  horizontalOverflow:
    document.documentElement.scrollWidth > document.documentElement.clientWidth,
  htmlLanguage: document.documentElement.lang,
  logoCount: document.querySelectorAll(".brand-logo .brand-mark").length,
}));
results.push({
  viewport: "desktop-en",
  name: "home-en",
  route: "/",
  status: 200,
  expectedStatus: 200,
  finalPath: new URL(languagePage.url()).pathname,
  ...englishAudit,
  pageErrors: [],
  passed:
    englishAudit.htmlLanguage.startsWith("en") &&
    !englishAudit.horizontalOverflow &&
    englishAudit.logoCount >= 1,
});
await languageContext.close();

// The live admin route remains protected. This visual fixture reuses the real
// layout and production classes, but contains no account or database data.
const adminContext = await browser.newContext({
  colorScheme: "light",
  reducedMotion: "reduce",
  viewport: viewports.desktop,
});
const adminPage = await adminContext.newPage();
await adminPage.goto(new URL("/acceso", baseUrl).toString(), {
  waitUntil: "networkidle",
});
await adminPage.locator("#contenido").evaluate((container) => {
  container.innerHTML = `
    <main class="page-shell admin-page">
      <header class="admin-hero">
        <div><p class="section-index">OPERACIONES · ACCESO PROTEGIDO</p><h1>Administración editorial</h1><p>Fixture visual reproducible, sin sesión ni datos externos.</p></div>
        <small>Solo administradores autorizados</small>
      </header>
      <nav class="admin-index" aria-label="Secciones de administración"><a href="#revisiones">Revisiones</a><a href="#fuentes">Fuentes</a><a href="#ingestas">Ingestas</a><a href="#snapshots">Snapshots</a><a href="#resultados">Resultados</a></nav>
      <section class="admin-section" id="revisiones">
        <header><p class="section-index">COLA EDITORIAL</p><h2>Revisiones pendientes</h2><p>El valor capturado nunca se sustituye; solo cambia su vínculo o participación.</p></header>
        <div class="admin-form-grid">
          <form class="admin-card admin-form"><h3>Corregir identidad</h3><label>ID interno<input value="pelicula-verificada" readonly></label><label>Motivo<input value="Corrección editorial trazable" readonly></label><button class="primary-button dark-button" type="button">Guardar corrección</button></form>
          <form class="admin-card admin-form"><h3>Gobierno de fuente</h3><label>Estado<select><option>publishable</option></select></label><label>Notas<textarea rows="3" readonly>Procedencia y captura conservadas.</textarea></label><button class="ghost-button" type="button">Revisar fuente</button></form>
        </div>
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Fecha</th><th>Acción</th><th>Entidad</th><th>Estado</th></tr></thead><tbody><tr><td>—</td><td>Sin operaciones</td><td>—</td><td>Fixture visual</td></tr></tbody></table></div>
      </section>
    </main>`;
});
await adminPage.screenshot({
  animations: "disabled",
  fullPage: true,
  path: path.join(evidenceDirectory, "admin.png"),
});
await adminContext.close();

const resourceContext = await browser.newContext();
const resourceResults = [];
for (const [name, route, expectedStatuses, expectedContentType] of resources) {
  const response = await resourceContext.request.get(
    new URL(route, baseUrl).toString(),
    { maxRedirects: 0 },
  );
  const status = response.status();
  const contentType = response.headers()["content-type"] ?? "";
  const passed =
    expectedStatuses.includes(status) &&
    (!expectedContentType || contentType.includes(expectedContentType));
  resourceResults.push({
    name,
    route,
    status,
    expectedStatuses,
    contentType,
    passed,
  });
  if (name === "public-ranking-social-card" && passed) {
    await writeFile(
      path.join(evidenceDirectory, "social-dynamic.png"),
      await response.body(),
    );
  }
}
await resourceContext.close();

await browser.close();

const boardPath = path.join(
  repositoryDirectory,
  "docs",
  "brand",
  "runscars-brand-board-v1.png",
);
const board = await sharp(boardPath)
  .resize({ width: 940, height: 529, fit: "contain", background: "#F2EFE6" })
  .png()
  .toBuffer();
const implementation = await sharp(homeFoldPath)
  .resize({ width: 940, height: 653, fit: "cover", position: "top" })
  .png()
  .toBuffer();
const comparisonSvg = Buffer.from(`
  <svg width="1920" height="760" xmlns="http://www.w3.org/2000/svg">
    <rect width="1920" height="760" fill="#F2EFE6"/>
    <text x="20" y="42" font-family="monospace" font-size="18" font-weight="700" fill="#171A17">REFERENCIA VINCULANTE</text>
    <text x="980" y="42" font-family="monospace" font-size="18" font-weight="700" fill="#171A17">IMPLEMENTACIÓN WEB · PORTADA</text>
    <line x1="960" y1="0" x2="960" y2="760" stroke="#171A17"/>
  </svg>`);
await sharp(comparisonSvg)
  .composite([
    { input: board, left: 10, top: 70 },
    { input: implementation, left: 970, top: 70 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(evidenceDirectory, "brand-board-comparison.png"));

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  passed:
    results.every((result) => result.passed) &&
    resourceResults.every((result) => result.passed),
  routeCount: routes.length,
  checks: results,
  resourceChecks: resourceResults,
};
await writeFile(
  path.join(evidenceDirectory, "route-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

const failures = results.filter((result) => !result.passed);
const resourceFailures = resourceResults.filter((result) => !result.passed);
console.log(
  `Brand route audit: ${results.length - failures.length}/${results.length} visual checks and ${resourceResults.length - resourceFailures.length}/${resourceResults.length} resource checks passed`,
);
if (failures.length || resourceFailures.length) {
  console.error(
    [
      ...failures.map((failure) => `${failure.viewport}: ${failure.route}`),
      ...resourceFailures.map((failure) => `resource: ${failure.route}`),
    ].join("\n"),
  );
  process.exitCode = 1;
}
