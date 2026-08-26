import type { Metadata } from "next";
import { getSeasonSummary } from "../../../lib/categories/data";
import { SeasonPageView } from "../SeasonPageView";
import { getRequestLocale } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getRequestLocale()) === "en";
  return {
    title: en ? "Oscar 2026 archive" : "Archivo Oscar 2026",
    description: en
      ? "Official nominees and winners of the 2026 Oscars."
      : "Nominados y ganadores oficiales de los Oscar 2026.",
  };
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
