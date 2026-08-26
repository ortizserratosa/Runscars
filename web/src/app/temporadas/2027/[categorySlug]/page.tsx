import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PUBLIC_CATEGORIES,
  categoryBySlug,
} from "../../../../lib/categories/config";
import { getCategoryView } from "../../../../lib/categories/data";
import { getRequestLocale } from "../../../../lib/i18n/server";
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
  const en = (await getRequestLocale()) === "en";
  const name = en ? category.nameEn : category.name;
  return {
    title: `${name} · Oscar 2027`,
    description: en
      ? `Verifiable professional consensus for ${name} at the 2027 Oscars.`
      : `Consenso profesional verificable de ${name} para los Oscar 2027.`,
  };
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
