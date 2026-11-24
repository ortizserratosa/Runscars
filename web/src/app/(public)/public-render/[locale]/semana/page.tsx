import { publicLocale } from "../../../../../lib/rendering/public-locale";
import { weekStart } from "../../../../../lib/discovery/weekly";
import { WeeklyView } from "../../../../semana/WeeklyView";
import { weeklyMetadata } from "../../../../semana/metadata";
export const revalidate = 60;
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  return weeklyMetadata(await publicLocale(params));
}
export default async function Page({ params }: Props) {
  return (
    <WeeklyView
      week={weekStart(new Date())}
      locale={await publicLocale(params)}
    />
  );
}
