import { notFound } from "next/navigation";
import { getRequestLocale } from "../../../lib/i18n/server";
import { buildLocalizedMetadata } from "../../../lib/seo";
import { validWeek } from "../../../lib/discovery/weekly";
import { WeeklyView } from "../WeeklyView";
type Props = { params: Promise<{ week: string }> };
export async function generateMetadata({ params }: Props) {
  const [{ week }, locale] = await Promise.all([params, getRequestLocale()]);
  if (!validWeek(week)) return {};
  return buildLocalizedMetadata({
    locale,
    socialImage: `/api/social?kind=weekly&id=${week}&lang=${locale}`,
    path: `/semana/${week}`,
    title:
      locale === "en"
        ? `Oscar race: week of ${week}`
        : `Carrera Oscar: semana del ${week}`,
    description:
      locale === "en"
        ? "Explore this week’s recorded Oscar prediction changes, leaders and festival calendar."
        : "Consulta los cambios registrados en las predicciones Oscar, las favoritas y los festivales de esta semana.",
  });
}
export default async function Page({ params }: Props) {
  const { week } = await params;
  if (!validWeek(week)) notFound();
  return <WeeklyView week={week} locale={await getRequestLocale()} />;
}
