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
        ? "Sources, publications and latest updates."
        : "Fuentes, publicaciones y últimas actualizaciones.",
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
              <h1>{isEnglish ? "Sources" : "Las fuentes"}</h1>
              <p>
                {isEnglish
                  ? "Follow the latest update from each source."
                  : "Sigue la última actualización de cada fuente."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell sources-index-section">
        <div className="section-heading split-heading">
          <div>
            <p className="section-index">{isEnglish ? "SOURCES" : "FUENTES"}</p>
            <h2>
              {sources.length} {isEnglish ? "sources" : "fuentes"}
            </h2>
          </div>
          <p>
            {isEnglish
              ? "Only outlets included in a professional update or with a published critical observation are shown."
              : "Solo aparecen medios presentes en una actualización profesional o con una observación crítica publicada."}
          </p>
        </div>
        <div className="sources-index-grid">
          {sources.map((source) => {
            const latestUpdateAt =
              source.lastChangedAt ?? source.lastPublishedAt;
            return (
              <article className="source-index-card" key={source.id}>
                <h3>
                  <Link href={localizedPath(`/fuentes/${source.id}`, locale)}>
                    {source.name}
                  </Link>
                </h3>
                <p className="source-index-card-update">
                  <span>
                    {isEnglish ? "Latest update" : "Última actualización"}
                  </span>
                  <time dateTime={latestUpdateAt ?? undefined}>
                    {dateLabel(latestUpdateAt, locale)}
                  </time>
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
