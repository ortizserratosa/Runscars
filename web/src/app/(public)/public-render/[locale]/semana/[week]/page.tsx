import { notFound } from "next/navigation";
import { publicLocale } from "../../../../../../lib/rendering/public-locale";
import { validWeek } from "../../../../../../lib/discovery/weekly";
import { WeeklyView } from "../../../../../semana/WeeklyView";
import { weeklyMetadata } from "../../../../../semana/metadata";
export const revalidate = 60;
export function generateStaticParams() {
  return [];
}
type Props = { params: Promise<{ locale: string; week: string }> };
export async function generateMetadata({ params }: Props) {
  const [{ week }, locale] = await Promise.all([params, publicLocale(params)]);
  return validWeek(week) ? weeklyMetadata(locale, week) : {};
}
export default async function Page({ params }: Props) {
  const [{ week }, locale] = await Promise.all([params, publicLocale(params)]);
  if (!validWeek(week)) notFound();
  return <WeeklyView week={week} locale={locale} />;
}
