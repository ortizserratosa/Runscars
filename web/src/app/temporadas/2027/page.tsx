import type { Metadata } from "next";
import { getSeasonSummary } from "../../../lib/categories/data";
import { SeasonPageView } from "../SeasonPageView";
import { getRequestLocale } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getRequestLocale()) === "en";
  return {
    title: "Oscar 2027",
    description: en
      ? "Oscar 2027 season · films from 2026."
      : "Temporada Oscar 2027 · películas de 2026.",
  };
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
