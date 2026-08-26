import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { localizedCategoryNameBySlug } from "../../../lib/i18n/categories";
import { localeTag, localizedPath } from "../../../lib/i18n/config";
import { getRequestLocale } from "../../../lib/i18n/server";
import { getSourceDetail } from "../../../lib/repositories/sources";

type SourcePageProps = { params: Promise<{ slug: string }> };

function dateLabel(value: string | null, locale: "es" | "en", time = false) {
  if (!value) return locale === "en" ? "No data" : "Sin dato";
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
    ...(time ? { timeStyle: "short" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(value));
}

function originalLabel(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.raw === "string") return record.raw;
    if (typeof record.title === "string") return record.title;
  }
  return JSON.stringify(value);
}

export async function generateMetadata({
  params,
}: SourcePageProps): Promise<Metadata> {
  const { slug } = await params;
  const source = await getSourceDetail(slug);
  const locale = await getRequestLocale();
  return source
    ? {
        title: `${source.name} · ${locale === "en" ? "Source" : "Fuente"}`,
        description:
          locale === "en"
            ? `Publications and verifiable status for ${source.name} on Runscars.`
            : `Publicaciones y estado verificable de ${source.name} en Runscars.`,
      }
    : { title: locale === "en" ? "Source not found" : "Fuente no encontrada" };
}

export default async function SourcePage({ params }: SourcePageProps) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const isEnglish = locale === "en";
  const source = await getSourceDetail(slug);
  if (!source) notFound();
  const activePublication = source.categories[0]?.publication;

  return (
    <main>
      <section className="source-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href={localizedPath("/", locale)}>
              {isEnglish ? "Home" : "Inicio"}
            </Link>
            <span>/</span>
            <Link href={localizedPath("/fuentes", locale)}>
              {isEnglish ? "Sources" : "Fuentes"}
            </Link>
            <span>/</span>
            <span>{source.name}</span>
          </div>
          <div className="source-title-row">
            <div className="source-logo-block" aria-hidden="true">
              <span>
                {source.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <small>{isEnglish ? "SOURCE" : "FUENTE"}</small>
            </div>
            <div>
              <p className="kicker">
                {isEnglish
                  ? "Active source · provenance"
                  : "Fuente activa · procedencia"}
              </p>
              <h1>{source.name}</h1>
              <p>
                {source.notes ??
                  (isEnglish
                    ? "Publications and observations preserved with their original value, date and capture."
                    : "Publicaciones y observaciones conservadas con valor original, fecha y captura.")}
              </p>
            </div>
            <a
              className="primary-button"
              href={activePublication?.url ?? source.homepageUrl}
              rel="noreferrer"
              target="_blank"
            >
              {isEnglish
                ? "Open original publication ↗"
                : "Abrir publicación original ↗"}
            </a>
          </div>
        </div>
      </section>

      <section className="page-shell source-page-layout">
        <div className="source-main">
          {source.categories.length ? (
            source.categories.map((category) => (
              <article
                className="source-category-capture"
                key={category.categoryId}
              >
                <div className="source-capture-header">
                  <div>
                    <p className="section-index">
                      {isEnglish ? "ACTIVE PUBLICATION" : "PUBLICACIÓN ACTIVA"}
                    </p>
                    <h2>
                      {localizedCategoryNameBySlug(
                        locale,
                        category.categorySlug,
                        category.categoryName,
                      )}
                    </h2>
                    <p>{category.publication.title}</p>
                  </div>
                  <span className="verified-badge">
                    {isEnglish
                      ? "✓ Verified provenance"
                      : "✓ Procedencia verificada"}
                  </span>
                </div>

                <div className="capture-metadata">
                  <div>
                    <span>{isEnglish ? "Author" : "Autor"}</span>
                    <strong>
                      {category.publication.author ??
                        (isEnglish ? "Not provided" : "No indicado")}
                    </strong>
                  </div>
                  <div>
                    <span>{isEnglish ? "Published" : "Publicada"}</span>
                    <strong>
                      {dateLabel(category.publication.publishedAt, locale)}
                    </strong>
                  </div>
                  <div>
                    <span>{isEnglish ? "Captured" : "Capturada"}</span>
                    <strong>
                      {dateLabel(category.publication.capturedAt, locale, true)}
                    </strong>
                  </div>
                  <div>
                    <span>
                      {isEnglish
                        ? "Latest effective change"
                        : "Último cambio efectivo"}
                    </span>
                    <strong>
                      {dateLabel(category.lastChangedAt, locale, true)}
                    </strong>
                  </div>
                </div>

                <div className="source-ranking-section">
                  <div className="section-heading compact-heading">
                    <div>
                      <p className="section-index">
                        {isEnglish ? "ORIGINAL VALUES" : "VALORES ORIGINALES"}
                      </p>
                      <h2>
                        {isEnglish ? "Included list" : "Lista que participa"}
                      </h2>
                    </div>
                    <span className="aggregate-chip">
                      {category.entries.some(
                        (entry) => entry.appearanceKind === "ordered",
                      )
                        ? isEnglish
                          ? "Included in consensus"
                          : "Participa en el consenso"
                        : isEnglish
                          ? "Coverage only"
                          : "Solo cobertura"}
                    </span>
                  </div>
                  <ol className="source-ranking">
                    {category.entries.map((entry) => (
                      <li key={entry.candidateId}>
                        <span>
                          {entry.rank
                            ? String(entry.rank).padStart(2, "0")
                            : "SEL"}
                        </span>
                        <div className="source-entry-copy">
                          <strong>{entry.label}</strong>
                          <span className="original-value">
                            {isEnglish ? "Original" : "Original"}:{" "}
                            {originalLabel(entry.originalValue)}
                          </span>
                        </div>
                        <div
                          aria-label={`${isEnglish ? "Current consensus for" : "Consenso vigente de"} ${entry.label}`}
                          className="source-entry-consensus"
                        >
                          <span>
                            {isEnglish
                              ? "Current consensus"
                              : "Consenso vigente"}
                          </span>
                          <strong>
                            {entry.aggregateScore.toLocaleString(
                              localeTag(locale),
                              {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              },
                            )}
                          </strong>
                          <small>
                            #{entry.aggregatePosition} ·{" "}
                            {entry.aggregateCoverage}
                          </small>
                          <small className="source-entry-sources">
                            {isEnglish ? "Sources" : "Fuentes"}:{" "}
                            {entry.aggregateSources.map(
                              (aggregateSource, index) => (
                                <span key={aggregateSource.id}>
                                  {index ? ", " : ""}
                                  <Link
                                    href={localizedPath(
                                      `/fuentes/${aggregateSource.id}`,
                                      locale,
                                    )}
                                  >
                                    {aggregateSource.name}
                                  </Link>
                                </span>
                              ),
                            )}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <Link
                    className="text-link"
                    href={localizedPath(
                      `/temporadas/2027/${category.categorySlug}`,
                      locale,
                    )}
                  >
                    {isEnglish ? "View its effect on" : "Ver su efecto en"}{" "}
                    {localizedCategoryNameBySlug(
                      locale,
                      category.categorySlug,
                      category.categoryName,
                    )}
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <p className="insufficient-note">
              {isEnglish
                ? "This source has published critical observations, but it is not part of a current professional update."
                : "Esta fuente tiene observaciones críticas publicadas, pero no forma parte de una actualización profesional vigente."}
            </p>
          )}
        </div>

        <aside className="source-sidebar">
          <div className="sidebar-card source-health">
            <p className="section-index">
              {isEnglish ? "CURRENT STATUS" : "ESTADO ACTUAL"}
            </p>
            <dl>
              <div>
                <dt>{isEnglish ? "Technical status" : "Estado técnico"}</dt>
                <dd>{source.technicalStatus}</dd>
              </div>
              <div>
                <dt>{isEnglish ? "Publication" : "Publicación"}</dt>
                <dd>{source.publicationStatus}</dd>
              </div>
              <div>
                <dt>
                  {isEnglish
                    ? "Latest successful verification"
                    : "Última comprobación correcta"}
                </dt>
                <dd>{dateLabel(source.lastSuccessfulCheckAt, locale, true)}</dd>
              </div>
              {source.health === "failed" ? (
                <div>
                  <dt>
                    {isEnglish
                      ? "Most recent issue"
                      : "Incidencia más reciente"}
                  </dt>
                  <dd>{dateLabel(source.lastFailureAt, locale, true)}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="sidebar-card methodology-card">
            <p className="section-index">
              {isEnglish ? "THREE DATES" : "TRES FECHAS"}
            </p>
            <ul>
              <li>
                {isEnglish
                  ? "Publication: when the outlet published the list"
                  : "Publicación: cuándo el medio publicó la lista"}
              </li>
              <li>
                {isEnglish
                  ? "Change: when it changed the Runscars ranking"
                  : "Cambio: cuándo alteró el ranking de Runscars"}
              </li>
              <li>
                {isEnglish
                  ? "Verification: when the connector completed successfully"
                  : "Comprobación: cuándo el conector terminó correctamente"}
              </li>
            </ul>
            <Link href={localizedPath("/fuentes", locale)}>
              {isEnglish
                ? "Back to all sources →"
                : "Volver a todas las fuentes →"}
            </Link>
          </div>

          <div className="sidebar-card stale-card">
            <span
              className={`status-dot ${source.health === "failed" ? "amber" : "green"}`}
            />
            <div>
              <strong>
                {source.health === "ok"
                  ? isEnglish
                    ? "Verification successful"
                    : "Comprobación correcta"
                  : source.health === "failed"
                    ? isEnglish
                      ? "Recent issue"
                      : "Incidencia reciente"
                    : isEnglish
                      ? "No verifiable automation"
                      : "Sin automatización comprobable"}
              </strong>
              <p>
                {isEnglish
                  ? "This status is current, even when viewing a historical update."
                  : "Este estado es actual, incluso al consultar una actualización histórica."}
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
