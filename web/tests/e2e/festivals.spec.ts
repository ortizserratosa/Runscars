import { expect, test } from "@playwright/test";
import externalLinksFixture from "../../data/festivals/2026-external-links-fixture.json";

test("links verified festival films to IMDb without requiring an Oscar catalogue page", async ({
  page,
}) => {
  for (const locale of ["en", "es"] as const) {
    await page.goto(
      locale === "en"
        ? "/en/festivales/sundance/2026"
        : "/festivales/sundance/2026",
    );
    const selection = page.locator("#selection");
    for (const link of externalLinksFixture.links) {
      await selection.getByRole("searchbox").fill(link.originalTitle);
      const title = selection
        .locator("h3")
        .getByRole("link", { name: link.originalTitle, exact: true });
      await expect(title).toHaveAttribute(
        "href",
        `https://www.imdb.com/title/${link.imdbId}/`,
      );
      await expect(title).toHaveAttribute("target", "_blank");
      await expect(selection.locator('a[href*="/peliculas/"]')).toHaveCount(0);
    }
  }
});

test("explores the calendar, filters films and keeps source links", async ({
  page,
}) => {
  await page.goto("/en/festivales");
  const cards = page.locator(".festival-card");
  await expect(cards).toHaveCount(9);
  await expect(cards.nth(4)).toContainText("Venice");
  await expect(cards.nth(5)).toContainText("Telluride");
  await page
    .getByRole("navigation", { name: "Jump to a festival" })
    .getByRole("link", { name: /Cannes/ })
    .click();
  await expect(page).toHaveURL(/#cannes$/);
  await page
    .locator("#cannes")
    .getByRole("link", { name: "Explore festival" })
    .click();
  const awards = page.locator("#awards");
  const selection = page.locator("#selection");
  await awards.getByRole("searchbox").fill("mungu-no-match");
  await expect(awards.getByText("No films match your search.")).toBeVisible();
  await awards.getByRole("button", { name: "Clear filters" }).click();
  await expect(awards.locator(".festival-entry-list > li")).toHaveCount(16);
  await selection.getByRole("searchbox").fill("almodovar");
  await expect(selection.locator(".festival-entry-list > li")).toHaveCount(1);
  await expect(selection).toContainText("AMARGA NAVIDAD");
  await expect(awards.locator(".festival-entry-list > li")).toHaveCount(16);
  await selection.getByRole("searchbox").fill("");
  await selection.getByRole("combobox").selectOption("In Competition");
  await expect(selection.locator(".festival-entry-list > li")).toHaveCount(22);
  await awards.getByText("Source and dates", { exact: true }).click();
  await expect(awards.getByText(/Last consulted/)).toBeVisible();
  await expect(
    awards.getByRole("link", { name: "Official source" }),
  ).toHaveAttribute("href", /^https:\/\/www.festival-cannes.com/);
  await expect(
    awards
      .locator(".festival-entry-list > li")
      .filter({ hasText: "FJORD" })
      .getByRole("link", { name: "Film in the source" }),
  ).toHaveAttribute("href", "https://www.festival-cannes.com/en/f/fjord/");
  await awards.getByRole("link", { name: "FJORD" }).click();
  await expect(page).toHaveURL(/\/en\/peliculas\/fjord$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Fjord" }),
  ).toBeVisible();
});

test("offers the reviewed programme and explains partial coverage", async ({
  page,
}) => {
  await page.goto("/en/festivales/tiff/2026");
  await expect(
    page.locator("#selection .festival-entry-list > li"),
  ).toHaveCount(206);
  await expect(page.locator("#awards .festival-entry-list > li")).toHaveCount(
    20,
  );
  await expect(
    page.getByRole("link", { name: "Official programme" }),
  ).toHaveAttribute("href", "https://tiff.net/films?thumbnail");
  await expect(page.locator("main")).not.toContainText(
    /receipt|extractor|editorial review|not yet been published/i,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/en/festivales/locarno/2026");
  await expect(page.locator("#selection")).toContainText(
    "Partial selection: feature films from five festival programmes.",
  );
  await page.goto("/en/festivales/nyff/2026");
  await expect(page.locator("#selection")).toContainText(
    "Coverage of Spotlight and Currents is pending.",
  );
});
