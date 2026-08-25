import type { Metadata } from "next";
import Link from "next/link";
import { getCriticalReceptionRanking } from "../../lib/repositories/signals";

export const metadata: Metadata = {
  title: "Recepción crítica",
  description:
    "Puntuaciones críticas normalizadas sin mezclarlas con predicciones.",
};

export const dynamic = "force-dynamic";

export default async function CriticalReceptionPage() {
  const ranking = await getCriticalReceptionRanking();
  const sufficient = ranking.filter((entry) => entry.aggregate.isSufficient);
  const limited = ranking.filter(
    (entry) =>
      !entry.aggregate.isSufficient && entry.aggregate.scores.length > 0,
  );
  const contextual = ranking.filter(
    (entry) => entry.aggregate.contextualScores.length > 0,
  );

  return (
    <main className="page-shell critical-page">
      <header className="critical-hero">
        <p className="section-index">RECEPCIÓN · SEÑAL INDEPENDIENTE</p>
        <h1>Lo que dice la crítica no mueve una predicción.</h1>
        <p>
          Las notas individuales se normalizan a 0–5, pero el valor original
          sigue visible. Solo ordenamos películas con tres críticas
          independientes.
        </p>
      </header>

      {sufficient.length ? (
        <ol className="critical-ranking">
          {sufficient.map((entry, index) => (
            <li key={entry.filmId}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <Link href={`/peliculas/${entry.filmId}`}>
                  <h2>{entry.filmTitle}</h2>
                </Link>
                <p>
                  {entry.aggregate.statistics?.count} puntuaciones verificables
                </p>
              </div>
              <strong>
                {entry.aggregate.statistics?.mean.toFixed(2)}
                <small>/5</small>
              </strong>
            </li>
          ))}
        </ol>
      ) : !limited.length && !contextual.length ? (
        <section className="critical-empty">
          <h2>Todavía no hay una película con cobertura suficiente.</h2>
          <p>
            Las observaciones existentes siguen visibles en cada ficha; no
            elevamos una media con menos de tres notas independientes.
          </p>
        </section>
      ) : null}

      {limited.length ? (
        <section className="critical-limited">
          <header>
            <p className="section-index">COBERTURA INSUFICIENTE</p>
            <h2>Datos visibles, sin ranking</h2>
          </header>
          <div>
            {limited.map((entry) => (
              <Link key={entry.filmId} href={`/peliculas/${entry.filmId}`}>
                <strong>{entry.filmTitle}</strong>
                <span>{entry.aggregate.scores.length}/3 críticas</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {contextual.length ? (
        <section className="critical-context">
          <header>
            <p className="section-index">AGREGADOS · CONTEXTO</p>
            <h2>Consensos publicados por los agregadores</h2>
            <p>
              Tomatometer y Metascore conservan su escala y denominador. No son
              una media Runscars y no se mezclan con las críticas individuales.
            </p>
          </header>
          <div className="critical-context-grid">
            {contextual.map((entry) => (
              <article key={entry.filmId}>
                <Link href={`/peliculas/${entry.filmId}`}>
                  <h3>{entry.filmTitle}</h3>
                </Link>
                <div>
                  {entry.aggregate.contextualScores.map((score) => (
                    <a
                      href={score.publicationUrl}
                      key={score.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span>{score.sourceName}</span>
                      <strong>{score.originalDisplay}</strong>
                      <small>{score.scaleLabel}</small>
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
