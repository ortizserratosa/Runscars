import type { Metadata } from "next";
import { categoryBySlug } from "../../lib/categories/config";
import type { Locale } from "../../lib/i18n/config";
import { buildLocalizedMetadata } from "../../lib/seo";
export async function categoryMetadata(
  categorySlug: string,
  locale: Locale,
): Promise<Metadata> {
  const category = categoryBySlug(categorySlug);
  if (!category) return {};
  const en = locale === "en";
  const name = en ? category.nameEn : category.name;
  return buildLocalizedMetadata({
    locale,
    socialImage: `/api/social?kind=category&id=${category.slug}&lang=${locale}`,
    path: `/temporadas/2027/${category.slug}`,
    title: en
      ? `${name} Oscar Predictions 2027`
      : `Predicciones Oscar 2027: ${name}`,
    description: en
      ? `Updated ${name} predictions for the 2027 Oscars, combining specialist rankings with transparent sources and change history.`
      : `Predicciones actualizadas de ${name} para los Oscar 2027, con rankings de especialistas, fuentes y evolución verificables.`,
  });
}
