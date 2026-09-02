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
    path: "/temporadas/2026",
    title: en
      ? "2026 Oscars Nominees and Winners"
      : "Oscar 2026: nominados y ganadores",
    description: en
      ? "Official nominees and winners of the 2026 Oscars across eight major categories."
      : "Nominados y ganadores oficiales de los Oscar 2026 en ocho categorías principales.",
  });
}

export default async function Season2026Page() {
  const categories = await getSeasonSummary(2026);
  return (
    <SeasonPageView
      categories={categories}
      eligibilityYear={2025}
      status="CERRADA"
      year={2026}
    />
  );
}
