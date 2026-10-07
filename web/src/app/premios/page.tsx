import type { Metadata } from "next";
import Link from "next/link";
import { getPrecursorIndex } from "../../lib/precursors/data";
import {
  precursorAvailability,
  precursorCeremony,
  precursorDate,
  precursorKind,
  precursorName,
  precursorNominations,
} from "../../lib/precursors/presentation";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { buildLocalizedMetadata } from "../../lib/seo";
import styles from "./awards.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return buildLocalizedMetadata({
    locale,
    path: "/premios",
    title:
      locale === "en"
        ? "Guild and Critics Awards on the Road to Oscar 2027"
        : "Premios de sindicatos y críticos rumbo a los Oscar 2027",
    description:
      locale === "en"
        ? "Official Actor Awards, DGA, PGA, WGA, Critics Choice and BAFTA calendars, plus selected 2026 film winners."
        : "Calendarios oficiales de Actor Awards, DGA, PGA, WGA, Critics Choice y BAFTA, y un archivo de ganadores de cine de 2026.",
  });
}

export default async function PrecursorsPage() {
  const [locale, editions] = await Promise.all([
    getRequestLocale(),
    getPrecursorIndex(),
  ]);
  const en = locale === "en";
  const today = new Date().toISOString().slice(0, 10);
  const active = editions
    .filter((edition) => edition.seasonId === "oscars-2027")
    .sort((a, b) =>
      (precursorCeremony(a) ?? "9999").localeCompare(
        precursorCeremony(b) ?? "9999",
      ),
    );
  const archive = editions.filter(
    (edition) => edition.seasonId === "oscars-2026",
  );
  return (
    <main>
      <section className={styles.hero}>
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href={localizedPath("/", locale)}>
              {en ? "Home" : "Inicio"}
            </Link>
            <span>/</span>
            <span>{en ? "Awards" : "Premios"}</span>
          </div>
          <p className="kicker">
            {en
              ? "OSCAR 2027 · THE AWARDS CALENDAR"
              : "OSCAR 2027 · EL CALENDARIO DE PREMIOS"}
          </p>
          <h1>
            {en ? "Before the" : "Antes de los"} <em>Oscar.</em>
          </h1>
          <p>
            {en
              ? "Follow the guilds, the critics and BAFTA. Official dates, nominations and winners from the organisations that shape the awards season."
              : "Sigue a los sindicatos, los críticos y BAFTA. Fechas, nominaciones y ganadores oficiales de los organismos que acompañan la temporada de premios."}
          </p>
        </div>
      </section>
      <section
        className={`page-shell ${styles.section}`}
        aria-labelledby="precursor-calendar"
      >
        <p className="section-index">
          {en
            ? "2027 CEREMONIES · 2026 FILM SEASON"
            : "CEREMONIAS 2027 · TEMPORADA DE CINE 2026"}
        </p>
        <h2 id="precursor-calendar">
          {en ? "The next announcements" : "Los próximos anuncios"}
        </h2>
        <div className={styles.grid}>
          {active.map((edition) => (
            <article
              className={`${styles.card} precursor-card`}
              key={edition.id}
            >
              <span className={styles.tag}>
                {precursorKind(edition.organizationKind, locale)} ·{" "}
                {precursorAvailability(edition, today, locale)}
              </span>
              <h2>
                <Link
                  prefetch={false}
                  href={localizedPath(
                    `/premios/${edition.organizationId}/${edition.ceremonyYear}`,
                    locale,
                  )}
                >
                  {precursorName(edition, locale)}
                </Link>
              </h2>
              <dl className={styles.dates}>
                <div>
                  <dt>{en ? "Nominations" : "Nominaciones"}</dt>
                  <dd>
                    {precursorDate(precursorNominations(edition), locale)}
                  </dd>
                </div>
                <div>
                  <dt>{en ? "Ceremony" : "Ceremonia"}</dt>
                  <dd>{precursorDate(precursorCeremony(edition), locale)}</dd>
                </div>
              </dl>
              <Link
                prefetch={false}
                className={styles.cardLink}
                href={localizedPath(
                  `/premios/${edition.organizationId}/${edition.ceremonyYear}`,
                  locale,
                )}
              >
                {en ? "Explore awards" : "Explorar premios"} ↗
              </Link>
            </article>
          ))}
        </div>
      </section>
      {archive.length ? (
        <section
          className={`page-shell ${styles.section}`}
          aria-labelledby="precursor-archive"
        >
          <p className="section-index">OSCAR 2026</p>
          <h2 id="precursor-archive">
            {en
              ? "Winners from the previous season"
              : "Ganadores de la temporada anterior"}
          </h2>
          <p>
            {en
              ? "A partial archive of film winners related to Runscars’ eight public categories. These results belong to the 2026 Oscar season."
              : "Archivo parcial de ganadores de cine relacionados con las ocho categorías públicas de Runscars. Estos resultados corresponden a la temporada Oscar 2026."}
          </p>
          <nav
            className={styles.archive}
            aria-label={en ? "2026 award winners" : "Ganadores de premios 2026"}
          >
            {archive.map((edition) => (
              <Link
                key={edition.id}
                prefetch={false}
                href={localizedPath(
                  `/premios/${edition.organizationId}/${edition.ceremonyYear}`,
                  locale,
                )}
              >
                {precursorName(edition, locale)} · 2026 ↗
              </Link>
            ))}
          </nav>
        </section>
      ) : null}
    </main>
  );
}
