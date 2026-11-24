import { notFound } from "next/navigation";
import { categoryBySlug } from "../../../../../../../lib/categories/config";
import { getCategoryView } from "../../../../../../../lib/categories/data";
import { publicLocale } from "../../../../../../../lib/rendering/public-locale";
import { CategoryPageView } from "../../../../../../temporadas/CategoryPageView";
import { categoryMetadata } from "../../../../../../temporadas/category-metadata";
export const revalidate = 60;
export function generateStaticParams() {
  return [];
}
type Props = { params: Promise<{ locale: string; categorySlug: string }> };
export async function generateMetadata({ params }: Props) {
  const [{ categorySlug }, locale] = await Promise.all([
    params,
    publicLocale(params),
  ]);
  return categoryMetadata(categorySlug, locale);
}
export default async function Page({ params }: Props) {
  const [{ categorySlug }, locale] = await Promise.all([
    params,
    publicLocale(params),
  ]);
  const category = categoryBySlug(categorySlug);
  if (!category) notFound();
  const view = await getCategoryView(2027, category.id);
  return (
    <CategoryPageView
      category={category}
      view={view}
      locale={locale}
      anonymous
    />
  );
}
