import type { Metadata } from "next";
import Link from "next/link";
import { localeTag, localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { getSourceIndex } from "../../lib/repositories/sources";
import { buildLocalizedMetadata } from "../../lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return buildLocalizedMetadata({
    locale,
    path: "/fuentes",
    title:
      locale === "en"
        ? "Oscar Sources: Experts and Official Awards"
        : "Fuentes Oscar: expertos y premios oficiales",
    description:
      locale === "en"
        ? "Explore Runscars’ prediction outlets, official award organisations and festivals, with original sources and dates."
        : "Consulta los medios de predicciones, organismos oficiales de premios y festivales de Runscars, con fuentes y fechas originales.",
  });
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
  const groups = [
    {
      id: "prediction",
      es: "Predicciones",
      en: "Predictions",
      sources: sources.filter((source) =>
        source.sourceTypes.includes("prediction"),
      ),
    },
    {
      id: "market",
      es: "Mercados",
      en: "Markets",
      sources: sources.filter((source) =>
        source.sourceTypes.includes("market"),
      ),
    },
    {
      id: "reception",
      es: "Metadatos y recepción",
      en: "Metadata and reception",
      sources: sources.filter(
        (source) =>
          !source.sourceTypes.includes("prediction") &&
          source.sourceTypes.some((type) =>
            ["metadata", "review", "score"].includes(type),
          ),
      ),
    },
    {
      id: "academy",
      es: "Fuentes oficiales",
      en: "Official sources",
      sources: sources.filter((source) =>
        source.sourceTypes.includes("official"),
      ),
    },
    {
      id: "festival",
      es: "Festivales",
      en: "Festivals",
      sources: sources.filter((source) =>
        source.sourceTypes.includes("festival"),
      ),
    },
  ].filter((group) => group.sources.length);
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
              ? "Original sources for predictions, film metadata, markets, festivals and official awards."
              : "Fuentes originales de predicciones, metadatos cinematográficos, mercados, festivales y premios oficiales."}
          </p>
        </div>
        <div className="source-groups">
          {groups.map((group) => (
            <section key={group.id}>
              <header>
                <p className="section-index">{group.id.toUpperCase()}</p>
                <h3>{isEnglish ? group.en : group.es}</h3>
              </header>
              <div className="sources-index-grid">
                {group.sources.map((source) => {
                  const latestUpdateAt =
                    source.lastCapturedAt ??
                    source.lastChangedAt ??
                    source.lastPublishedAt ??
                    source.lastSuccessfulCheckAt;
                  return (
                    <article className="source-index-card" key={source.id}>
                      <h3>
                        <Link
                          href={localizedPath(`/fuentes/${source.id}`, locale)}
                        >
                          {source.name}
                        </Link>
                      </h3>
                      <p className="source-index-card-update">
                        <span>
                          {source.lastCapturedAt
                            ? isEnglish
                              ? "Last consulted"
                              : "Última consulta"
                            : isEnglish
                              ? "Latest update"
                              : "Última actualización"}
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
          ))}
        </div>
      </section>
    </main>
  );
}
