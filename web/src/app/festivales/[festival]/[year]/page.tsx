import { FestivalEntries } from "../../FestivalEntries";
import {
  festivalDateRange,
  festivalName,
  festivalStatus,
} from "../../../../lib/festivals/presentation";
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
import {
  getFilmArtwork,
  type FilmArtwork,
} from "../../../../lib/repositories/artwork";
import { ShareButton } from "../../../components/ShareButton";
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
    socialImage: `/api/social?kind=festival&id=${festival}&lang=${locale}`,
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
  artwork,
  en,
  locale,
}: {
  set: FestivalSetView;
  artwork: Record<string, FilmArtwork>;
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
    <section id={set.kind} className={`festival-set festival-set-${set.kind}`}>
      <header>
        <div>
          <p className="section-index">
            {set.kind === "selection"
              ? en
                ? "THE FILMS"
                : "LAS PELÍCULAS"
              : en
                ? "THE WINNERS"
                : "LOS PREMIADOS"}
          </p>
          <h2>{title}</h2>
        </div>
        <a href={set.sourceUrl} target="_blank" rel="noreferrer">
          {en ? "Official source" : "Fuente oficial"} ↗
        </a>
      </header>
      <FestivalEntries set={set} locale={locale} artwork={artwork} />
      <details className="festival-provenance">
        <summary>{en ? "Source and dates" : "Fuente y fechas"}</summary>
        <p>
          <a href={set.sourceUrl} target="_blank" rel="noreferrer">
            {set.sourceTitle} ↗
          </a>
        </p>
        {set.publishedAt ? (
          <p>
            {en ? "Published" : "Publicado"}:{" "}
            <time dateTime={set.publishedAt}>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeZone: "UTC",
              }).format(new Date(set.publishedAt))}
            </time>
          </p>
        ) : null}
        <p>
          {en ? "Last consulted" : "Última consulta"}:{" "}
          <time dateTime={set.capturedAt}>
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeZone: "UTC",
            }).format(new Date(set.capturedAt))}
          </time>
        </p>
      </details>
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
  const sets = [edition.awards, edition.selection].filter(
    (set): set is FestivalSetView => Boolean(set),
  );
  const artwork = await getFilmArtwork(
    sets.flatMap((set) => set.entries.map((entry) => entry.filmId)),
    locale,
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
            {festivalStatus[locale][edition.status]} ·{" "}
            {edition.competitive
              ? en
                ? "Competitive festival"
                : "Festival competitivo"
              : en
                ? "Non-competitive selection"
                : "Selección no competitiva"}
          </p>
          <h1>
            {festivalName(edition, locale)} <em>{edition.year}</em>
          </h1>
          <p className="festival-deck">
            {name} ·{" "}
            {festivalDateRange(edition.startsOn, edition.endsOn, locale)}
          </p>
          <nav
            className="festival-detail-nav"
            aria-label={en ? "Festival sections" : "Secciones del festival"}
          >
            {sets.map((set) => (
              <a key={set.id} href={`#${set.kind}`} className="ghost-button">
                {set.kind === "awards"
                  ? en
                    ? "Awards"
                    : "Palmarés"
                  : en
                    ? "Selection"
                    : "Selección"}{" "}
                <span>{set.entries.length}</span> ↓
              </a>
            ))}
            <a
              className="ghost-button"
              href={edition.selection?.sourceUrl ?? edition.selectionUrl}
              target="_blank"
              rel="noreferrer"
            >
              {en ? "Official programme" : "Programa oficial"} ↗
            </a>
          </nav>
          <ShareButton
            title={`${name} ${year}`}
            text={
              en
                ? "Discover the films and winners."
                : "Descubre las películas y el palmarés."
            }
            url={pagePath}
            locale={locale}
            label={en ? "Share festival ↗" : "Compartir festival ↗"}
          />
        </div>
      </section>
      <div className="page-shell festival-detail-layout">
        <div className="festival-detail-main">
          {sets.map((set) => (
            <SetSection
              key={set.id}
              set={set}
              artwork={artwork}
              en={en}
              locale={locale}
            />
          ))}
          {!edition.selection?.entries.length ? (
            <section className="festival-empty-state">
              <p className="section-index">
                {en ? "THE PROGRAMME" : "EL PROGRAMA"}
              </p>
              <h2>
                {en ? "More films to discover" : "Más cine por descubrir"}
              </h2>
              <p>
                {en
                  ? "The selection is not listed on Runscars yet. You can browse the programme on the festival’s website."
                  : "La selección aún no está disponible en Runscars. Puedes consultar el programa en la web del festival."}
              </p>
              <a
                className="primary-button dark-button"
                href={edition.selection?.sourceUrl ?? edition.selectionUrl}
                target="_blank"
                rel="noreferrer"
              >
                {en
                  ? "Browse the official programme"
                  : "Consultar el programa oficial"}{" "}
                ↗
              </a>
            </section>
          ) : null}
          {edition.competitive && !edition.awards?.entries.length ? (
            <section className="festival-empty-state festival-awards-notice">
              <h2>{en ? "Awards" : "Palmarés"}</h2>
              <p>
                {edition.awardsStatus === "published"
                  ? en
                    ? "Browse the winners on the festival’s website."
                    : "Consulta los ganadores en la web del festival."
                  : en
                    ? "The awards are not listed on Runscars yet."
                    : "El palmarés aún no está disponible en Runscars."}
              </p>
              {edition.awardsUrl ? (
                <a
                  className="text-link"
                  href={edition.awardsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {en ? "Official awards page" : "Página oficial de premios"} ↗
                </a>
              ) : null}
            </section>
          ) : null}
        </div>
        <aside className="festival-guide">
          <p className="section-index">
            {en ? "AT A GLANCE" : "DE UN VISTAZO"}
          </p>
          <h2>{festivalName(edition, locale)}</h2>
          <dl>
            <div>
              <dt>{en ? "Dates" : "Fechas"}</dt>
              <dd>
                {festivalDateRange(edition.startsOn, edition.endsOn, locale)}{" "}
                {edition.year}
              </dd>
            </div>
            <div>
              <dt>{en ? "Format" : "Formato"}</dt>
              <dd>
                {edition.competitive
                  ? en
                    ? "Competitive festival"
                    : "Festival competitivo"
                  : en
                    ? "Non-competitive festival"
                    : "Festival no competitivo"}
              </dd>
            </div>
          </dl>
          <a
            className="text-link"
            href={edition.officialUrl}
            target="_blank"
            rel="noreferrer"
          >
            {en ? "Festival website" : "Web del festival"} ↗
          </a>
          <div className="festival-guide-next">
            <p>
              {en
                ? "Follow the films beyond the festival."
                : "Sigue a las películas más allá del festival."}
            </p>
            <Link
              prefetch={false}
              href={localizedPath("/temporadas/2027", locale)}
            >
              {en ? "Explore Oscar 2027" : "Explorar los Oscar 2027"} →
            </Link>
          </div>
          <Link
            prefetch={false}
            className="text-link"
            href={localizedPath("/festivales", locale)}
          >
            ← {en ? "All festivals" : "Todos los festivales"}
          </Link>
        </aside>
      </div>
    </main>
  );
}
