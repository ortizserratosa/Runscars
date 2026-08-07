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

test("keeps professional, critical and community signals visibly separate", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "La carrera",
  );
  await expect(page.getByText("Predicciones", { exact: true })).toBeVisible();
  await expect(page.getByText("Crítica", { exact: true })).toBeVisible();
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

test("shows movement against the immediately previous category update", async ({
  page,
}) => {
  await page.goto("/temporadas/2027/mejor-pelicula");
  await expect(page.getByLabel("Sube 1 posición").first()).toBeVisible();
  await expect(page.getByLabel("Baja 1 posición").first()).toBeVisible();
  await expect(
    page.getByLabel("Nueva desde la actualización anterior").last(),
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
  await expect(
    markets.getByRole("heading", { name: "Nominación" }),
  ).toBeVisible();
  await expect(markets.getByRole("heading", { name: "Ganador" })).toHaveCount(
    2,
  );
  await expect(markets.getByText("72%")).toBeVisible();
  await expect(markets.getByText("34%")).toBeVisible();
});

test("shows six Best Picture media but never gives The Ringer Borda points", async ({
  page,
}) => {
  await page.goto("/temporadas/2027/mejor-pelicula");
  await expect(page.getByText("5 rankings ordenados · 6 medios")).toBeVisible();
  await page.getByText("Ver procedencia y cálculo").first().click();
  const ringer = page.getByRole("link", { name: /The Ringer/ }).first();
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
      "Kalshi y Polymarket se muestran por proveedor. No existe consenso de mercados y sus precios no participan en la predicción profesional.",
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

test("rejects unauthenticated weekly snapshot invocations", async ({
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
