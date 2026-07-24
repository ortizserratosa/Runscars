import { expect, test } from "@playwright/test";

test("keeps professional and community signals visibly separate", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "La carrera",
  );
  await expect(page.getByText("Predicciones", { exact: true })).toBeVisible();
  await expect(page.getByText("Crítica", { exact: true })).toBeVisible();
  await expect(page.getByText("Tu ranking", { exact: true })).toBeVisible();
});

test("opens a detail page from a non-leading film appearance", async ({
  page,
}) => {
  await page.goto("/temporadas/2027");
  await page
    .getByRole("link", { name: "Project Hail Mary", exact: true })
    .click();

  await expect(page).toHaveURL(/\/peliculas\/project-hail-mary$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Project Hail Mary" }),
  ).toBeVisible();
  await expect(page.getByText("Lo que sí está verificado")).toBeVisible();
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

test("keeps film pages available without a TMDB token at runtime", async ({
  page,
}) => {
  await page.goto("/peliculas/project-hail-mary");

  await expect(
    page.getByRole("heading", { level: 1, name: "Project Hail Mary" }),
  ).toBeVisible();
  await expect(page.getByText("La ficha sigue disponible")).toBeVisible();
  await expect(page.getByText("Lo que sí está verificado")).toBeVisible();
});

test("explains and recalculates prediction consensus from its observations", async ({
  page,
}) => {
  await page.goto("/temporadas/2027/mejor-pelicula");

  await expect(
    page.getByRole("heading", { name: "Consenso de nominación" }),
  ).toBeVisible();
  await expect(page.getByText("runscars-aggregation-v1")).toBeVisible();
  await expect(page.getByText("48 observaciones incluidas")).toBeVisible();
  await expect(
    page.getByText("Media de 4 listas ordenadas = 97,50 / 100"),
  ).toBeVisible();

  await page.getByRole("button", { name: "15 JUL 2 listas" }).click();

  await expect(
    page.getByRole("heading", { name: "Señal editorial" }),
  ).toBeVisible();
  await expect(
    page.getByText("este corte todavía no alcanza las tres listas ordenadas"),
  ).toBeVisible();
});

test("shows ordered, selected and absent contributions on every film page", async ({
  page,
}) => {
  await page.goto("/peliculas/the-social-reckoning");

  await expect(
    page.getByRole("heading", { level: 1, name: "The Social Reckoning" }),
  ).toBeVisible();
  await expect(page.getByText("10,00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("2/4", { exact: true })).toBeVisible();
  await expect(page.getByText("Selección publicada sin orden")).toBeVisible();
  await expect(
    page.getByText("Ausente de la publicación").first(),
  ).toBeVisible();
});
