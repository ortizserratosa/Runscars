import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  HISTORICAL_EDITIONS,
  historicalEdition,
} from "../../../lib/archive/historical";

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
  return edition
    ? {
        title: `Oscar ${year} · Archivo`,
        description: `Nominados y ganadores oficiales de los Oscar ${year}.`,
      }
    : {};
}

export default async function ArchiveEditionPage({ params }: PageProps) {
  const year = Number((await params).year);
  const edition = historicalEdition(year);
  if (!edition) notFound();

  return (
    <main className="page-shell archive-detail-page">
      <Link className="text-link" href="/archivo">
        ← Las cinco ceremonias
      </Link>
      <header className="archive-detail-hero">
        <div>
          <p className="section-index">CEREMONIA CERRADA</p>
          <h1>Oscar {edition.ceremonyYear}</h1>
        </div>
        <p>
          Películas de {edition.eligibilityYear} · ceremonia del{" "}
          {new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(
            new Date(`${edition.ceremonyOn}T12:00:00Z`),
          )}
        </p>
      </header>
      <div className="archive-category-list">
        {edition.categories.map((category, categoryIndex) => (
          <section key={category.id} id={category.id}>
            <header>
              <span>{String(categoryIndex + 1).padStart(2, "0")}</span>
              <h2>{category.name}</h2>
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
                    <span>{nominee.winner ? "GANADOR" : "NOMINADO"}</span>
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
          Fuente: {edition.sourceAuthor}. Captura versionada el{" "}
          {new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(
            new Date(edition.capturedAt),
          )}
          .
        </p>
        <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
          Consultar registro oficial ↗
        </a>
      </footer>
    </main>
  );
}
