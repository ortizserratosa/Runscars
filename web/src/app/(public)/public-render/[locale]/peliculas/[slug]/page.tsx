import { filmMetadata, renderFilm } from "@/app/views/FilmPageView";
import { publicLocale } from "@/lib/rendering/public-locale";

export const revalidate = 60;

// Catalog pages are generated from the configured database on their first
// public request, rather than baking the local fixture into a release.
export function generateStaticParams() {
  return [];
}

type PublicFilmProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: PublicFilmProps) {
  const [{ slug }, locale] = await Promise.all([params, publicLocale(params)]);
  return filmMetadata(slug, locale);
}

export default async function PublicFilm({ params }: PublicFilmProps) {
  const [{ slug }, locale] = await Promise.all([params, publicLocale(params)]);
  return renderFilm(slug, locale, true);
}
