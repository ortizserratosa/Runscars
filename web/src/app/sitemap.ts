import type { MetadataRoute } from "next";
import { PUBLIC_CATEGORIES } from "../lib/categories/config";
import { localizedPath } from "../lib/i18n/config";

const PUBLIC_ROUTES = [
  "/",
  "/temporadas/2027",
  "/temporadas/2026",
  "/archivo",
  "/critica",
  "/fuentes",
  "/metodologia",
  "/evaluacion",
  "/comunidad",
  "/acceso",
  "/privacidad",
  "/terminos",
  "/creditos",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const categoryRoutes = [2026, 2027].flatMap((year) =>
    PUBLIC_CATEGORIES.map((category) => `/temporadas/${year}/${category.slug}`),
  );
  const routes = [...PUBLIC_ROUTES, ...categoryRoutes];

  return routes.flatMap((path) =>
    (["es", "en"] as const).map((locale) => ({
      url: new URL(localizedPath(path, locale), origin).toString(),
      changeFrequency: path.includes("2027") ? "daily" : "monthly",
      priority: path === "/" ? 1 : path.includes("2027") ? 0.9 : 0.6,
      alternates: {
        languages: {
          es: new URL(localizedPath(path, "es"), origin).toString(),
          en: new URL(localizedPath(path, "en"), origin).toString(),
        },
      },
    })),
  );
}
