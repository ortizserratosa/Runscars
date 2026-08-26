import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareButton } from "../../components/ShareButton";
import { listPublicRankings } from "../../../lib/repositories/community";
import { localizedCategoryName } from "../../../lib/i18n/categories";
import { localeTag, localizedPath } from "../../../lib/i18n/config";
import { getRequestLocale } from "../../../lib/i18n/server";

type PublicProfilePageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PublicProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const en = (await getRequestLocale()) === "en";
  return {
    title: `@${slug}`,
    description: en
      ? "Public profile and individual ballots on Runscars."
      : "Perfil público y quinielas individuales en Runscars.",
  };
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const en = locale === "en";
  const result = await listPublicRankings({
    seasonId: "oscars-2027",
    query: slug,
  });
  const rankings = result.rankings.filter(
    (ranking) => ranking.profile.slug === slug,
  );
  const profile = rankings[0]?.profile;
  if (!profile) notFound();

  return (
    <main className="page-shell account-page public-profile-page">
      <header className="account-hero public-profile-hero">
        <div className="profile-identity">
          <span className="community-avatar large" aria-hidden="true">
            {profile.initials}
          </span>
          <div>
            <p className="section-index">
              {en ? "PUBLIC PROFILE" : "PERFIL PÚBLICO"}
            </p>
            <h1>{profile.displayName}</h1>
            <p>@{profile.slug}</p>
          </div>
        </div>
        <ShareButton
          title={
            en
              ? `${profile.displayName}'s ballots`
              : `Quinielas de ${profile.displayName}`
          }
          text={
            en
              ? `Discover ${profile.displayName}'s public Oscar ballots on Runscars.`
              : `Descubre las quinielas públicas de ${profile.displayName} en Runscars.`
          }
          url={localizedPath(`/usuarios/${profile.slug}`, locale)}
          locale={locale}
        />
      </header>

      <section className="public-profile-section">
        <div className="section-heading split-heading">
          <div>
            <p className="section-index">
              {en
                ? "INDIVIDUAL RANKINGS · OSCAR 2027"
                : "RANKINGS INDIVIDUALES · OSCAR 2027"}
            </p>
            <h2>{en ? "Their ballots" : "Sus quinielas"}</h2>
          </div>
          <p>
            {en
              ? "Missing positions are not inferred and these rankings do not form a community consensus."
              : "Las posiciones ausentes no se infieren y estos rankings no forman un consenso comunitario."}
          </p>
        </div>
        <div className="public-ranking-grid">
          {rankings.map((ranking) => (
            <article key={ranking.id}>
              <p className="section-index">
                {localizedCategoryName(
                  locale,
                  ranking.categoryId,
                  ranking.categoryName,
                )}
              </p>
              <h3>
                {ranking.entriesCount} {en ? "positions" : "posiciones"}
              </h3>
              <p>
                {ranking.watchedCount}{" "}
                {en
                  ? "films watched · updated"
                  : "películas vistas · actualizada"}{" "}
                {new Intl.DateTimeFormat(localeTag(locale), {
                  dateStyle: "medium",
                }).format(new Date(ranking.updatedAt))}
              </p>
              <Link
                className="primary-button dark-button"
                href={localizedPath(
                  `/usuarios/${profile.slug}/${ranking.categorySlug}`,
                  locale,
                )}
              >
                {en ? "Open ballot →" : "Abrir quiniela →"}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
