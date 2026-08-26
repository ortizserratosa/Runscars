import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryBySlug } from "../../../../lib/categories/config";
import { localizedCategoryName } from "../../../../lib/i18n/categories";
import { localizedPath } from "../../../../lib/i18n/config";
import { getRequestLocale } from "../../../../lib/i18n/server";
import {
  getPublicRanking,
  publicRankingUrl,
} from "../../../../lib/repositories/community";
import { ShareButton } from "../../../components/ShareButton";

type PublicRankingPageProps = {
  params: Promise<{ slug: string; categorySlug: string }>;
};

export const dynamic = "force-dynamic";

async function loadRanking({ params }: PublicRankingPageProps) {
  const { slug, categorySlug } = await params;
  const category = categoryBySlug(categorySlug);
  if (!category) return null;
  return getPublicRanking({
    slug,
    seasonId: "oscars-2027",
    categoryId: category.id,
  });
}

export async function generateMetadata({
  params,
}: PublicRankingPageProps): Promise<Metadata> {
  const ranking = await loadRanking({ params });
  const locale = await getRequestLocale();
  const en = locale === "en";
  if (!ranking)
    return { title: en ? "Ballot not found" : "Quiniela no encontrada" };
  const categoryName = localizedCategoryName(
    locale,
    ranking.categoryId,
    ranking.categoryName,
  );
  return {
    title: `${categoryName} · ${ranking.profile.displayName}`,
    description: en
      ? `${ranking.profile.displayName}'s ${ranking.entriesCount}-position ballot for Oscar 2027.`
      : `${ranking.entriesCount} posiciones de ${ranking.profile.displayName} para Oscar 2027.`,
    openGraph: {
      title: `${categoryName} · ${ranking.profile.displayName}`,
      description: en
        ? `${ranking.entriesCount} positions with explicit watch states.`
        : `${ranking.entriesCount} posiciones y estados de visionado explícitos.`,
      images: ["./opengraph-image"],
    },
  };
}

export default async function PublicRankingPage({
  params,
}: PublicRankingPageProps) {
  const ranking = await loadRanking({ params });
  if (!ranking) notFound();
  const locale = await getRequestLocale();
  const en = locale === "en";
  const categoryName = localizedCategoryName(
    locale,
    ranking.categoryId,
    ranking.categoryName,
  );
  const shareUrl = localizedPath(
    publicRankingUrl({
      slug: ranking.profile.slug,
      categorySlug: ranking.categorySlug,
    }),
    locale,
  );
  const labels = {
    watched: en ? "Watched" : "Vista",
    not_watched: en ? "Not watched" : "No vista",
    unmarked: en ? "Unmarked" : "No indicada",
  } as const;

  return (
    <main className="page-shell public-ranking-page">
      <div className="breadcrumb">
        <Link href={localizedPath("/comunidad", locale)}>
          {en ? "Community" : "Comunidad"}
        </Link>
        <span>/</span>
        <Link href={localizedPath(`/usuarios/${ranking.profile.slug}`, locale)}>
          {ranking.profile.displayName}
        </Link>
        <span>/</span>
        <span>{categoryName}</span>
      </div>
      <header className="public-ranking-hero">
        <div className="profile-identity">
          <span className="community-avatar large" aria-hidden="true">
            {ranking.profile.initials}
          </span>
          <div>
            <p className="section-index">
              {en
                ? "PUBLIC BALLOT · OSCAR 2027"
                : "QUINIELA PÚBLICA · OSCAR 2027"}
            </p>
            <h1>{categoryName}</h1>
            <p>
              {en ? "By" : "De"} {ranking.profile.displayName} ·{" "}
              {ranking.entriesCount} {en ? "positions" : "posiciones"}
            </p>
          </div>
        </div>
        <ShareButton
          title={`${categoryName} · ${ranking.profile.displayName}`}
          text={
            en
              ? `View ${ranking.profile.displayName}'s public ballot on Runscars.`
              : `Mira esta quiniela pública de ${ranking.profile.displayName} en Runscars.`
          }
          url={shareUrl}
          locale={locale}
        />
      </header>

      <section className="public-ranking-detail">
        <div className="public-ranking-detail-heading">
          <div>
            <p className="section-index">
              {en ? "EXPLICIT POSITIONS" : "POSICIONES EXPLÍCITAS"}
            </p>
            <h2>
              {ranking.entries.length} {en ? "candidates" : "candidaturas"}
            </h2>
          </div>
          <p>
            {en
              ? "Watch states are shown only for films included in this public ballot."
              : "Los estados de visionado solo se muestran para las películas incluidas en esta quiniela pública."}
          </p>
        </div>
        <ol className="public-ranking-list">
          {ranking.entries.map((entry) => (
            <li key={entry.id}>
              <span className="public-ranking-position">
                {String(entry.position).padStart(2, "0")}
              </span>
              <span className="public-ranking-film">
                {entry.filmId ? (
                  <Link
                    href={localizedPath(`/peliculas/${entry.filmId}`, locale)}
                  >
                    {entry.filmTitle ?? entry.label}
                  </Link>
                ) : (
                  <strong>{entry.label}</strong>
                )}
                {entry.filmId ? (
                  <span className={`watch-state ${entry.filmState}`}>
                    {labels[entry.filmState]}
                  </span>
                ) : null}
              </span>
              <span className="public-ranking-label">{entry.label}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
