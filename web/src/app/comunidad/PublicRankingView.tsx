import Link from "next/link";
import { localizedCategoryName } from "../../lib/i18n/categories";
import { localizedPath, type Locale } from "../../lib/i18n/config";

export type PublicRankingSummary = {
  id: string;
  categorySlug: string;
  profile: { slug: string; displayName: string; initials: string };
  entriesCount: number;
  watchedCount: number;
};

export type PublicRankingSummaryResult = {
  total: number;
  rankings: PublicRankingSummary[];
};

export function PublicRankingView({
  categoryId,
  categoryName,
  locale,
  result,
}: {
  categoryId: string;
  categoryName: string;
  locale: Locale;
  result: PublicRankingSummaryResult;
}) {
  const en = locale === "en";
  return (
    <section className="community-module">
      <div className="section-heading split-heading">
        <div>
          <p className="section-index">
            {en ? "COMMUNITY" : "COMUNIDAD"} · {result.total}{" "}
            {en ? "PUBLIC" : "PÚBLICAS"}
          </p>
          <h2>{en ? "Public ballots" : "Quinielas públicas"}</h2>
        </div>
        <p>
          {en
            ? `${localizedCategoryName(locale, categoryId, categoryName)} through other film fans’ picks.`
            : `${categoryName} según las favoritas de otros cinéfilos.`}
        </p>
      </div>
      {result.rankings.length ? (
        <div className="community-ranking-grid compact">
          {result.rankings.slice(0, 3).map((ranking) => (
            <Link
              prefetch={false}
              className="community-ranking-card"
              href={localizedPath(
                `/usuarios/${ranking.profile.slug}/${ranking.categorySlug}`,
                locale,
              )}
              key={ranking.id}
            >
              <span className="community-avatar" aria-hidden="true">
                {ranking.profile.initials}
              </span>
              <span>
                <strong>{ranking.profile.displayName}</strong>
                <small>
                  {ranking.entriesCount} {en ? "positions" : "posiciones"} ·{" "}
                  {ranking.watchedCount} {en ? "watched" : "vistas"}
                </small>
              </span>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="privacy-note">
          {en
            ? "There are no public ballots in this category yet."
            : "Todavía no hay quinielas públicas en esta categoría."}
        </p>
      )}
      <Link
        prefetch={false}
        className="text-link"
        href={localizedPath(`/comunidad?category=${categoryId}`, locale)}
      >
        {en ? "Explore all ballots →" : "Explorar todas las quinielas →"}
      </Link>
    </section>
  );
}
