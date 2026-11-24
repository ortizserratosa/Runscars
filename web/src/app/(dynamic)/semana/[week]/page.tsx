import { notFound } from "next/navigation";
import { getRequestLocale } from "../../../../lib/i18n/server";
import { weeklyMetadata } from "../../../semana/metadata";
import { validWeek } from "../../../../lib/discovery/weekly";
import { WeeklyView } from "../../../semana/WeeklyView";
type Props = { params: Promise<{ week: string }> };
export async function generateMetadata({ params }: Props) {
  const [{ week }, locale] = await Promise.all([params, getRequestLocale()]);
  if (!validWeek(week)) return {};
  return weeklyMetadata(locale, week);
}
export default async function Page({ params }: Props) {
  const { week } = await params;
  if (!validWeek(week)) notFound();
  return <WeeklyView week={week} locale={await getRequestLocale()} />;
}
