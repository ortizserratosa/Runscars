import type { Metadata } from "next";
import { getSeasonSummary } from "../../../lib/categories/data";
import { SeasonPageView } from "../SeasonPageView";

export const metadata: Metadata = {
  title: "Archivo Oscar 2026",
  description: "Nominados y ganadores oficiales de los Oscar 2026.",
};

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
