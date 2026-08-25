import type { Metadata } from "next";
import Link from "next/link";
import { HISTORICAL_EDITIONS } from "../../lib/archive/historical";

export const metadata: Metadata = {
  title: "Archivo Oscar 2022–2026",
  description:
    "Cinco ceremonias anteriores con nominados y ganadores oficiales.",
};

export default function ArchivePage() {
  return (
    <main className="page-shell archive-page">
      <header className="archive-hero">
        <p className="section-index">ARCHIVO OFICIAL</p>
        <h1>Las ediciones anteriores, en un solo sitio.</h1>
        <p>
          Nominados y ganadores confirmados por la Academy para las ocho
          categorías de Runscars. No reconstruimos predicciones que no se
          capturaron entonces.
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
              aria-label={`Oscar ${edition.ceremonyYear}: abrir nominados y ganadores`}
              href={`/archivo/${edition.ceremonyYear}`}
              key={edition.ceremonyYear}
            >
              <article>
                <span>{edition.ceremonyYear}</span>
                <p>Películas de {edition.eligibilityYear}</p>
                <h2>{winner?.film ?? "Ceremonia oficial"}</h2>
                <small>Ganadora de Mejor película · Ver 8 categorías →</small>
              </article>
            </Link>
          );
        })}
      </section>
      <aside className="archive-provenance">
        <strong>Alcance:</strong> 2022–2026 · 8 categorías · 40 resultados de
        ganador y todas sus candidaturas oficiales.
      </aside>
    </main>
  );
}
