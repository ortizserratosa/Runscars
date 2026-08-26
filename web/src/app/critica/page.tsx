import type { Metadata } from "next";
import Link from "next/link";
import {
  getCriticalReceptionRanking,
  getCurrentCategoryPredictions,
} from "../../lib/repositories/signals";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getRequestLocale()) === "en";
  return {
    title: en ? "Critical reception" : "Recepción crítica",
    description: en
      ? "Independent professional reviews for films in our predictions."
      : "Críticas profesionales independientes para nuestras predicciones.",
  };
}

export const dynamic = "force-dynamic";

export default async function CriticalReceptionPage() {
  const [ranking, predictions, locale] = await Promise.all([
    getCriticalReceptionRanking(),
    getCurrentCategoryPredictions(),
    getRequestLocale(),
  ]);
  const en = locale === "en";
  const predictedFilmIds = new Set(
    predictions.flatMap((prediction) =>
      prediction.aggregate.ranking.flatMap((candidate) =>
        candidate.film?.id ? [candidate.film.id] : [],
      ),
    ),
  );
  const criticalFilms = ranking.filter(
    (entry) =>
      predictedFilmIds.has(entry.filmId) && entry.aggregate.scores.length > 0,
  );

  return (
    <main className="page-shell critical-page">
      <header className="critical-hero">
        <p className="section-index">
          {en ? "CRITICS · ORIGINAL SOURCES" : "CRÍTICA · FUENTES ORIGINALES"}
        </p>
        <h1>
          {en
            ? "Professional criticism, source by source."
            : "La crítica profesional, fuente a fuente."}
        </h1>
        <p>
          {en
            ? "We publish only attributable scores from approved original outlets. A normalized average appears after three independent reviews and always remains separate from professional predictions."
            : "Publicamos solo notas atribuibles de medios originales aprobados. La media normalizada aparece a partir de tres críticas independientes y siempre permanece separada de las predicciones profesionales."}
        </p>
      </header>

      {criticalFilms.length ? (
        <section
          aria-label={
            en
              ? "Professional reviews for our predictions"
              : "Críticas profesionales para nuestras predicciones"
          }
        >
          <div className="aggregator-grid">
            {criticalFilms.map((entry) => (
              <article className="aggregator-card" key={entry.filmId}>
                <header>
                  <div>
                    <p className="section-index">
                      {en ? "CRITICAL RECEPTION" : "RECEPCIÓN CRÍTICA"}
                    </p>
                    <h2>
                      <Link
                        href={localizedPath(
                          `/peliculas/${entry.filmId}`,
                          locale,
                        )}
                      >
                        {entry.filmTitle}
                      </Link>
                    </h2>
                  </div>
                  <span className="rank-label">
                    {entry.aggregate.isSufficient && entry.aggregate.statistics
                      ? `${entry.aggregate.statistics.mean.toLocaleString(
                          en ? "en-GB" : "es-ES",
                          {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          },
                        )}/5`
                      : `${entry.aggregate.scores.length}/${entry.aggregate.minimumRequired}`}
                  </span>
                </header>
                <ol>
                  {entry.aggregate.scores.map((score, index) => (
                    <li key={score.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <a
                        href={score.publicationUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <strong>{score.sourceName}</strong>
                        <small>
                          {score.author ??
                            (en
                              ? "Original publication"
                              : "Publicación original")}
                        </small>
                      </a>
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
                {!entry.aggregate.isSufficient ? (
                  <p className="insufficient-note">
                    {en
                      ? "No average is published until there are three independent reviews."
                      : "No se publica una media hasta reunir tres críticas independientes."}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="critical-empty">
          <h2>
            {en
              ? "There are no publishable reviews yet."
              : "Aún no hay críticas publicables."}
          </h2>
          <p>
            {en
              ? "This section will open when independent original outlets have approved, attributable scores."
              : "Esta sección se abrirá cuando haya notas atribuibles de medios originales aprobados e independientes."}
          </p>
        </section>
      )}
    </main>
  );
}
