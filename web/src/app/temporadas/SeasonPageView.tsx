import Link from "next/link";
import { localizedCategoryName } from "../../lib/i18n/categories";
import { localeTag, localizedPath, type Locale } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";

type CategorySummary = {
  id: string;
  slug: string;
  name: string;
  candidateCount: number;
  orderedSourceCount: number;
  applicableSourceCount: number;
  updatedAt: string | null;
  previousUpdatedAt: string | null;
  changedSources: string[];
  leader: { label: string; position: number; movement: number | null } | null;
  topMover: { label: string; position: number; movement: number } | null;
  isPublic: boolean;
};

function dateLabel(value: string | null, locale: Locale) {
  if (!value) return locale === "en" ? "pending" : "pendiente";
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export async function SeasonPageView({
  year,
  eligibilityYear,
  status,
  categories,
}: {
  year: 2026 | 2027;
  eligibilityYear: number;
  status: "ACTIVA" | "CERRADA";
  categories: CategorySummary[];
}) {
  const locale = await getRequestLocale();
  const en = locale === "en";
  const active = year === 2027;
  const recentChanges = active
    ? categories
        .filter((category) => category.updatedAt && category.previousUpdatedAt)
        .sort(
          (left, right) =>
            Date.parse(right.updatedAt ?? "") -
            Date.parse(left.updatedAt ?? ""),
        )
        .slice(0, 4)
    : [];
  return (
    <main>
      <section className="season-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href={localizedPath("/", locale)}>
              {en ? "Home" : "Inicio"}
            </Link>
            <span>/</span>
            <span>{en ? "Seasons" : "Temporadas"}</span>
          </div>
          <div className="season-title-row">
            <div>
              <p className="kicker">
                {active
                  ? en
                    ? "Active season"
                    : "Temporada activa"
                  : en
                    ? "Official archive"
                    : "Archivo oficial"}
              </p>
              <h1>
                Oscar <em>{year}</em>
              </h1>
              <p>
                {en ? "Films from" : "Películas de"} {eligibilityYear} ·{" "}
                {active
                  ? en
                    ? "professional predictions"
                    : "predicciones profesionales"
                  : en
                    ? "official nominees and winners"
                    : "nominados y ganadores oficiales"}
              </p>
            </div>
            <div className="season-stamp">
              <span>{en ? "Status" : "Estado"}</span>
              <strong>
                {en ? (status === "ACTIVA" ? "ACTIVE" : "CLOSED") : status}
              </strong>
              <small>
                {categories.filter((category) => category.isPublic).length}/8
                {en ? "categories available" : "categorías disponibles"}
              </small>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell season-layout">
        <div className="season-main">
          {recentChanges.length ? (
            <section className="season-movements">
              <div className="section-heading compact-heading">
                <div>
                  <p className="section-index">
                    {en ? "LATEST MOVEMENTS" : "ÚLTIMOS MOVIMIENTOS"}
                  </p>
                  <h2>
                    {en
                      ? "What changed this season"
                      : "Qué cambió en la temporada"}
                  </h2>
                </div>
              </div>
              <div className="season-movement-grid">
                {recentChanges.map((category) => (
                  <Link
                    href={localizedPath(
                      `/temporadas/${year}/${category.slug}`,
                      locale,
                    )}
                    key={category.id}
                  >
                    <span>{dateLabel(category.updatedAt, locale)}</span>
                    <h3>
                      {localizedCategoryName(
                        locale,
                        category.id,
                        category.name,
                      )}
                    </h3>
                    {category.topMover ? (
                      <p>
                        <strong>+{category.topMover.movement}</strong>{" "}
                        {category.topMover.label}
                      </p>
                    ) : (
                      <p>
                        {en ? "Leader" : "Líder"}:{" "}
                        {category.leader?.label ??
                          (en ? "pending" : "pendiente")}
                      </p>
                    )}
                    <small>
                      {category.changedSources.length
                        ? `${en ? "Changed" : "Cambió"}: ${category.changedSources.join(", ")}`
                        : en
                          ? "First available state"
                          : "Primer estado disponible"}
                    </small>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          <div className="section-heading compact-heading">
            <div>
              <p className="section-index">
                {en ? "CATEGORIES" : "CATEGORÍAS"}
              </p>
              <h2>
                {en
                  ? "Eight races, kept separate"
                  : "Ocho carreras, por separado"}
              </h2>
            </div>
          </div>
          <div className="category-grid">
            {categories.map((category, index) => (
              <Link
                className={`category-card ${
                  category.isPublic ? "active-category" : "muted-category"
                }`}
                href={localizedPath(
                  `/temporadas/${year}/${category.slug}`,
                  locale,
                )}
                key={category.id}
              >
                <span className="category-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>
                    {localizedCategoryName(locale, category.id, category.name)}
                  </h3>
                  <p>
                    {active
                      ? `${category.applicableSourceCount} ${en ? "outlets with data" : "medios con datos"}`
                      : `${category.candidateCount} ${en ? "official nominees" : "nominados oficiales"}`}
                  </p>
                  {active && category.leader ? (
                    <small>
                      {en ? "Leader" : "Líder"}: {category.leader.label} ·{" "}
                      {en ? "updated" : "cambio"}{" "}
                      {dateLabel(category.updatedAt, locale)}
                    </small>
                  ) : null}
                </div>
                <strong>{category.candidateCount || "—"}</strong>
                <span className="category-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            ))}
          </div>
        </div>
        <aside className="season-sidebar">
          <div className="sidebar-card source-status-card">
            <p className="section-index">
              {active
                ? en
                  ? "PROFESSIONAL COVERAGE"
                  : "COBERTURA PROFESIONAL"
                : en
                  ? "ARCHIVE"
                  : "ARCHIVO"}
            </p>
            <div className="big-number">
              {active
                ? Math.min(
                    ...categories.map(
                      (category) => category.orderedSourceCount,
                    ),
                  )
                : categories.reduce(
                    (sum, category) => sum + category.candidateCount,
                    0,
                  )}
            </div>
            <p>
              {active
                ? en
                  ? "outlets with data in the least-covered category"
                  : "medios con datos en la categoría menos cubierta"
                : en
                  ? "official nominees across the eight categories"
                  : "candidaturas oficiales entre las ocho categorías"}
            </p>
            <div className="status-row">
              <span>
                <i className="status-dot green" />{" "}
                {en ? "separate signals" : "señales separadas"}
              </span>
              <span>
                <i className="status-dot amber" />{" "}
                {en ? "visible provenance" : "procedencia visible"}
              </span>
            </div>
            <Link
              href={localizedPath(
                active ? "/temporadas/2026" : "/temporadas/2027",
                locale,
              )}
            >
              {active
                ? en
                  ? "Open the 2026 archive"
                  : "Abrir archivo 2026"
                : en
                  ? "Return to Oscar 2027"
                  : "Volver a Oscar 2027"}{" "}
              →
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
