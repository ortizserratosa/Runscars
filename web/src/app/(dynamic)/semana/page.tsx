import { getRequestLocale } from "../../../lib/i18n/server";
import { weeklyMetadata } from "../../semana/metadata";
import { weekStart } from "../../../lib/discovery/weekly";
import { WeeklyView } from "../../semana/WeeklyView";
export async function generateMetadata() {
  const locale = await getRequestLocale();
  return weeklyMetadata(locale);
}
export default async function Page() {
  return (
    <WeeklyView
      week={weekStart(new Date())}
      locale={await getRequestLocale()}
    />
  );
}
