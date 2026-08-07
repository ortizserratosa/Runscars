import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PUBLIC_CATEGORIES,
  categoryBySlug,
} from "../../../../lib/categories/config";
import { getCategoryView } from "../../../../lib/categories/data";
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
  return {
    title: `${category.name} · Archivo Oscar 2026`,
    description: `Nominados y ganador oficiales de ${category.name} en los Oscar 2026.`,
  };
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
