import type { Metadata } from "next";
import Link from "next/link";
import { getFestivalIndex } from "../../lib/festivals/data";
import { localeTag, localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { absoluteUrl, buildLocalizedMetadata } from "../../lib/seo";
import { JsonLd } from "../components/JsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return buildLocalizedMetadata({
    locale,
    path: "/festivales",
    title:
      locale === "en"
        ? "2026 International Film Festival Circuit"
        : "Circuito internacional de festivales de cine 2026",
    description:
      locale === "en"
        ? "Official selections and awards from nine international film festivals in the 2027 Oscar season, kept outside the prediction consensus."
        : "Selecciones y palmarés oficiales de nueve festivales internacionales en la temporada Oscar 2027, separados del consenso de predicciones.",
  });
}

const statusLabel = {
  es: { scheduled: "Programada", ongoing: "En curso", completed: "Finalizada" },
  en: { scheduled: "Scheduled", ongoing: "Ongoing", completed: "Completed" },
} as const;

const awardsLabel = {
  es: {
    pending: "Palmarés pendiente",
    published: "Palmarés publicado",
    not_applicable: "Palmarés no aplicable",
  },
  en: {
    pending: "Awards pending",
    published: "Awards published",
    not_applicable: "Awards not applicable",
  },
} as const;

export default async function FestivalsPage() {
  const [locale, editions] = await Promise.all([
    getRequestLocale(),
    getFestivalIndex(),
  ]);
  const en = locale === "en";
  const pagePath = localizedPath("/festivales", locale);
  return (
    <main>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          url: absoluteUrl(pagePath),
          name: en
            ? "2026 International Film Festival Circuit"
            : "Circuito internacional de festivales de cine 2026",
          inLanguage: localeTag(locale),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: editions.length,
            itemListElement: editions.map((edition, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: absoluteUrl(
                localizedPath(
                  `/festivales/${edition.festivalId}/${edition.year}`,
                  locale,
                ),
              ),
              item: {
                "@type": "Event",
                name: en ? edition.nameEn : edition.name,
                startDate: edition.startsOn,
                endDate: edition.endsOn,
                eventStatus: "https://schema.org/EventScheduled",
              },
            })),
          },
        }}
      />
      <section className="festival-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href={localizedPath("/", locale)}>
              {en ? "Home" : "Inicio"}
            </Link>
            <span>/</span>
            <span>{en ? "Festivals" : "Festivales"}</span>
          </div>
          <p className="kicker">
            {en ? "Official context" : "Contexto oficial"}
          </p>
          <h1>{en ? "The festival circuit" : "El circuito festivalero"}</h1>
          <p className="festival-deck">
            {en
              ? "Nine 2026 editions on the road to the 2027 Oscars. Their selections and awards provide context only: they never add consensus points."
              : "Nueve ediciones de 2026 en el camino a los Oscar 2027. Sus selecciones y premios solo aportan contexto: nunca suman puntos al consenso."}
          </p>
        </div>
      </section>
      <section className="page-shell festival-index-section">
        <div className="festival-grid">
          {editions.map((edition) => (
            <article className="festival-card" key={edition.id}>
              <div className="festival-card-top">
                <span className={`festival-state ${edition.status}`}>
                  {statusLabel[locale][edition.status]}
                </span>
                <span>{edition.year}</span>
              </div>
              <h2>
                <Link
                  href={localizedPath(
                    `/festivales/${edition.festivalId}/${edition.year}`,
                    locale,
                  )}
                >
                  {en ? edition.nameEn : edition.name}
                </Link>
              </h2>
              <p>{awardsLabel[locale][edition.awardsStatus]}</p>
              <dl>
                <div>
                  <dt>{en ? "Selection" : "Selección"}</dt>
                  <dd>{edition.selection?.entries.length ?? "—"}</dd>
                </div>
                <div>
                  <dt>{en ? "Awards" : "Premios"}</dt>
                  <dd>{edition.awards?.entries.length ?? "—"}</dd>
                </div>
              </dl>
              <Link
                className="festival-card-link"
                href={localizedPath(
                  `/festivales/${edition.festivalId}/${edition.year}`,
                  locale,
                )}
              >
                {en ? "Open edition" : "Abrir edición"} →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
