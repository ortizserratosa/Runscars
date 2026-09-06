import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/temporadas/2027",
  "/temporadas/2027/mejor-pelicula",
  "/peliculas/fjord",
  "/fuentes",
  "/festivales",
  "/festivales/cannes/2026",
  "/en/festivales",
  "/en/festivales/cannes/2026",
];

for (const route of routes) {
  test(`smoke, layout and accessibility: ${route}`, async ({ page }) => {
    const errors: string[] = [];
    const failedRequests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      if (request.failure()?.errorText === "cancelled") return;
      failedRequests.push(
        `${request.failure()?.errorText ?? "request failed"}: ${request.url()}`,
      );
    });
    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toBeVisible();
    const visualState = await page.evaluate(() => ({
      overflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      brokenImages: [...document.images].filter(
        (image) => image.complete && image.naturalWidth === 0,
      ).length,
    }));
    expect(visualState).toEqual({ overflow: false, brokenImages: 0 });
    expect(failedRequests).toEqual([]);
    expect(errors).toEqual([]);

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const severe = accessibility.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
    expect(severe).toEqual([]);
  });
}
