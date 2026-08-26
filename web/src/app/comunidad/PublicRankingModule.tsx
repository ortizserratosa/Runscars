import Link from "next/link";
import {
  listPublicRankings,
  publicRankingUrl,
} from "../../lib/repositories/community";
import { localizedCategoryName } from "../../lib/i18n/categories";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";

export async function PublicRankingModule({
  categoryId,
  categoryName,
}: {
  categoryId: string;
  categoryName: string;
}) {
  const [result, locale] = await Promise.all([
    listPublicRankings({
      seasonId: "oscars-2027",
      categoryId,
    }),
    getRequestLocale(),
  ]);
  const en = locale === "en";
  const rankings = result.rankings.slice(0, 3);
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
            ? `${localizedCategoryName(locale, categoryId, categoryName)} ranked by other people, with explicit positions and kept separate from professional consensus.`
            : `${categoryName} ordenada por otras personas, con posiciones explícitas y sin mezclarla con el consenso profesional.`}
        </p>
      </div>
      {rankings.length ? (
        <div className="community-ranking-grid compact">
          {rankings.map((ranking) => (
            <Link
              className="community-ranking-card"
              href={localizedPath(
                publicRankingUrl({
                  slug: ranking.profile.slug,
                  categorySlug: ranking.categorySlug,
                }),
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
        className="text-link"
        href={localizedPath(`/comunidad?category=${categoryId}`, locale)}
      >
        {en ? "Explore all ballots →" : "Explorar todas las quinielas →"}
      </Link>
    </section>
  );
}
