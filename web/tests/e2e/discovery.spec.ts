import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("tries a ballot, reorders it, restores after reload and retains the sign-in destination", async ({
  page,
}) => {
  await page.goto("/en/quiniela");
  await page.getByRole("button", { name: /Wild Horse Nine.*Add/ }).click();
  await page.getByRole("button", { name: /The Odyssey.*Add/ }).click();
  const picks = page.getByRole("list", { name: "Your sample ballot" });
  await expect(picks.locator("li")).toHaveCount(2);
  await page.getByRole("button", { name: "Move up The Odyssey" }).click();
  await expect(picks.locator("li").first()).toContainText("The Odyssey");
  await page.reload();
  await expect(picks.locator("li").first()).toContainText("The Odyssey");
  await page.getByRole("button", { name: "Directing", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Your sample ballot" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Best Picture", exact: true }).click();
  await expect(picks.locator("li")).toHaveCount(2);
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Keep my ballot" }).click();
  await expect(page).toHaveURL(
    /\/en\/acceso\?next=%2Fen%2Ftemporadas%2F2027%2Fmejor-pelicula/,
  );
});

test("weekly edition links to real cuts, offers RSS and distinct localized sharing images", async ({
  page,
  request,
}) => {
  await page.goto("/en/semana/2026-07-20");
  await expect(page.locator(".weekly-card")).toHaveCount(8);
  await expect(page.locator(".weekly-card").first()).toContainText(
    "Wild Horse Nine",
  );
  await expect(
    page
      .locator(".weekly-card")
      .first()
      .getByRole("link", { name: "Explore the ranking and sources" }),
  ).toHaveAttribute("href", /\?corte=/);
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const rss = await request.get("/semana/feed?lang=en");
  expect(rss.ok()).toBe(true);
  expect(rss.headers()["content-type"]).toContain("application/rss+xml");
  expect(await rss.text()).toContain("<language>en</language>");
  expect(await rss.text()).toContain("/en/semana/2026-07-20");
  const image = await request.get(
    "/api/social?kind=weekly&id=2026-07-20&lang=en",
  );
  expect(image.ok()).toBe(true);
  expect(image.headers()["content-type"]).toContain("image/png");
  expect((await image.body()).readUInt32BE(16)).toBe(1200);
  expect((await image.body()).readUInt32BE(20)).toBe(630);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /kind=weekly.*lang=en/,
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    "content",
    /kind=weekly.*lang=en/,
  );
  expect(
    (await request.get("/api/social?kind=category&id=unknown")).status(),
  ).toBe(404);
  expect((await request.get("/en/semana/2026-02-30")).status()).toBe(404);
});
