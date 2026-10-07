import { expect, test } from "@playwright/test";
import externalLinksFixture from "../../data/festivals/2026-external-links-fixture.json";

test("shows TMDB posters and metadata outside the Oscar catalogue, with IMDb secondary", async ({
  page,
}) => {
  await page.route("**/_next/image?*", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
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
        `https://www.themoviedb.org/movie/${link.tmdbId}`,
      );
      await expect(title).toHaveAttribute("target", "_blank");
      await expect(
        selection
          .locator(".festival-entry-links")
          .getByRole("link", { name: "IMDb" }),
      ).toHaveAttribute("href", `https://www.imdb.com/title/${link.imdbId}/`);
      await expect(selection.locator(".festival-entry-poster")).toHaveAttribute(
        "href",
        `https://www.themoviedb.org/movie/${link.tmdbId}`,
      );
      await expect(selection.locator(".poster-edition")).toHaveCount(0);
      if (link.originalTitle === "Bedford Park") {
        await expect(selection.locator(".poster-image")).toBeVisible();
        await expect(
          selection.locator(".festival-entry-metadata"),
        ).toContainText("2026");
      }
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
  await awards.locator("h3").getByRole("link", { name: "FJORD" }).click();
  await expect(page).toHaveURL(/\/en\/peliculas\/fjord$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Fjord" }),
  ).toBeVisible();
});

test("keeps a usable unbranded film placeholder when no poster is cached", async ({
  page,
}) => {
  await page.goto("/en/festivales/cannes/2026");
  const entry = page
    .locator("#awards .festival-entry-list > li")
    .filter({ hasText: "FJORD" });
  const poster = entry.locator(".festival-entry-poster");
  await expect(poster).toHaveAttribute("href", "/en/peliculas/fjord");
  await expect(poster.locator(".poster-title")).toContainText("FJORD");
  await expect(poster.locator("img")).toHaveCount(0);
  await expect(poster.locator(".poster-edition")).toHaveCount(0);
  await poster.click();
  await expect(page).toHaveURL(/\/en\/peliculas\/fjord$/);
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
