import type { MetadataRoute } from "next";
import { HISTORICAL_EDITIONS } from "../lib/archive/historical";
import { PUBLIC_CATEGORIES } from "../lib/categories/config";
import { localizedPath } from "../lib/i18n/config";
import {
  listCatalogFilmIds,
  listCatalogPersonIds,
} from "../lib/repositories/catalog";
import { getSourceIndex } from "../lib/repositories/sources";
import { absoluteUrl } from "../lib/seo";

const PUBLIC_ROUTES = [
  "/",
  "/temporadas/2027",
  "/temporadas/2026",
  "/archivo",
  "/fuentes",
  "/metodologia",
  "/evaluacion",
  "/comunidad",
];

export const revalidate = 86_400;

type SitemapEntry = {
  path: string;
  changeFrequency: NonNullable<
    MetadataRoute.Sitemap[number]["changeFrequency"]
  >;
  priority: number;
  lastModified?: string;
};

function localizedEntries(entry: SitemapEntry): MetadataRoute.Sitemap {
  const languages = {
    es: absoluteUrl(localizedPath(entry.path, "es")),
    en: absoluteUrl(localizedPath(entry.path, "en")),
    "x-default": absoluteUrl(localizedPath(entry.path, "es")),
  };
  return (["es", "en"] as const).map((locale) => ({
    url: languages[locale],
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
    ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [filmIds, personIds, sources] = await Promise.all([
    listCatalogFilmIds(),
    listCatalogPersonIds(),
    getSourceIndex().catch(() => []),
  ]);
  const categoryRoutes = [2026, 2027].flatMap((year) =>
    PUBLIC_CATEGORIES.map((category) => `/temporadas/${year}/${category.slug}`),
  );
  const routes: SitemapEntry[] = [
    ...(PUBLIC_ROUTES.map((path) => ({
      path,
      changeFrequency: path === "/" ? "daily" : "weekly",
      priority: path === "/" ? 1 : path.includes("2027") ? 0.9 : 0.7,
    })) as SitemapEntry[]),
    ...(categoryRoutes.map((path) => ({
      path,
      changeFrequency: path.includes("/2027/") ? "daily" : "yearly",
      priority: path.includes("/2027/") ? 0.9 : 0.6,
    })) as SitemapEntry[]),
    ...HISTORICAL_EDITIONS.map((edition) => ({
      path: `/archivo/${edition.ceremonyYear}`,
      changeFrequency: "yearly" as const,
      priority: 0.6,
      lastModified: edition.capturedAt,
    })),
    ...filmIds.map((filmId) => ({
      path: `/peliculas/${filmId}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...personIds.map((personId) => ({
      path: `/personas/${personId}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...sources.map((source) => ({
      path: `/fuentes/${source.id}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
      ...(source.lastChangedAt || source.lastSuccessfulCheckAt
        ? {
            lastModified:
              source.lastChangedAt ?? source.lastSuccessfulCheckAt ?? undefined,
          }
        : {}),
    })),
  ];

  return routes.flatMap(localizedEntries);
}
