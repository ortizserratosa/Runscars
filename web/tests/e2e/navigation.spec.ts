import { expect, test } from "@playwright/test";

const publicCategories = [
  ["mejor-pelicula", "Mejor película"],
  ["direccion", "Dirección"],
  ["actor-protagonista", "Actor protagonista"],
  ["actriz-protagonista", "Actriz protagonista"],
  ["actor-de-reparto", "Actor de reparto"],
  ["actriz-de-reparto", "Actriz de reparto"],
  ["guion-original", "Guion original"],
  ["guion-adaptado", "Guion adaptado"],
] as const;

test("focuses the homepage on consensus, evolution and personal rankings", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "La carrera",
  );
  await expect(page.getByText("Predicciones", { exact: true })).toBeVisible();
  await expect(page.getByText("Evolución", { exact: true })).toBeVisible();
  await expect(page.getByText("Comunidad", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Cuaderno de temporada · 25 de julio de 2026"),
  ).toBeVisible();
  await expect(page.getByText("Equipo editorial · 23 jul 2026")).toHaveCount(0);
});

test("publishes all eight database-shaped category routes", async ({
  page,
}) => {
  for (const [slug, name] of publicCategories) {
    await page.goto(`/temporadas/2027/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Datos verificados" }),
    ).toBeVisible();
    await expect(page.getByText("fuentes · mínimo 4")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Consenso profesional" }),
    ).toBeVisible();
    await expect(
      page.getByText("Cambios frente a", { exact: false }),
    ).toBeVisible();
  }
});

test("shows movement against the immediately previous real cut", async ({
  page,
}) => {
  await page.goto("/temporadas/2027/mejor-pelicula");
  await expect(page.getByLabel("Sube 1 posición").first()).toBeVisible();
  await expect(page.getByLabel("Baja 1 posición").first()).toBeVisible();
  await expect(
    page.getByLabel("Nueva desde el corte real anterior").last(),
  ).toBeVisible();
});

test("selects a real provider cut through a stable URL", async ({ page }) => {
  await page.goto("/temporadas/2027/mejor-pelicula");
  const selector = page.getByRole("navigation", {
    name: "Seleccionar corte real",
  });
  await expect(selector.getByRole("link")).toHaveCount(2);
  await expect(selector.getByRole("link", { name: /Actual/ })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await selector.getByRole("link").nth(1).click();

  await expect(page).toHaveURL(/corte=periodic-oscars-2027-best-picture/);
  await expect(page.getByText("Corte histórico seleccionado")).toBeVisible();
  await expect(
    page.getByText("Primer corte disponible · sin comparación anterior"),
  ).toBeVisible();
});

test("keeps current market signals separated by provider and intention", async ({
  page,
}) => {
  await page.goto("/temporadas/2027/mejor-pelicula");
  const markets = page.getByRole("region", { name: "Señales separadas" });
  await expect(markets.getByRole("heading", { name: "Kalshi" })).toBeVisible();
  await expect(
    markets.getByRole("heading", { name: "Polymarket" }),
  ).toBeVisible();
  for (const summary of await markets
    .locator(".market-details summary")
    .all()) {
    await summary.click();
  }
  await expect(
    markets.getByRole("heading", { name: "Nominación" }),
  ).toBeVisible();
  await expect(markets.getByRole("heading", { name: "Ganador" })).toHaveCount(
    2,
  );
  await expect(markets.getByText("72%").first()).toBeVisible();
  await expect(markets.getByText("34%").first()).toBeVisible();
});

test("distinguishes publication, effective change and connector checks", async ({
  page,
}) => {
  await page.goto("/temporadas/2027/mejor-pelicula");
  await page.getByText(/Estado y fechas de \d+ fuentes/).click();
  await expect(
    page.getByText("Publicada", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Cambió el ranking", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Comprobación correcta", { exact: true }).first(),
  ).toBeVisible();
});

test("exposes dynamic source receipts", async ({ page }) => {
  await page.goto("/fuentes");
  await expect(
    page.getByRole("heading", { level: 1, name: /Las fuentes/ }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /AwardsWatch/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/fuentes\/awardswatch$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "AwardsWatch" }),
  ).toBeVisible();
  await expect(page.getByText("Último cambio efectivo").first()).toBeVisible();
});

test("keeps candidate data consistent across public surfaces", async ({
  page,
}) => {
  await page.goto("/");
  const homeScore = (
    await page.locator(".leader-score strong").textContent()
  )?.trim();
  const homeCoverage = (
    await page.locator(".prediction-card .signal-stat strong").textContent()
  )?.trim();
  const leaderHref = await page.locator(".hero-board > a").getAttribute("href");
  expect(leaderHref).toMatch(/^\/peliculas\//);
  await page.locator(".receipt-source-list summary").click();
  const homeSourceHrefs = (
    await Promise.all(
      (await page.locator(".receipt-source-list li > a").all()).map((link) =>
        link.getAttribute("href"),
      ),
    )
  ).filter((href): href is string => Boolean(href));
  const homeSources = homeSourceHrefs
    .map((href) => href?.split("/").at(-1) ?? "")
    .filter(Boolean)
    .sort();

  await page.goto("/temporadas/2027/mejor-pelicula");
  const categoryCandidate = page
    .locator(".leaderboard-item")
    .filter({ has: page.locator(`a[href="${leaderHref}"]`) })
    .first();
  const candidateLabel = (
    await categoryCandidate.locator(".leaderboard-title strong").textContent()
  )?.trim();
  const categoryScore = (
    await categoryCandidate.locator(".points-cell > strong").textContent()
  )?.trim();
  const categoryCoverage = (
    await categoryCandidate.locator(".coverage-cell > span").textContent()
  )?.trim();
  await categoryCandidate.getByText("Ver procedencia y cálculo").click();
  const categorySources = (
    await Promise.all(
      (await categoryCandidate.locator(".source-calculations a").all()).map(
        (link) => link.getAttribute("data-source-id"),
      ),
    )
  )
    .filter(Boolean)
    .sort();

  expect(categoryScore).toBe(homeScore);
  expect(categoryCoverage).toBe(homeCoverage);
  expect(categorySources).toEqual(homeSources);

  await page.goto(leaderHref ?? "/peliculas/the-odyssey");
  await expect(page.locator(".film-score-strip strong").first()).toHaveText(
    categoryScore ?? "",
  );
  await expect(page.locator(".film-score-strip strong").nth(1)).toHaveText(
    categoryCoverage ?? "",
  );
  await expect(
    page.getByRole("heading", {
      name: "La misma lectura que en cada categoría",
    }),
  ).toBeVisible();
  const filmCategory = page
    .locator(".film-category-predictions article")
    .filter({
      has: page.getByRole("heading", { name: "Mejor película", exact: true }),
    });
  const filmSources = (
    await Promise.all(
      (await filmCategory.locator(".film-source-table a").all()).map((link) =>
        link.getAttribute("href"),
      ),
    )
  )
    .map((href) => href?.split("/").at(-1) ?? "")
    .filter(Boolean)
    .sort();
  expect(filmSources).toEqual(categorySources);

  await page.goto(homeSourceHrefs[0] ?? "/fuentes/awards-daily");
  const sourceCandidate = page
    .locator(".source-ranking li")
    .filter({ hasText: candidateLabel ?? "The Odyssey" })
    .first();
  const sourceConsensus = sourceCandidate.getByLabel(
    `Consenso vigente de ${candidateLabel ?? "The Odyssey"}`,
  );
  await expect(sourceConsensus.locator(":scope > strong")).toHaveText(
    categoryScore ?? "",
  );
  await expect(sourceConsensus).toContainText(`#1 · ${categoryCoverage}`);
  const sourceIds = (
    await Promise.all(
      (await sourceConsensus.locator(".source-entry-sources a").all()).map(
        (link) => link.getAttribute("href"),
      ),
    )
  )
    .map((href) => href?.split("/").at(-1) ?? "")
    .filter(Boolean)
    .sort();
  expect(sourceIds).toEqual(categorySources);
});

test("offers complete navigation at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByText("Menú", { exact: true }).click();
  const navigation = page.getByRole("navigation", { name: "Navegación móvil" });
  await expect(
    navigation.getByRole("link", { name: "Temporada" }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Categorías" }),
  ).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Fuentes" })).toBeVisible();
});

test("shows six Best Picture media but never gives The Ringer Borda points", async ({
  page,
}) => {
  await page.goto("/temporadas/2027/mejor-pelicula");
  await expect(page.getByText("5 rankings ordenados · 6 medios")).toBeVisible();
  await page.getByText("Ver procedencia y cálculo").first().click();
  const ringer = page
    .locator(".source-calculations")
    .getByRole("link", { name: /The Ringer/ })
    .first();
  await expect(ringer).toContainText("selección");
  await expect(ringer).toContainText("0");
});

test("explains that provider signals never form a market consensus", async ({
  page,
}) => {
  await page.goto("/temporadas/2027/direccion");
  await expect(
    page.getByRole("heading", { name: "Señales separadas" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kalshi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Polymarket" })).toBeVisible();
  await expect(page.getByText("Sin mercado disponible")).toHaveCount(0);
  await expect(
    page.getByText(
      "Kalshi y Polymarket se muestran por proveedor. No existe consenso de mercados y sus precios no participan en la predicción profesional. Reflejan su última captura y no el corte profesional seleccionado.",
    ),
  ).toBeVisible();
});

test("opens a film detail from a non-leading candidate", async ({ page }) => {
  await page.goto("/temporadas/2027/mejor-pelicula");
  await page
    .getByRole("link", { name: "Project Hail Mary", exact: true })
    .click();
  await expect(page).toHaveURL(/\/peliculas\/project-hail-mary$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Project Hail Mary" }),
  ).toBeVisible();
});

test("exposes the closed official 2026 archive without historical predictions", async ({
  page,
}) => {
  await page.goto("/temporadas/2026/mejor-pelicula");
  await expect(
    page.getByRole("heading", { level: 1, name: "Mejor película" }),
  ).toBeVisible();
  await expect(page.getByText("CERRADA", { exact: true })).toBeVisible();
  await expect(
    page.getByText("sin reconstrucción de predicciones históricas"),
  ).toBeVisible();
  await expect(page.getByText("GANADOR", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "One Battle After Another" }),
  ).toBeVisible();
});

test("exposes application health without leaking configuration", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({
    status: "ok",
    service: "runscars-web",
    databaseConfigured: false,
  });
});

test("rejects unauthenticated provider-change snapshot invocations", async ({
  request,
}) => {
  const response = await request.get("/api/cron/snapshots");
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "No autorizado" });
});

test("keeps film pages available without a TMDB token at runtime", async ({
  page,
}) => {
  await page.goto("/peliculas/project-hail-mary");
  await expect(
    page.getByRole("heading", { level: 1, name: "Project Hail Mary" }),
  ).toBeVisible();
  await expect(page.getByText("La ficha sigue disponible")).toBeVisible();
});

test("offers account access while keeping private actions behind authentication", async ({
  page,
  request,
}) => {
  await page.goto("/acceso");
  await expect(
    page.getByRole("heading", { level: 1, name: "Tu temporada, en orden." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Crear cuenta" }),
  ).toBeVisible();

  const exportResponse = await request.get("/api/cuenta/exportar");
  expect(exportResponse.status()).toBe(401);
});

test("keeps user rankings separate and private before login", async ({
  page,
}) => {
  await page.goto("/temporadas/2027/mejor-pelicula");
  await expect(
    page.getByRole("heading", {
      name: "Tu ranking de Mejor película",
    }),
  ).toBeVisible();
  await expect(page.getByText("Privado por defecto")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Consenso profesional" }),
  ).toBeVisible();
});

test("replaces the simulated watched toggle with an authenticated flow", async ({
  page,
}) => {
  await page.goto("/peliculas/the-odyssey");
  await expect(
    page.getByRole("heading", { name: "¿Ya la has visto?" }),
  ).toBeVisible();
  await expect(
    page.getByText("Inicia sesión para guardar este estado de forma privada."),
  ).toBeVisible();
});
