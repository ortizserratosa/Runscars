import { getRequestLocale } from "../../lib/i18n/server";
import { buildLocalizedMetadata } from "../../lib/seo";
import { weekStart } from "../../lib/discovery/weekly";
import { WeeklyView } from "./WeeklyView";
export async function generateMetadata() {
  const locale = await getRequestLocale();
  return buildLocalizedMetadata({
    locale,
    socialImage: `/api/social?kind=weekly&lang=${locale}`,
    path: "/semana",
    title:
      locale === "en"
        ? "This week in the Oscar 2027 race"
        : "Esta semana en la carrera a los Oscar 2027",
    description:
      locale === "en"
        ? "Follow the latest Oscar prediction changes, category leaders and film festivals in the Runscars weekly edition."
        : "Sigue los cambios en las predicciones Oscar, las favoritas por categoría y los festivales de cine en la edición semanal de Runscars.",
  });
}
export default async function Page() {
  return (
    <WeeklyView
      week={weekStart(new Date())}
      locale={await getRequestLocale()}
    />
  );
}
