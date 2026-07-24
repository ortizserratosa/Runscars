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
