import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PUBLIC_CATEGORIES,
  categoryBySlug,
} from "../../../../lib/categories/config";
import { getCategoryView } from "../../../../lib/categories/data";
import { getRequestLocale } from "../../../../lib/i18n/server";
import { buildLocalizedMetadata } from "../../../../lib/seo";
import { CategoryPageView } from "../../CategoryPageView";

export function generateStaticParams() {
  return PUBLIC_CATEGORIES.map((category) => ({
    categorySlug: category.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = categoryBySlug(categorySlug);
  if (!category) return {};
  const locale = await getRequestLocale();
  const en = locale === "en";
  const name = en ? category.nameEn : category.name;
  return buildLocalizedMetadata({
    locale,
    path: `/temporadas/2027/${category.slug}`,
    title: en
      ? `${name} Oscar Predictions 2027`
      : `Predicciones Oscar 2027: ${name}`,
    description: en
      ? `Updated ${name} predictions for the 2027 Oscars, combining specialist rankings with transparent sources and change history.`
      : `Predicciones actualizadas de ${name} para los Oscar 2027, con rankings de especialistas, fuentes y evolución verificables.`,
  });
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
