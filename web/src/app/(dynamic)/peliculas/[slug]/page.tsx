import { getRequestLocale } from "../../../../lib/i18n/server";
import { listFixtureFilmIds } from "../../../../lib/repositories/catalog";
import { filmMetadata, renderFilm } from "../../../views/FilmPageView";

type FilmPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listFixtureFilmIds().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: FilmPageProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  return filmMetadata(slug, locale);
}

export default async function FilmPage({ params }: FilmPageProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  return renderFilm(slug, locale);
}
