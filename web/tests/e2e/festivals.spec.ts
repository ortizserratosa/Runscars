import { expect, test } from "@playwright/test";

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
  await expect(awards.locator(".festival-entry-list > li")).toHaveCount(14);
  await selection.getByRole("searchbox").fill("almodovar");
  await expect(selection.locator(".festival-entry-list > li")).toHaveCount(1);
  await expect(selection).toContainText("Amarga Navidad");
  await expect(awards.locator(".festival-entry-list > li")).toHaveCount(14);
  await selection.getByRole("searchbox").fill("");
  await selection.getByRole("combobox").selectOption("Competition");
  await expect(selection.locator(".festival-entry-list > li")).toHaveCount(22);
  await awards.getByText("Source and dates", { exact: true }).click();
  await expect(awards.getByText(/Last consulted/)).toBeVisible();
  await expect(
    awards.getByRole("link", { name: "Official source" }),
  ).toHaveAttribute("href", /^https:\/\/www.festival-cannes.com/);
  await awards.getByRole("link", { name: "FJORD" }).click();
  await expect(page).toHaveURL(/\/en\/peliculas\/fjord$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Fjord" }),
  ).toBeVisible();
});

test("offers an official programme when the local listing is missing", async ({
  page,
}) => {
  await page.goto("/en/festivales/tiff/2026");
  await expect(
    page.getByText("The selection is not listed on Runscars yet.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Browse the official programme" }),
  ).toHaveAttribute("href", "https://tiff.net/press/news");
  await expect(page.locator("main")).not.toContainText(
    /receipt|extractor|editorial review|not yet been published/i,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
