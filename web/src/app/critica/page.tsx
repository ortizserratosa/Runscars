import type { Metadata } from "next";
import Link from "next/link";
import { groupCriticalAggregatorHighlights } from "../../lib/critical/aggregators";
import { getCriticalReceptionRanking } from "../../lib/repositories/signals";

export const metadata: Metadata = {
  title: "Agregadores",
  description:
    "Las películas que destacan los principales agregadores de crítica.",
};

export const dynamic = "force-dynamic";

export default async function CriticalReceptionPage() {
  const ranking = await getCriticalReceptionRanking();
  const aggregators = groupCriticalAggregatorHighlights(
    ranking.map((entry) => ({
      filmId: entry.filmId,
      filmTitle: entry.filmTitle,
      contextualScores: entry.aggregate.contextualScores,
    })),
  );

  return (
    <main className="page-shell critical-page">
      <header className="critical-hero">
        <p className="section-index">CRÍTICA · AGREGADORES</p>
        <h1>Las películas que están arriba.</h1>
        <p>
          Metacritic y Rotten Tomatoes, en dos listas sencillas. La nota y el
          número de críticas son los que publica cada sitio.
        </p>
      </header>

      {aggregators.length ? (
        <section aria-label="Películas destacadas por agregador">
          <div className="aggregator-grid">
            {aggregators.map((aggregator) => (
              <article className="aggregator-card" key={aggregator.sourceId}>
                <header>
                  <div>
                    <p className="section-index">AGREGADOR</p>
                    <h2>{aggregator.sourceName}</h2>
                  </div>
                  <span className="rank-label">Más valoradas</span>
                </header>
                <ol>
                  {aggregator.scores.map((score, index) => (
                    <li key={score.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <Link href={`/peliculas/${score.filmId}`}>
                        <strong>{score.filmTitle}</strong>
                        <small>{score.scaleLabel}</small>
                      </Link>
                      <a
                        href={score.publicationUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {score.originalDisplay}
                      </a>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="critical-empty">
          <h2>Aún no hay notas de agregadores.</h2>
          <p>Volveremos a esta lista cuando haya nuevas capturas.</p>
        </section>
      )}
    </main>
  );
}
