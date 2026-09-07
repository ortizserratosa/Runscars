import { categoryBySlug } from "../../../lib/categories/config";
import { getCategoryView } from "../../../lib/categories/data";
import { getWeeklyReport } from "../../../lib/discovery/report";
import { socialCard } from "../../../lib/discovery/SocialCard";
import { validWeek, weekStart } from "../../../lib/discovery/weekly";
import { getFestivalEdition } from "../../../lib/festivals/data";
import {
  festivalDateRange,
  festivalName,
  festivalPreview,
} from "../../../lib/festivals/presentation";
import { getFilmArtwork } from "../../../lib/repositories/artwork";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const locale = query.get("lang") === "en" ? "en" : "es";
  const en = locale === "en";
  const kind = query.get("kind");
  const id = query.get("id") ?? "";
  if (kind === "festival") {
    if (!/^[a-z-]+$/.test(id))
      return new Response("Not found", { status: 404 });
    const edition = await getFestivalEdition(id, 2026);
    if (!edition) return new Response("Not found", { status: 404 });
    const preview = festivalPreview(edition);
    const entry = preview.entries[0];
    const artwork = await getFilmArtwork([entry?.filmId ?? null], locale);
    return socialCard({
      eyebrow: en
        ? "THE FESTIVAL CIRCUIT · 2026"
        : "EL CIRCUITO FESTIVALERO · 2026",
      title: `${festivalName(edition, locale)} 2026`,
      subtitle: entry
        ? `${entry.awardType ?? (en ? "In the selection" : "En la selección")}: ${entry.originalTitle}`
        : en
          ? "Discover the films and explore the official programme."
          : "Descubre las películas y explora el programa oficial.",
      detail: festivalDateRange(edition.startsOn, edition.endsOn, locale),
      posterPath: entry?.filmId ? artwork[entry.filmId]?.posterPath : null,
    });
  }
  if (kind === "category") {
    const category = categoryBySlug(id);
    if (!category) return new Response("Not found", { status: 404 });
    const view = await getCategoryView(2027, category.id);
    if (view.mode !== "active")
      return new Response("Not found", { status: 404 });
    const leader = view.aggregate?.ranking[0];
    const artwork = await getFilmArtwork([leader?.film?.id ?? null], locale);
    return socialCard({
      eyebrow: `OSCAR 2027 · ${en ? "EXPERT PREDICTIONS" : "PREDICCIONES DE EXPERTOS"}`,
      title: en ? category.nameEn : category.name,
      subtitle: leader
        ? `${en ? "Leading the race" : "Lidera la carrera"}: ${leader.label}`
        : en
          ? "Follow the race to the Oscars."
          : "Sigue la carrera a los Oscar.",
      detail: view.snapshot
        ? `${en ? "Updated" : "Actualizado"} ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(view.snapshot.lockedAt))}`
        : "runscars.app",
      posterPath: leader?.film ? artwork[leader.film.id]?.posterPath : null,
    });
  }
  if (kind === "weekly") {
    const week = id || weekStart(new Date());
    if (!validWeek(week)) return new Response("Not found", { status: 404 });
    const report = await getWeeklyReport(week);
    const leader = report.categories[0]?.leader;
    const artwork = await getFilmArtwork([leader?.film?.id ?? null], locale);
    return socialCard({
      eyebrow: "OSCAR 2027",
      title: en ? "This week in the race." : "La carrera, esta semana.",
      subtitle: en
        ? "The leaders, the moves and the festivals to follow."
        : "Las favoritas, los movimientos y los festivales que seguir.",
      detail: festivalDateRange(week, report.endsOn, locale),
      posterPath: leader?.film ? artwork[leader.film.id]?.posterPath : null,
    });
  }
  return new Response("Not found", { status: 404 });
}
