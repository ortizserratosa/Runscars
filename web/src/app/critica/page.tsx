import type { Metadata } from "next";
import Link from "next/link";
import {
  filterCriticalAggregatorFilms,
  groupCriticalAggregatorHighlights,
} from "../../lib/critical/aggregators";
import {
  getCriticalReceptionRanking,
  getCurrentCategoryPredictions,
} from "../../lib/repositories/signals";

export const metadata: Metadata = {
  title: "Agregadores",
  description:
    "Las notas de Metacritic y Rotten Tomatoes para nuestras predicciones.",
};

export const dynamic = "force-dynamic";

export default async function CriticalReceptionPage() {
  const [ranking, predictions] = await Promise.all([
    getCriticalReceptionRanking(),
    getCurrentCategoryPredictions(),
  ]);
  const predictedFilmIds = new Set(
    predictions.flatMap((prediction) =>
      prediction.aggregate.ranking.flatMap((candidate) =>
        candidate.film?.id ? [candidate.film.id] : [],
      ),
    ),
  );
  const aggregators = groupCriticalAggregatorHighlights(
    filterCriticalAggregatorFilms(
      ranking.map((entry) => ({
        filmId: entry.filmId,
        filmTitle: entry.filmTitle,
        contextualScores: entry.aggregate.contextualScores,
      })),
      predictedFilmIds,
    ),
  );

  return (
    <main className="page-shell critical-page">
      <header className="critical-hero">
        <p className="section-index">CRÍTICA · AGREGADORES</p>
        <h1>Nuestras predicciones, con sus notas.</h1>
        <p>
          Metacritic y Rotten Tomatoes para las películas que aparecen en
          nuestras predicciones.
        </p>
      </header>

      {aggregators.length ? (
        <section aria-label="Puntuaciones de agregadores para nuestras predicciones">
          <div className="aggregator-grid">
            {aggregators.map((aggregator) => (
              <article className="aggregator-card" key={aggregator.sourceId}>
                <header>
                  <div>
                    <p className="section-index">AGREGADOR</p>
                    <h2>{aggregator.sourceName}</h2>
                  </div>
                  <span className="rank-label">Puntuación</span>
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
