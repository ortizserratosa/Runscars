import { expect, test } from "@playwright/test";

for (const locale of ["es", "en"] as const) {
  test(`keeps revocable ballots outside professional HTML and refreshes them in ${locale}`, async ({
    page,
    request,
  }) => {
    const prefix = locale === "en" ? "/en" : "";
    const categoryPath = `${prefix}/temporadas/2027/mejor-pelicula`;
    const raw = await request.get(categoryPath);
    expect(raw.ok()).toBe(true);
    expect(await raw.text()).not.toContain("Revocable reader");
    const endpoint = await request.get(
      "/api/comunidad/quinielas?categoria=best-picture",
    );
    expect(endpoint.headers()["cache-control"]).toBe("private, no-store");
    expect(await endpoint.json()).toEqual({ total: 0, rankings: [] });

    let state: "public" | "revoked" | "unavailable" = "public";
    await page.route("**/api/comunidad/quinielas?*", async (route) => {
      await route.fulfill({
        status: state === "unavailable" ? 503 : 200,
        contentType: "application/json",
        headers: { "Cache-Control": "private, no-store" },
        body: JSON.stringify(
          state === "public"
            ? {
                total: 1,
                rankings: [
                  {
                    id: "public-test",
                    categorySlug: "mejor-pelicula",
                    profile: {
                      slug: "revocable-reader",
                      displayName: "Revocable reader",
                      initials: "RR",
                    },
                    entriesCount: 3,
                    watchedCount: 2,
                  },
                ],
              }
            : state === "revoked"
              ? { total: 0, rankings: [] }
              : { error: "unavailable" },
        ),
      });
    });
    await page.goto(categoryPath);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      locale === "en" ? "Best Picture" : "Mejor película",
    );
    await expect(
      page.getByText("Revocable reader", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Revocable reader/ }),
    ).toHaveAttribute(
      "href",
      `${prefix}/usuarios/revocable-reader/mejor-pelicula`,
    );

    async function visibility(value: "hidden" | "visible") {
      await page.evaluate((current) => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => current,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      }, value);
    }
    state = "revoked";
    await visibility("hidden");
    await expect(
      page.getByText("Revocable reader", { exact: true }),
    ).toHaveCount(0);
    await visibility("visible");
    await expect(
      page.getByText(
        locale === "en"
          ? "There are no public ballots in this category yet."
          : "Todavía no hay quinielas públicas en esta categoría.",
      ),
    ).toBeVisible();
    state = "unavailable";
    await visibility("hidden");
    await visibility("visible");
    await expect(page.getByRole("status")).toHaveText(
      locale === "en"
        ? "Public ballots could not be loaded."
        : "No se pudieron cargar las quinielas públicas.",
    );
    await expect(
      page.getByText(
        locale === "en"
          ? "There are no public ballots in this category yet."
          : "Todavía no hay quinielas públicas en esta categoría.",
      ),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", {
        name:
          locale === "en"
            ? "Explore all ballots →"
            : "Explorar todas las quinielas →",
      }),
    ).toBeVisible();
  });
}
