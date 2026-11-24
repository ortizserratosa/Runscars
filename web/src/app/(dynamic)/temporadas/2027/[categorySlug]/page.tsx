import { notFound } from "next/navigation";
import {
  PUBLIC_CATEGORIES,
  categoryBySlug,
} from "../../../../../lib/categories/config";
import { getCategoryView } from "../../../../../lib/categories/data";
import { getRequestLocale } from "../../../../../lib/i18n/server";
import { categoryMetadata } from "../../../../temporadas/category-metadata";
import { CategoryPageView } from "../../../../temporadas/CategoryPageView";

export function generateStaticParams() {
  return PUBLIC_CATEGORIES.map((category) => ({
    categorySlug: category.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const [{ categorySlug }, locale] = await Promise.all([
    params,
    getRequestLocale(),
  ]);
  return categoryMetadata(categorySlug, locale);
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<{ corte?: string | string[] }>;
}) {
  const { categorySlug } = await params;
  const { corte } = await searchParams;
  const category = categoryBySlug(categorySlug);
  if (!category) notFound();
  const requestedCut = Array.isArray(corte) ? corte[0] : corte;
  const snapshotId =
    requestedCut && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedCut)
      ? requestedCut
      : undefined;
  const view = await getCategoryView(2027, category.id, { snapshotId });
  return <CategoryPageView category={category} view={view} />;
}
