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
    path: `/temporadas/2026/${category.slug}`,
    title: en
      ? `${name}: 2026 Oscars Nominees and Winner`
      : `${name}: nominados y ganador Oscar 2026`,
    description: en
      ? `Official nominees and winner for ${name} at the 2026 Oscars.`
      : `Nominados y ganador oficiales de ${name} en los Oscar 2026.`,
  });
}

export default async function CategoryArchivePage({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug } = await params;
  const category = categoryBySlug(categorySlug);
  if (!category) notFound();
  const view = await getCategoryView(2026, category.id);
  return <CategoryPageView category={category} view={view} />;
}
