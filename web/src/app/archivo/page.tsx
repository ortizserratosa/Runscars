import type { Metadata } from "next";
import Link from "next/link";
import { HISTORICAL_EDITIONS } from "../../lib/archive/historical";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getRequestLocale()) === "en";
  return {
    title: en ? "Oscars archive 2022–2026" : "Archivo Oscar 2022–2026",
    description: en
      ? "Five previous ceremonies with official nominees and winners."
      : "Cinco ceremonias anteriores con nominados y ganadores oficiales.",
  };
}

export default async function ArchivePage() {
  const locale = await getRequestLocale();
  const en = locale === "en";
  return (
    <main className="page-shell archive-page">
      <header className="archive-hero">
        <p className="section-index">
          {en ? "OFFICIAL ARCHIVE" : "ARCHIVO OFICIAL"}
        </p>
        <h1>
          {en
            ? "Previous editions, all in one place."
            : "Las ediciones anteriores, en un solo sitio."}
        </h1>
        <p>
          {en
            ? "Nominees and winners confirmed by the Academy for all eight Runscars categories. We do not reconstruct predictions that were not captured at the time."
            : "Nominados y ganadores confirmados por la Academy para las ocho categorías de Runscars. No reconstruimos predicciones que no se capturaron entonces."}
        </p>
      </header>
      <section className="archive-edition-grid">
        {HISTORICAL_EDITIONS.map((edition) => {
          const bestPicture = edition.categories.find(
            (category) => category.id === "best-picture",
          );
          const winner = bestPicture?.nominees.find(
            (nominee) => nominee.winner,
          );
          return (
            <Link
              aria-label={`Oscar ${edition.ceremonyYear}: ${en ? "open nominees and winners" : "abrir nominados y ganadores"}`}
              href={localizedPath(`/archivo/${edition.ceremonyYear}`, locale)}
              key={edition.ceremonyYear}
            >
              <article>
                <span>{edition.ceremonyYear}</span>
                <p>
                  {en ? "Films from" : "Películas de"} {edition.eligibilityYear}
                </p>
                <h2>
                  {winner?.film ??
                    (en ? "Official ceremony" : "Ceremonia oficial")}
                </h2>
                <small>
                  {en
                    ? "Best Picture winner · View 8 categories →"
                    : "Ganadora de Mejor película · Ver 8 categorías →"}
                </small>
              </article>
            </Link>
          );
        })}
      </section>
      <aside className="archive-provenance">
        <strong>{en ? "Coverage:" : "Alcance:"}</strong> 2022–2026 · 8{" "}
        {en ? "categories" : "categorías"} · 40{" "}
        {en
          ? "winner results and every official nomination."
          : "resultados de ganador y todas sus candidaturas oficiales."}
      </aside>
    </main>
  );
}
