import type { Metadata } from "next";
import { getSeasonSummary } from "../../../lib/categories/data";
import { SeasonPageView } from "../SeasonPageView";
import { getRequestLocale } from "../../../lib/i18n/server";
import { buildLocalizedMetadata } from "../../../lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const en = locale === "en";
  return buildLocalizedMetadata({
    locale,
    path: "/temporadas/2027",
    title: en
      ? "Oscar Predictions 2027 by Category"
      : "Predicciones Oscar 2027 por categoría",
    description: en
      ? "Explore updated 2027 Oscar predictions for Best Picture, directing, acting and screenplay, with transparent expert sources."
      : "Consulta las predicciones de los Oscar 2027 para película, dirección, interpretación y guion con fuentes expertas transparentes.",
  });
}

export default async function Season2027Page() {
  const categories = await getSeasonSummary(2027);
  return (
    <SeasonPageView
      categories={categories}
      eligibilityYear={2026}
      status="ACTIVA"
      year={2027}
    />
  );
}
