import { buildLocalizedMetadata } from "../../lib/seo";
import type { Locale } from "../../lib/i18n/config";
function currentWeeklyMetadata(locale: Locale) {
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
function datedWeeklyMetadata(locale: Locale, week: string) {
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
export function weeklyMetadata(locale: Locale, week?: string) {
  return week
    ? datedWeeklyMetadata(locale, week)
    : currentWeeklyMetadata(locale);
}
