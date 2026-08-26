import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  HISTORICAL_EDITIONS,
  historicalEdition,
} from "../../../lib/archive/historical";
import { localizedCategoryName } from "../../../lib/i18n/categories";
import { localeTag, localizedPath } from "../../../lib/i18n/config";
import { getRequestLocale } from "../../../lib/i18n/server";

type PageProps = { params: Promise<{ year: string }> };

export function generateStaticParams() {
  return HISTORICAL_EDITIONS.map((edition) => ({
    year: String(edition.ceremonyYear),
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const year = Number((await params).year);
  const edition = historicalEdition(year);
  const en = (await getRequestLocale()) === "en";
  return edition
    ? {
        title: `Oscar ${year} · ${en ? "Archive" : "Archivo"}`,
        description: en
          ? `Official nominees and winners of the ${year} Oscars.`
          : `Nominados y ganadores oficiales de los Oscar ${year}.`,
      }
    : {};
}

export default async function ArchiveEditionPage({ params }: PageProps) {
  const [{ year: yearParam }, locale] = await Promise.all([
    params,
    getRequestLocale(),
  ]);
  const year = Number(yearParam);
  const edition = historicalEdition(year);
  if (!edition) notFound();
  const en = locale === "en";

  return (
    <main className="page-shell archive-detail-page">
      <Link className="text-link" href={localizedPath("/archivo", locale)}>
        {en ? "← All five ceremonies" : "← Las cinco ceremonias"}
      </Link>
      <header className="archive-detail-hero">
        <div>
          <p className="section-index">
            {en ? "COMPLETED CEREMONY" : "CEREMONIA CERRADA"}
          </p>
          <h1>Oscar {edition.ceremonyYear}</h1>
        </div>
        <p>
          {en ? "Films from" : "Películas de"} {edition.eligibilityYear} ·{" "}
          {en ? "ceremony on" : "ceremonia del"}{" "}
          {new Intl.DateTimeFormat(localeTag(locale), {
            dateStyle: "long",
          }).format(new Date(`${edition.ceremonyOn}T12:00:00Z`))}
        </p>
      </header>
      <div className="archive-category-list">
        {edition.categories.map((category, categoryIndex) => (
          <section key={category.id} id={category.id}>
            <header>
              <span>{String(categoryIndex + 1).padStart(2, "0")}</span>
              <h2>
                {localizedCategoryName(locale, category.id, category.name)}
              </h2>
            </header>
            <ol>
              {[...category.nominees]
                .sort(
                  (left, right) => Number(right.winner) - Number(left.winner),
                )
                .map((nominee) => (
                  <li
                    className={nominee.winner ? "winner" : ""}
                    key={`${nominee.film}-${nominee.people.join("-")}`}
                  >
                    <span>
                      {nominee.winner
                        ? en
                          ? "WINNER"
                          : "GANADOR"
                        : en
                          ? "NOMINEE"
                          : "NOMINADO"}
                    </span>
                    <div>
                      <strong>
                        {nominee.people.length
                          ? nominee.people.join(", ")
                          : nominee.film}
                      </strong>
                      {nominee.people.length ? (
                        <small>{nominee.film}</small>
                      ) : null}
                    </div>
                  </li>
                ))}
            </ol>
          </section>
        ))}
      </div>
      <footer className="archive-source-note">
        <p>
          {en ? "Source" : "Fuente"}: {edition.sourceAuthor}.{" "}
          {en ? "Versioned capture on" : "Captura versionada el"}{" "}
          {new Intl.DateTimeFormat(localeTag(locale), {
            dateStyle: "long",
          }).format(new Date(edition.capturedAt))}
          .
        </p>
        <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
          {en ? "View official record ↗" : "Consultar registro oficial ↗"}
        </a>
      </footer>
    </main>
  );
}
