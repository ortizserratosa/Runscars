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
  const limited = ranking.filter((entry) => !entry.aggregate.isSufficient);

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
      ) : (
        <section className="critical-empty">
          <h2>Todavía no hay una película con cobertura suficiente.</h2>
          <p>
            Las observaciones existentes siguen visibles en cada ficha; no
            elevamos una media con menos de tres notas independientes.
          </p>
        </section>
      )}

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
    </main>
  );
}
