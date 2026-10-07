import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPrecursorEdition,
  getPrecursorIndex,
} from "../../../../lib/precursors/data";
import type { PrecursorSetView } from "../../../../lib/precursors/types";
import {
  precursorCeremony,
  precursorDate,
  precursorKind,
  precursorName,
  precursorNominations,
} from "../../../../lib/precursors/presentation";
import type { Locale } from "../../../../lib/i18n/config";
import { localizedPath } from "../../../../lib/i18n/config";
import { getRequestLocale } from "../../../../lib/i18n/server";
import { buildLocalizedMetadata } from "../../../../lib/seo";
import styles from "../../awards.module.css";

type Props = { params: Promise<{ organization: string; year: string }> };

export async function generateStaticParams() {
  return (await getPrecursorIndex()).map((edition) => ({
    organization: edition.organizationId,
    year: String(edition.ceremonyYear),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ organization, year }, locale] = await Promise.all([
    params,
    getRequestLocale(),
  ]);
  const edition = await getPrecursorEdition(organization, Number(year));
  if (!edition)
    return {
      title: locale === "en" ? "Awards not found" : "Premios no encontrados",
    };
  return buildLocalizedMetadata({
    locale,
    path: `/premios/${organization}/${year}`,
    title: `${precursorName(edition, locale)} ${year}: ${locale === "en" ? "Official Dates and Winners" : "fechas y ganadores oficiales"}`,
    description:
      locale === "en"
        ? `Official dates and film results from ${precursorName(edition, locale)}, in the ${year} Oscar season.`
        : `Fechas y resultados oficiales de cine de ${precursorName(edition, locale)}, en la temporada Oscar ${year}.`,
  });
}

function Provenance({
  set,
  locale,
}: {
  set: PrecursorSetView;
  locale: Locale;
}) {
  const en = locale === "en";
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value));
  return (
    <details className={styles.provenance}>
      <summary>{en ? "Source and dates" : "Fuente y fechas"}</summary>
      <p>
        <a href={set.sourceUrl} target="_blank" rel="noreferrer">
          {set.sourceTitle} ↗
        </a>
      </p>
      {set.sourceAuthor ? <p>{set.sourceAuthor}</p> : null}
      {set.publishedAt ? (
        <p>
          {en ? "Published" : "Publicado"}:{" "}
          <time dateTime={set.publishedAt}>{date(set.publishedAt)}</time>
        </p>
      ) : null}
      <p>
        {en ? "Last consulted" : "Última consulta"}:{" "}
        <time dateTime={set.capturedAt}>{date(set.capturedAt)}</time>
      </p>
    </details>
  );
}

export default async function PrecursorEditionPage({ params }: Props) {
  const [{ organization, year }, locale] = await Promise.all([
    params,
    getRequestLocale(),
  ]);
  const edition = /^\d{4}$/.test(year)
    ? await getPrecursorEdition(organization, Number(year))
    : null;
  if (!edition) notFound();
  const en = locale === "en";
  const name = precursorName(edition, locale);
  const results = [edition.winners, edition.nominations].filter(
    (set): set is PrecursorSetView => Boolean(set),
  );
  const dateSource = edition.schedule ?? edition.winners ?? edition.nominations;
  const nominationDay = precursorNominations(edition);
  const today = new Date().toISOString().slice(0, 10);
  const futureNominations = nominationDay && today < nominationDay;
  return (
    <main>
      <section className={styles.hero}>
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href={localizedPath("/", locale)}>
              {en ? "Home" : "Inicio"}
            </Link>
            <span>/</span>
            <Link href={localizedPath("/premios", locale)}>
              {en ? "Awards" : "Premios"}
            </Link>
            <span>/</span>
            <span>{year}</span>
          </div>
          <p className="kicker">
            {precursorKind(edition.organizationKind, locale)} · OSCAR{" "}
            {edition.ceremonyYear}
            {edition.ceremonyYear === 2026
              ? en
                ? " · ARCHIVE"
                : " · ARCHIVO"
              : ""}
          </p>
          <h1>
            {name} <em>{year}</em>
          </h1>
          <p>
            {en
              ? `Edition ${edition.editionNumber ?? year}`
              : `Edición ${edition.editionNumber ?? year}`}{" "}
            · {precursorDate(precursorCeremony(edition), locale)}
          </p>
        </div>
      </section>
      <div className={`page-shell ${styles.layout}`}>
        <div>
          {results.map((set) => (
            <section id={set.kind} key={set.id}>
              <p className="section-index">
                {set.kind === "winners"
                  ? en
                    ? "OFFICIAL WINNERS"
                    : "GANADORES OFICIALES"
                  : en
                    ? "OFFICIAL NOMINATIONS"
                    : "NOMINACIONES OFICIALES"}
              </p>
              <h2>
                {set.kind === "winners"
                  ? en
                    ? "Film winners"
                    : "Ganadores de cine"
                  : en
                    ? "Film nominations"
                    : "Nominaciones de cine"}
              </h2>
              <p>{set.coverage[locale]}</p>
              <ul className={styles.results}>
                {set.entries.map((entry) => (
                  <li key={entry.id}>
                    <div>
                      <strong>{entry.originalCategory}</strong>
                      {entry.categoryRelation === "related" ? (
                        <small>
                          {en
                            ? "Related category; distinct from the Oscar category"
                            : "Categoría relacionada, distinta de la categoría Oscar"}
                        </small>
                      ) : null}
                    </div>
                    <div>
                      {entry.filmId ? (
                        <Link
                          prefetch={false}
                          href={localizedPath(
                            `/peliculas/${entry.filmId}`,
                            locale,
                          )}
                        >
                          <strong>{entry.originalTitle}</strong>
                        </Link>
                      ) : (
                        <strong>{entry.originalTitle}</strong>
                      )}
                      {entry.originalRecipient ? (
                        <span>{entry.originalRecipient}</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              <Provenance set={set} locale={locale} />
            </section>
          ))}
          {!results.length ? (
            <section className={styles.notice}>
              <h2>
                {futureNominations
                  ? en
                    ? "Nominations upcoming"
                    : "Nominaciones pendientes"
                  : en
                    ? "Follow the official announcements"
                    : "Sigue los anuncios oficiales"}
              </h2>
              <p>
                {futureNominations
                  ? en
                    ? `Nominations will be announced on ${precursorDate(nominationDay, locale)}.`
                    : `Las nominaciones se anunciarán el ${precursorDate(nominationDay, locale)}.`
                  : en
                    ? "Nominations and winners are not listed on Runscars yet. Consult the organisation’s official website for its announcements."
                    : "Las nominaciones y los ganadores aún no están disponibles en Runscars. Consulta los anuncios en la web oficial del organismo."}
              </p>
              {edition.schedule ? (
                <p>{edition.schedule.coverage[locale]}</p>
              ) : null}
              <a
                className="text-link"
                target="_blank"
                rel="noreferrer"
                href={dateSource?.sourceUrl ?? edition.homepageUrl}
              >
                {en ? "Official calendar" : "Calendario oficial"} ↗
              </a>
            </section>
          ) : null}
          {edition.schedule ? (
            <Provenance set={edition.schedule} locale={locale} />
          ) : null}
        </div>
        <aside className={styles.guide}>
          <p className="section-index">
            {en ? "AT A GLANCE" : "DE UN VISTAZO"}
          </p>
          <h2>{name}</h2>
          <dl className={styles.dates}>
            <div>
              <dt>{en ? "Ceremony" : "Ceremonia"}</dt>
              <dd>{precursorDate(precursorCeremony(edition), locale)}</dd>
            </div>
            <div>
              <dt>{en ? "Nominations" : "Nominaciones"}</dt>
              <dd>{precursorDate(nominationDay, locale)}</dd>
            </div>
            {edition.schedule?.milestones.map((milestone) => (
              <div key={`${milestone.name}:${milestone.date}`}>
                <dt>{milestone.name}</dt>
                <dd>{precursorDate(milestone.date, locale)}</dd>
              </div>
            ))}
          </dl>
          <p>{edition.notes[locale]}</p>
          <a
            className="text-link"
            target="_blank"
            rel="noreferrer"
            href={edition.homepageUrl}
          >
            {en ? "Official website" : "Web oficial"} ↗
          </a>
          <p>
            <Link
              prefetch={false}
              href={localizedPath(
                edition.ceremonyYear === 2027
                  ? "/temporadas/2027"
                  : "/archivo/2026",
                locale,
              )}
            >
              {en ? `Explore Oscar ${year}` : `Explorar los Oscar ${year}`} →
            </Link>
          </p>
          <Link
            className="text-link"
            prefetch={false}
            href={localizedPath("/premios", locale)}
          >
            ← {en ? "All awards" : "Todos los premios"}
          </Link>
        </aside>
      </div>
    </main>
  );
}
