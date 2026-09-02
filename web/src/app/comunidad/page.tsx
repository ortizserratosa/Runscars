import type { Metadata } from "next";
import Link from "next/link";
import { PUBLIC_CATEGORIES } from "../../lib/categories/config";
import { parseCommunityFilters } from "../../lib/community/validation";
import { localizedCategoryName } from "../../lib/i18n/categories";
import { localeTag, localizedPath, type Locale } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import {
  countPublicRankingsByCategory,
  listPublicRankings,
  publicRankingUrl,
} from "../../lib/repositories/community";
import { buildLocalizedMetadata } from "../../lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const en = locale === "en";
  return buildLocalizedMetadata({
    locale,
    path: "/comunidad",
    title: en
      ? "Oscar 2027 Community Ballots"
      : "Quinielas Oscar 2027 de la comunidad",
    description: en
      ? "Discover public individual ballots for the 2027 Oscar season, kept separate from the professional predictions consensus."
      : "Descubre quinielas individuales públicas para los Oscar 2027, siempre separadas del consenso de predicciones profesionales.",
  });
}

export const dynamic = "force-dynamic";

type CommunityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
  }).format(new Date(value));
}

function hrefFor({
  season,
  category,
  q,
  page,
  locale,
}: {
  season: string;
  category?: string;
  q?: string;
  page?: number;
  locale: Locale;
}) {
  const params = new URLSearchParams({ season });
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  return localizedPath(`/comunidad?${params.toString()}`, locale);
}

export default async function CommunityPage({
  searchParams,
}: CommunityPageProps) {
  const [params, locale] = await Promise.all([
    searchParams,
    getRequestLocale(),
  ]);
  const en = locale === "en";
  const filters = parseCommunityFilters(params);
  const [result, counts] = await Promise.all([
    listPublicRankings({
      seasonId: filters.seasonId,
      categoryId: filters.categoryId,
      query: filters.query,
      page: filters.page,
    }),
    countPublicRankingsByCategory(filters.seasonId),
  ]);
  const currentCategory = PUBLIC_CATEGORIES.find(
    (category) =>
      category.id === filters.categoryId ||
      category.slug === filters.categoryId,
  );
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <main className="page-shell community-page">
      <header className="community-hero">
        <div>
          <p className="section-index">
            {en
              ? "COMMUNITY · PUBLIC BALLOTS"
              : "COMUNIDAD · QUINIELAS PÚBLICAS"}
          </p>
          <h1>
            {en
              ? "The season, seen by other people."
              : "La temporada, vista por otras personas."}
          </h1>
          <p>
            {en
              ? "Discover individual rankings, compare instincts and share a complete ballot. There are no likes, threads or community consensus: only the positions each person chooses to publish."
              : "Descubre rankings individuales, compara intuiciones y comparte una quiniela completa. No hay likes, hilos ni consenso comunitario: solo posiciones que cada persona decide publicar."}
          </p>
        </div>
        <Link
          className="primary-button"
          href={localizedPath("/acceso", locale)}
        >
          {en ? "Create my ballot →" : "Crear mi quiniela →"}
        </Link>
      </header>

      <section
        className="community-filter-panel"
        aria-label={en ? "Filter ballots" : "Filtrar quinielas"}
      >
        <form
          action={localizedPath("/comunidad", locale)}
          className="community-filters"
        >
          <label>
            {en ? "Season" : "Temporada"}
            <select defaultValue={filters.seasonId} name="season">
              <option value="oscars-2027">Oscar 2027</option>
              <option value="oscars-2026">Oscar 2026</option>
            </select>
          </label>
          <label>
            {en ? "Find a user" : "Buscar usuario"}
            <input
              defaultValue={filters.query}
              name="q"
              placeholder={en ? "Name or @username" : "Nombre o @usuario"}
            />
          </label>
          <label>
            {en ? "Category" : "Categoría"}
            <select defaultValue={filters.categoryId ?? ""} name="category">
              <option value="">
                {en ? "All categories" : "Todas las categorías"}
              </option>
              {PUBLIC_CATEGORIES.map((category) => (
                <option key={category.id} value={category.slug}>
                  {locale === "en" ? category.nameEn : category.name} ·{" "}
                  {counts.get(category.id) ?? 0}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button dark-button" type="submit">
            {en ? "Filter" : "Filtrar"}
          </button>
        </form>
      </section>

      <section className="community-list-section">
        <div className="section-heading split-heading">
          <div>
            <p className="section-index">
              {en
                ? "OSCAR 2027 · RECENTLY UPDATED"
                : "OSCAR 2027 · ACTUALIZADAS RECIENTEMENTE"}
            </p>
            <h2>
              {currentCategory
                ? en
                  ? currentCategory.nameEn
                  : currentCategory.name
                : en
                  ? "All categories"
                  : "Todas las categorías"}
            </h2>
          </div>
          <p>
            {result.total}{" "}
            {en ? "public ballots found." : "quinielas públicas encontradas."}
          </p>
        </div>
        {result.rankings.length ? (
          <div className="community-ranking-grid">
            {result.rankings.map((ranking) => (
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
                <span className="community-ranking-copy">
                  <strong>{ranking.profile.displayName}</strong>
                  <small>
                    {localizedCategoryName(
                      locale,
                      ranking.categoryId,
                      ranking.categoryName,
                    )}{" "}
                    · {ranking.entriesCount} {en ? "positions" : "posiciones"}
                  </small>
                  <small>
                    {ranking.watchedCount} {en ? "watched" : "vistas"} ·{" "}
                    {en ? "updated" : "actualizada"}{" "}
                    {formatDate(ranking.updatedAt, locale)}
                  </small>
                </span>
                <span aria-hidden="true" className="community-card-arrow">
                  ↗
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-community-state">
            <h3>
              {en
                ? "There are no ballots matching these filters yet."
                : "Aún no hay quinielas con estos filtros."}
            </h3>
            <p>
              {en
                ? "Try another category or create the first one from your account."
                : "Prueba otra categoría o crea la primera desde tu cuenta."}
            </p>
          </div>
        )}
        {totalPages > 1 ? (
          <nav
            aria-label={en ? "Community pagination" : "Paginación de comunidad"}
            className="community-pagination"
          >
            {filters.page > 1 ? (
              <Link
                href={hrefFor({
                  season: filters.seasonId,
                  category: filters.categoryId,
                  q: filters.query,
                  page: filters.page - 1,
                  locale,
                })}
              >
                {en ? "← Previous" : "← Anteriores"}
              </Link>
            ) : null}
            <span>
              {en ? "Page" : "Página"} {filters.page} {en ? "of" : "de"}{" "}
              {totalPages}
            </span>
            {filters.page < totalPages ? (
              <Link
                href={hrefFor({
                  season: filters.seasonId,
                  category: filters.categoryId,
                  q: filters.query,
                  page: filters.page + 1,
                  locale,
                })}
              >
                {en ? "Next →" : "Siguientes →"}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
