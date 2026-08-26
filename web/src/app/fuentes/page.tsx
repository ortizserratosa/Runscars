import type { Metadata } from "next";
import Link from "next/link";
import { localeTag, localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { getSourceIndex } from "../../lib/repositories/sources";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: locale === "en" ? "Sources" : "Fuentes",
    description:
      locale === "en"
        ? "Active sources, publications and verification status."
        : "Fuentes activas, publicaciones y estado de comprobación.",
  };
}

function dateLabel(value: string | null, locale: "es" | "en") {
  if (!value) return locale === "en" ? "No data yet" : "Sin dato todavía";
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function SourcesPage() {
  const locale = await getRequestLocale();
  const isEnglish = locale === "en";
  const sources = await getSourceIndex();
  return (
    <main>
      <section className="source-hero sources-index-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href={localizedPath("/", locale)}>
              {isEnglish ? "Home" : "Inicio"}
            </Link>
            <span>/</span>
            <span>{isEnglish ? "Sources" : "Fuentes"}</span>
          </div>
          <div className="source-title-row">
            <div>
              <p className="kicker">
                {isEnglish ? "Public provenance" : "Procedencia pública"}
              </p>
              <h1>
                {isEnglish ? "Sources, " : "Las fuentes, "}
                <em>{isEnglish ? "with status." : "con estado."}</em>
              </h1>
              <p>
                {isEnglish
                  ? "Publication, latest effective change and technical verification are different dates. You can review each one here."
                  : "Publicación, último cambio efectivo y comprobación técnica son fechas distintas. Aquí puedes revisar cada una."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell sources-index-section">
        <div className="section-heading split-heading">
          <div>
            <p className="section-index">
              {isEnglish
                ? "SOURCES WITH PUBLISHED DATA"
                : "FUENTES CON DATOS PUBLICADOS"}
            </p>
            <h2>
              {sources.length}{" "}
              {isEnglish ? "active sources" : "fuentes activas"}
            </h2>
          </div>
          <p>
            {isEnglish
              ? "Only outlets included in a professional update or with a published critical observation are shown."
              : "Solo aparecen medios presentes en una actualización profesional o con una observación crítica publicada."}
          </p>
        </div>
        <div className="sources-index-grid">
          {sources.map((source) => (
            <Link
              className="source-index-card"
              href={localizedPath(`/fuentes/${source.id}`, locale)}
              key={source.id}
            >
              <div className="source-index-card-heading">
                <span className="source-logo-block" aria-hidden="true">
                  {source.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <span className={`source-health-chip ${source.health}`}>
                  {source.health === "ok"
                    ? isEnglish
                      ? "Verification successful"
                      : "Comprobación correcta"
                    : source.health === "failed"
                      ? isEnglish
                        ? "Recent issue"
                        : "Incidencia reciente"
                      : isEnglish
                        ? "No automated verification"
                        : "Sin comprobación automática"}
                </span>
              </div>
              <h3>{source.name}</h3>
              <p>
                {source.activeCategoryCount}{" "}
                {isEnglish
                  ? "active professional categories"
                  : "categorías profesionales activas"}
              </p>
              <dl>
                <div>
                  <dt>{isEnglish ? "Latest change" : "Último cambio"}</dt>
                  <dd>{dateLabel(source.lastChangedAt, locale)}</dd>
                </div>
                <div>
                  <dt>
                    {isEnglish ? "Latest publication" : "Última publicación"}
                  </dt>
                  <dd>{dateLabel(source.lastPublishedAt, locale)}</dd>
                </div>
                <div>
                  <dt>
                    {isEnglish ? "Latest verification" : "Última comprobación"}
                  </dt>
                  <dd>{dateLabel(source.lastSuccessfulCheckAt, locale)}</dd>
                </div>
              </dl>
              <strong>
                {isEnglish ? "View provenance →" : "Ver procedencia →"}
              </strong>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
