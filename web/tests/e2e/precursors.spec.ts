import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("follows official precursor provenance from the sources directory", async ({
  page,
}) => {
  await page.goto("/en/fuentes");
  await expect(
    page.getByRole("heading", { name: "Official sources", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Actor Awards · SAG-AFTRA", exact: true })
    .click();
  await expect(page).toHaveURL(/\/en\/fuentes\/actor-awards$/);
  await expect(page.locator("main")).toContainText("OSCAR 2027");
  await page
    .getByRole("link", {
      name: "Explore the official calendar and film results",
    })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/premios\/actor-awards\/2027$/);
});

for (const route of [
  "/premios",
  "/en/premios",
  "/premios/bafta/2027",
  "/en/premios/actor-awards/2026",
]) {
  test(`precursor layout and accessibility: ${route}`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main h1")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const accessibility = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
  });
}

test("explores official precursor calendars without mixing last season’s winners", async ({
  page,
}) => {
  await page.goto("/en/premios");
  await expect(page.locator(".precursor-card")).toHaveCount(6);
  await page
    .getByRole("link", { name: "Actor Awards · SAG-AFTRA", exact: true })
    .click();
  await expect(page).toHaveURL(/\/en\/premios\/actor-awards\/2027$/);
  await expect(
    page.getByRole("heading", { name: "Nominations upcoming" }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("January 6, 2027");
  await expect(page.locator("main")).toContainText("February 28, 2027");
  await expect(page.locator("#winners")).toHaveCount(0);
  await page.getByText("Source and dates", { exact: true }).click();
  await expect(page.getByText(/Last consulted:/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Actor Awards Calendar" }),
  ).toHaveAttribute("href", "https://www.actorawards.org/awards/calendar");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("labels the historical winners as a partial 2026 archive with original categories", async ({
  page,
}) => {
  await page.goto("/en/premios/actor-awards/2026");
  await expect(page.locator("main")).toContainText("OSCAR 2026 · ARCHIVE");
  await expect(page.locator("#winners")).toContainText("Partial archive");
  await expect(page.locator("#winners li")).toHaveCount(5);
  await expect(page.locator("#winners")).toContainText(
    "Outstanding Performance by a Cast in a Motion Picture",
  );
  await expect(page.locator("#winners")).toContainText(
    "Related category; distinct from the Oscar category",
  );
  await expect(page.locator("#winners")).toContainText("MICHAEL B. JORDAN");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
