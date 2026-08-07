import type { Metadata } from "next";
import { getSeasonSummary } from "../../../lib/categories/data";
import { SeasonPageView } from "../SeasonPageView";

export const metadata: Metadata = {
  title: "Oscar 2027",
  description: "Temporada Oscar 2027 · películas de 2026.",
};

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
