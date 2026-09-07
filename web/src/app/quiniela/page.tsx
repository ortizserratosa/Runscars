import { PUBLIC_CATEGORIES } from "../../lib/categories/config";
import { getCategoryView } from "../../lib/categories/data";
import { getNomineeSlots } from "../../lib/categories/nominee-slots";
import { getRequestLocale } from "../../lib/i18n/server";
import { getFilmArtwork } from "../../lib/repositories/artwork";
import { buildLocalizedMetadata } from "../../lib/seo";
import { GuestBallot } from "./GuestBallot";
export async function generateMetadata() {
  const locale = await getRequestLocale();
  return buildLocalizedMetadata({
    locale,
    path: "/quiniela",
    title:
      locale === "en"
        ? "Make your Oscar 2027 ballot"
        : "Crea tu quiniela de los Oscar 2027",
    description:
      locale === "en"
        ? "Choose and rank your Oscar favourites. Try your personal ballot before signing in, then compare your picks with the experts."
        : "Elige y ordena tus favoritas para los Oscar. Prueba tu quiniela sin registrarte y compara tus elecciones con las de los expertos.",
  });
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const [locale, query] = await Promise.all([getRequestLocale(), searchParams]);
  const en = locale === "en";
  const categories = (
    await Promise.all(
      PUBLIC_CATEGORIES.map(async (category) => {
        const [view, slots] = await Promise.all([
          getCategoryView(2027, category.id),
          getNomineeSlots("oscars-2027", category.id),
        ]);
        return {
          id: category.id,
          slug: category.slug,
          name: en ? category.nameEn : category.name,
          limit: slots ? slots.count + 1 : 0,
          candidates: view.mode === "active" ? view.currentCandidates : [],
        };
      }),
    )
  ).filter((category) => category.limit > 0);
  const artwork = await getFilmArtwork(
    categories.flatMap((category) =>
      category.candidates.map((item) => item.filmId),
    ),
    locale,
  );
  return (
    <main className="page-shell">
      <header className="discovery-hero">
        <p className="section-index">
          OSCAR 2027 · {en ? "YOUR CALL" : "TÚ DECIDES"}
        </p>
        <h1>{en ? "Pick your winners." : "Elige a tus ganadoras."}</h1>
        <p>
          {en
            ? "Trust your taste. Build your ballot, then see where you agree with the experts. No account needed to try."
            : "Confía en tu criterio. Crea tu quiniela y descubre en qué coincides con los expertos. Pruébala sin registrarte."}
        </p>
      </header>
      {categories.length ? (
        <GuestBallot
          categories={categories}
          locale={locale}
          artwork={artwork}
          initialCategory={
            categories.find((category) => category.slug === query.categoria)
              ?.id ?? categories[0].id
          }
        />
      ) : (
        <p>
          {en
            ? "Ballots are temporarily unavailable. Please try again later."
            : "Las quinielas no están disponibles ahora. Vuelve a intentarlo más tarde."}
        </p>
      )}
    </main>
  );
}
