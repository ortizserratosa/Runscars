import type { Metadata } from "next";
import Link from "next/link";
import { getFestivalIndex } from "../../lib/festivals/data";
import {
  festivalDateRange,
  festivalName,
  festivalPreview,
  festivalStatus,
} from "../../lib/festivals/presentation";
import { localeTag, localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { absoluteUrl, buildLocalizedMetadata } from "../../lib/seo";
import { getFilmArtwork } from "../../lib/repositories/artwork";
import { PosterBlock } from "../components/PosterBlock";
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
        ? "Official selections and awards from nine international film festivals in the 2027 Oscar season, with dates, films and winners to explore."
        : "Selecciones y palmarés oficiales de nueve festivales internacionales en la temporada Oscar 2027, con fechas, películas y ganadores por descubrir.",
  });
}

export default async function FestivalsPage() {
  const [locale, editions] = await Promise.all([
    getRequestLocale(),
    getFestivalIndex(),
  ]);
  const en = locale === "en";
  const artwork = await getFilmArtwork(
    editions.flatMap((edition) =>
      festivalPreview(edition).entries.map((entry) => entry.filmId),
    ),
    locale,
  );
  const chronological = [...editions].sort((a, b) =>
    a.startsOn.localeCompare(b.startsOn),
  );
  const featured =
    chronological.find((edition) => edition.status === "ongoing") ??
    chronological.find((edition) => edition.status === "scheduled") ??
    chronological.at(-1);
  const editionPath = (edition: (typeof editions)[number]) =>
    localizedPath(`/festivales/${edition.festivalId}/${edition.year}`, locale);
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
          <div className="festival-hero-grid">
            <div>
              <p className="kicker">
                {en
                  ? "THE 2026 FILM CALENDAR"
                  : "EL CALENDARIO DE CINE DE 2026"}
              </p>
              <h1>
                {en ? "The festival" : "El circuito"}
                <br />
                <em>{en ? "circuit." : "festivalero."}</em>
              </h1>
              <p className="festival-deck">
                {en
                  ? "Discover the films, follow the premieres and explore the winners. Nine stops on the road to the Oscars."
                  : "Descubre películas, sigue los estrenos y explora el palmarés. Nueve paradas en el camino a los Oscar."}
              </p>
              <a className="primary-button dark-button" href="#calendar">
                {en ? "Explore the calendar" : "Explorar el calendario"} ↓
              </a>
            </div>
            {featured ? (
              <aside className="festival-spotlight">
                <div className="festival-card-top">
                  <span className={`festival-state ${featured.status}`}>
                    {festivalStatus[locale][featured.status]}
                  </span>
                  <span>{featured.year}</span>
                </div>
                <span className="festival-spotlight-mark" aria-hidden="true">
                  ✳
                </span>
                <h2>{festivalName(featured, locale)}</h2>
                <p>
                  {festivalDateRange(
                    featured.startsOn,
                    featured.endsOn,
                    locale,
                  )}
                </p>
                <Link
                  prefetch={false}
                  className="festival-card-link"
                  href={editionPath(featured)}
                >
                  {en ? "Explore this festival" : "Descubrir este festival"} ↗
                </Link>
              </aside>
            ) : null}
          </div>
        </div>
      </section>
      <section className="page-shell festival-index-section" id="calendar">
        <div className="festival-section-heading">
          <div>
            <p className="section-index">
              2026 · {en ? "JANUARY — OCTOBER" : "ENERO — OCTUBRE"}
            </p>
            <h2>{en ? "A year in film." : "Un año de cine."}</h2>
          </div>
          <p>
            {en
              ? "Selections, awards and your next discovery."
              : "Selecciones, premios y tu próximo descubrimiento."}
          </p>
        </div>
        <nav
          className="festival-calendar"
          aria-label={en ? "Jump to a festival" : "Ir a un festival"}
        >
          {chronological.map((edition) => (
            <a key={edition.id} href={`#${edition.festivalId}`}>
              <span>
                {new Intl.DateTimeFormat(locale, {
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                }).format(new Date(`${edition.startsOn}T12:00:00Z`))}
              </span>
              <strong>{festivalName(edition, locale)}</strong>
            </a>
          ))}
        </nav>
        <div className="festival-grid">
          {chronological.map((edition) => {
            const preview = festivalPreview(edition);
            return (
              <article
                className={`festival-card festival-card-${edition.status}`}
                key={edition.id}
                id={edition.festivalId}
              >
                <div className="festival-card-top">
                  <span className={`festival-state ${edition.status}`}>
                    {festivalStatus[locale][edition.status]}
                  </span>
                  <span>{edition.year}</span>
                </div>
                <h2>
                  <Link prefetch={false} href={editionPath(edition)}>
                    {festivalName(edition, locale)}
                  </Link>
                </h2>
                <p className="festival-card-dates">
                  {festivalDateRange(edition.startsOn, edition.endsOn, locale)}
                </p>
                <div className="festival-card-preview">
                  <p className="section-index">
                    {preview.kind === "awards"
                      ? en
                        ? "FROM THE WINNERS"
                        : "DEL PALMARÉS"
                      : en
                        ? "ON THE PROGRAMME"
                        : "EN EL PROGRAMA"}
                  </p>
                  {preview.entries.length ? (
                    <ul>
                      {preview.entries.map((entry) => (
                        <li key={entry.id}>
                          {entry.filmId && artwork[entry.filmId]?.posterPath ? (
                            <Link
                              className="festival-preview-poster"
                              prefetch={false}
                              href={localizedPath(
                                `/peliculas/${entry.filmId}`,
                                locale,
                              )}
                              aria-label={entry.originalTitle}
                            >
                              <PosterBlock
                                title={entry.originalTitle}
                                locale={locale}
                                size="small"
                                imagePath={artwork[entry.filmId].posterPath}
                              />
                            </Link>
                          ) : null}
                          <strong>{entry.originalTitle}</strong>
                          <span>
                            {entry.awardType ??
                              entry.originalRecipient ??
                              entry.section}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      {en
                        ? "Explore the festival’s programme on its official website."
                        : "Consulta el programa del festival en su web oficial."}
                    </p>
                  )}
                </div>
                <div className="festival-card-bottom">
                  {!edition.competitive ? (
                    <small>{en ? "Non-competitive" : "No competitivo"}</small>
                  ) : null}
                  <Link
                    prefetch={false}
                    className="festival-card-link"
                    href={editionPath(edition)}
                  >
                    {en ? "Explore festival" : "Explorar festival"} ↗
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
        <div className="festival-next-step">
          <div>
            <p className="section-index">OSCAR 2027</p>
            <h2>
              {en
                ? "Who will go all the way?"
                : "¿Quién llegará hasta el final?"}
            </h2>
          </div>
          <Link
            prefetch={false}
            className="primary-button dark-button"
            href={localizedPath("/temporadas/2027/mejor-pelicula", locale)}
          >
            {en ? "See the Oscar predictions" : "Ver las predicciones Oscar"} →
          </Link>
        </div>
      </section>
    </main>
  );
}
