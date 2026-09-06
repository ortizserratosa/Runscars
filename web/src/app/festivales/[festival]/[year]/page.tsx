import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getFestivalEdition,
  getFestivalIndex,
  type FestivalSetView,
} from "../../../../lib/festivals/data";
import { localizedPath } from "../../../../lib/i18n/config";
import type { Locale } from "../../../../lib/i18n/config";
import { getRequestLocale } from "../../../../lib/i18n/server";
import { absoluteUrl, buildLocalizedMetadata } from "../../../../lib/seo";
import { JsonLd } from "../../../components/JsonLd";

type PageProps = { params: Promise<{ festival: string; year: string }> };

export async function generateStaticParams() {
  return (await getFestivalIndex()).map((edition) => ({
    festival: edition.festivalId,
    year: String(edition.year),
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const [{ festival, year }, locale] = await Promise.all([
    params,
    getRequestLocale(),
  ]);
  const edition = await getFestivalEdition(festival, Number(year));
  if (!edition)
    return {
      title: locale === "en" ? "Festival not found" : "Festival no encontrado",
    };
  const name = locale === "en" ? edition.nameEn : edition.name;
  return buildLocalizedMetadata({
    locale,
    path: `/festivales/${festival}/${year}`,
    title: `${name} ${year}: ${locale === "en" ? "Official Selection and Awards" : "selección y palmarés oficial"}`,
    description:
      locale === "en"
        ? `Official 2026 selection and awards for ${name}, as context for the 2027 Oscar season.`
        : `Selección y palmarés oficial de ${name} 2026, como contexto de la temporada Oscar 2027.`,
  });
}

function SetSection({
  set,
  en,
  locale,
}: {
  set: FestivalSetView;
  en: boolean;
  locale: Locale;
}) {
  const title =
    set.kind === "selection"
      ? en
        ? "Official selection"
        : "Selección oficial"
      : en
        ? "Official awards"
        : "Palmarés oficial";
  return (
    <section className={`festival-set festival-set-${set.kind}`}>
      <header>
        <div>
          <p className="section-index">
            {set.kind === "selection" ? "SELECTION" : "AWARDS"} · V{set.version}
          </p>
          <h2>{title}</h2>
        </div>
        <a href={set.sourceUrl} target="_blank" rel="noreferrer">
          {en ? "Official source" : "Fuente oficial"} ↗
        </a>
      </header>
      <ol className="festival-entry-list">
        {set.entries.map((entry) => (
          <li key={entry.id}>
            <span className="festival-entry-order">
              {String(entry.order).padStart(2, "0")}
            </span>
            <div>
              <small>{entry.section}</small>
              <h3>
                {entry.filmId ? (
                  <Link
                    href={localizedPath(`/peliculas/${entry.filmId}`, locale)}
                  >
                    {entry.originalTitle}
                  </Link>
                ) : (
                  entry.originalTitle
                )}
              </h3>
              {entry.awardType ? <strong>{entry.awardType}</strong> : null}
              {entry.originalRecipient ? (
                <p>{entry.originalRecipient}</p>
              ) : null}
              {entry.matchStatus !== "matched" ? (
                <span className="festival-match-state">
                  {entry.matchStatus === "pending_review"
                    ? en
                      ? "Editorial review"
                      : "Revisión editorial"
                    : en
                      ? "Not yet linked to the catalogue"
                      : "Aún sin enlace al catálogo"}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <footer>
        {en ? "Captured" : "Capturado"}: {set.capturedAt.slice(0, 10)} ·{" "}
        {set.extractorVersion}
      </footer>
    </section>
  );
}

export default async function FestivalEditionPage({ params }: PageProps) {
  const [{ festival, year }, locale] = await Promise.all([
    params,
    getRequestLocale(),
  ]);
  const edition = await getFestivalEdition(festival, Number(year));
  if (!edition) notFound();
  const en = locale === "en";
  const name = en ? edition.nameEn : edition.name;
  const sets = [edition.selection, edition.awards].filter(
    (set): set is FestivalSetView => Boolean(set),
  );
  const pagePath = localizedPath(
    `/festivales/${edition.festivalId}/${edition.year}`,
    locale,
  );
  return (
    <main>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Event",
              name: `${name} ${edition.year}`,
              startDate: edition.startsOn,
              endDate: edition.endsOn,
              url: absoluteUrl(pagePath),
              sameAs: edition.officialUrl,
              eventStatus: "https://schema.org/EventScheduled",
            },
            ...sets.map((set) => ({
              "@type": "ItemList",
              name: set.sourceTitle,
              numberOfItems: set.entries.length,
              itemListElement: set.entries.map((entry) => ({
                "@type": "ListItem",
                position: entry.order,
                name: entry.originalTitle,
              })),
            })),
          ],
        }}
      />
      <section className="festival-detail-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href={localizedPath("/", locale)}>
              {en ? "Home" : "Inicio"}
            </Link>
            <span>/</span>
            <Link href={localizedPath("/festivales", locale)}>
              {en ? "Festivals" : "Festivales"}
            </Link>
            <span>/</span>
            <span>{edition.shortName}</span>
          </div>
          <p className="kicker">
            {edition.competitive
              ? en
                ? "Competitive festival"
                : "Festival competitivo"
              : en
                ? "Non-competitive selection"
                : "Selección no competitiva"}
          </p>
          <h1>
            {name} <em>{edition.year}</em>
          </h1>
          <p className="festival-deck">
            {edition.startsOn} — {edition.endsOn} ·{" "}
            {en
              ? "Official context; no consensus points"
              : "Contexto oficial; no suma puntos al consenso"}
          </p>
          <a
            className="ghost-button"
            href={edition.officialUrl}
            target="_blank"
            rel="noreferrer"
          >
            {en ? "Edition website" : "Web de la edición"} ↗
          </a>
        </div>
      </section>
      <div className="page-shell festival-detail-layout">
        {sets.length ? (
          sets.map((set) => (
            <SetSection key={set.id} set={set} en={en} locale={locale} />
          ))
        ) : (
          <section className="festival-empty-state">
            <h2>
              {en ? "Official data pending" : "Datos oficiales pendientes"}
            </h2>
            <p>
              {edition.awardsStatus === "not_applicable"
                ? en
                  ? "This festival does not publish a competitive awards list."
                  : "Este festival no publica un palmarés competitivo."
                : en
                  ? "The edition receipt is verified; the selection or awards set has not yet been published."
                  : "El recibo de la edición está verificado; la selección o el palmarés aún no se ha publicado."}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
