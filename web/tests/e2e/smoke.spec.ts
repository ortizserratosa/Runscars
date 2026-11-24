import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/temporadas/2027",
  "/temporadas/2027/mejor-pelicula",
  "/peliculas/fjord",
  "/fuentes",
  "/metodologia",
  "/en/metodologia",
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
      const errorText = request.failure()?.errorText;
      if (errorText === "cancelled" || errorText === "Load request cancelled") {
        return;
      }
      // The live module aborts obsolete reads on cleanup/visibility changes.
      // React's development Strict Mode also exercises that cleanup on mount.
      // Require the final module below; ignore only this deliberate abort.
      if (
        new URL(request.url()).pathname === "/api/comunidad/quinielas" &&
        ["net::ERR_ABORTED", "NS_BINDING_ABORTED"].includes(errorText ?? "")
      ) {
        return;
      }
      failedRequests.push(`${errorText ?? "request failed"}: ${request.url()}`);
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
    if (route === "/temporadas/2027/mejor-pelicula") {
      await expect(page.locator(".community-module")).toContainText(
        "Todavía no hay quinielas públicas en esta categoría.",
      );
    }
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
