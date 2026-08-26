import { categoryById, categoryBySlug } from "../categories/config";
import type { Locale } from "./config";

export function localizedCategoryName(
  locale: Locale,
  categoryId: string,
  fallback: string,
) {
  const category = categoryById(categoryId);
  return locale === "en" ? (category?.nameEn ?? fallback) : fallback;
}

export function localizedCategoryNameBySlug(
  locale: Locale,
  categorySlug: string,
  fallback: string,
) {
  const category = categoryBySlug(categorySlug);
  return locale === "en" ? (category?.nameEn ?? fallback) : fallback;
}
