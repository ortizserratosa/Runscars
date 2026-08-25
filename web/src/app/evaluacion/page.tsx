import type { Metadata } from "next";
import Link from "next/link";
import { getPublicEvaluationReport } from "../../lib/evaluation/public-report";

export const metadata: Metadata = {
  title: "Evaluación de predicciones",
  description: "Acierto de los cierres Runscars frente a resultados oficiales.",
};

export const dynamic = "force-dynamic";

function percent(numerator: number, denominator: number) {
  return denominator ? `${Math.round((numerator / denominator) * 100)}%` : "—";
}

export default async function EvaluationPage() {
  const report = await getPublicEvaluationReport();
  return (
    <main className="page-shell evaluation-page">
      <header className="evaluation-hero">
        <p className="section-index">RUNSCARS EVALUATION V2</p>
        <h1>Las predicciones se cierran antes de conocer la respuesta.</h1>
        <p>
          Esta página compara snapshots finales e inmutables con publicaciones
          oficiales. Si falta cualquiera de las dos piezas, no calcula una
          cifra.
        </p>
      </header>

      {report.seasons.length ? (
        report.seasons.map((season) => (
          <section className="evaluation-season" key={season.seasonId}>
            <header>
              <div>
                <p className="section-index">OSCAR {season.ceremonyYear}</p>
                <h2>Resultado global</h2>
              </div>
              <div className="evaluation-totals">
                <article>
                  <strong>
                    {percent(
                      season.totals.nominationHits,
                      season.totals.nominationPredictions,
                    )}
                  </strong>
                  <span>precisión nominaciones</span>
                </article>
                <article>
                  <strong>
                    {percent(
                      season.totals.nominationHits,
                      season.totals.officialNominees,
                    )}
                  </strong>
                  <span>cobertura nominaciones</span>
                </article>
                <article>
                  <strong>
                    {season.totals.winnerHits}/{season.totals.winnerEvaluations}
                  </strong>
                  <span>ganadores en nº 1</span>
                </article>
              </div>
            </header>
            <div className="evaluation-category-grid">
              {season.categories.map((category) => (
                <article key={category.categoryId}>
                  <h3>{category.categoryName}</h3>
                  {category.nominations ? (
                    <dl>
                      <div>
                        <dt>Aciertos</dt>
                        <dd>
                          {category.nominations.hits}/
                          {category.nominations.predictedCandidateIds.length}
                        </dd>
                      </div>
                      <div>
                        <dt>Oficiales cubiertos</dt>
                        <dd>
                          {category.nominations.hits}/
                          {category.nominations.officialNomineeIds.length}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p>Cierre de nominaciones pendiente.</p>
                  )}
                  {category.winner ? (
                    <dl>
                      <div>
                        <dt>Ganador en nº 1</dt>
                        <dd>{category.winner.winnerWasFirst ? "Sí" : "No"}</dd>
                      </div>
                      <div>
                        <dt>Posición del ganador</dt>
                        <dd>{category.winner.winnerPosition ?? "fuera"}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p>Cierre de ganador pendiente.</p>
                  )}
                  <small>
                    {category.nominations?.snapshotId ??
                      category.winner?.snapshotId}
                    <br />
                    {category.nominations?.resultSetId ??
                      category.winner?.resultSetId}
                  </small>
                </article>
              ))}
            </div>
          </section>
        ))
      ) : (
        <section className="evaluation-pending">
          <span>EN ESPERA</span>
          <h2>La primera evaluación pública aún no se puede cerrar.</h2>
          <p>
            {report.state === "unavailable"
              ? "La base de datos no está disponible en este entorno."
              : `Oscar ${report.activeSeason?.ceremonyYear ?? 2027} sigue activo: faltan cierres finales o resultados oficiales compatibles.`}
          </p>
          <p>
            El archivo 2022–2026 contiene verdad oficial, pero no fabricamos
            predicciones históricas para producir una tasa retroactiva.
          </p>
        </section>
      )}

      <aside className="evaluation-method-note">
        <p>
          <strong>Nominaciones:</strong> precisión = aciertos / seleccionadas;
          cobertura = aciertos / nominadas oficiales.
        </p>
        <p>
          <strong>Ganador:</strong> indica si terminó primero y su posición en
          el ranking final.
        </p>
        <Link className="text-link" href="/metodologia">
          Leer metodología completa →
        </Link>
      </aside>
    </main>
  );
}
