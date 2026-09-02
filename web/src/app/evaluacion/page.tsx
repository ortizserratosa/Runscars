import type { Metadata } from "next";
import Link from "next/link";
import { getPublicEvaluationReport } from "../../lib/evaluation/public-report";
import { localizedCategoryName } from "../../lib/i18n/categories";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { buildLocalizedMetadata } from "../../lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const en = locale === "en";
  return buildLocalizedMetadata({
    locale,
    path: "/evaluacion",
    title: en
      ? "Oscar Prediction Accuracy and Evaluation"
      : "Acierto y evaluación de predicciones Oscar",
    description: en
      ? "Compare locked Runscars Oscar predictions with official nominations and winners using a transparent, versioned evaluation."
      : "Compara las predicciones Oscar cerradas de Runscars con nominaciones y ganadores oficiales mediante una evaluación transparente.",
  });
}

export const dynamic = "force-dynamic";

function percent(numerator: number, denominator: number) {
  return denominator ? `${Math.round((numerator / denominator) * 100)}%` : "—";
}

export default async function EvaluationPage() {
  const [report, locale] = await Promise.all([
    getPublicEvaluationReport(),
    getRequestLocale(),
  ]);
  const en = locale === "en";
  return (
    <main className="page-shell evaluation-page">
      <header className="evaluation-hero">
        <p className="section-index">RUNSCARS EVALUATION V2</p>
        <h1>
          {en
            ? "Predictions are locked before the answer is known."
            : "Las predicciones se cierran antes de conocer la respuesta."}
        </h1>
        <p>
          {en
            ? "This page compares final, immutable snapshots with official publications. If either part is missing, no figure is calculated."
            : "Esta página compara snapshots finales e inmutables con publicaciones oficiales. Si falta cualquiera de las dos piezas, no calcula una cifra."}
        </p>
      </header>

      {report.seasons.length ? (
        report.seasons.map((season) => (
          <section className="evaluation-season" key={season.seasonId}>
            <header>
              <div>
                <p className="section-index">OSCAR {season.ceremonyYear}</p>
                <h2>{en ? "Overall result" : "Resultado global"}</h2>
              </div>
              <div className="evaluation-totals">
                <article>
                  <strong>
                    {percent(
                      season.totals.nominationHits,
                      season.totals.nominationPredictions,
                    )}
                  </strong>
                  <span>
                    {en ? "nomination precision" : "precisión nominaciones"}
                  </span>
                </article>
                <article>
                  <strong>
                    {percent(
                      season.totals.nominationHits,
                      season.totals.officialNominees,
                    )}
                  </strong>
                  <span>
                    {en ? "nomination coverage" : "cobertura nominaciones"}
                  </span>
                </article>
                <article>
                  <strong>
                    {season.totals.winnerHits}/{season.totals.winnerEvaluations}
                  </strong>
                  <span>
                    {en ? "winners ranked No. 1" : "ganadores en nº 1"}
                  </span>
                </article>
              </div>
            </header>
            <div className="evaluation-category-grid">
              {season.categories.map((category) => (
                <article key={category.categoryId}>
                  <h3>
                    {localizedCategoryName(
                      locale,
                      category.categoryId,
                      category.categoryName,
                    )}
                  </h3>
                  {category.nominations ? (
                    <dl>
                      <div>
                        <dt>{en ? "Hits" : "Aciertos"}</dt>
                        <dd>
                          {category.nominations.hits}/
                          {category.nominations.predictedCandidateIds.length}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          {en
                            ? "Official nominees covered"
                            : "Oficiales cubiertos"}
                        </dt>
                        <dd>
                          {category.nominations.hits}/
                          {category.nominations.officialNomineeIds.length}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p>
                      {en
                        ? "Nomination lock pending."
                        : "Cierre de nominaciones pendiente."}
                    </p>
                  )}
                  {category.winner ? (
                    <dl>
                      <div>
                        <dt>
                          {en ? "Winner ranked No. 1" : "Ganador en nº 1"}
                        </dt>
                        <dd>
                          {category.winner.winnerWasFirst
                            ? en
                              ? "Yes"
                              : "Sí"
                            : "No"}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          {en ? "Winner position" : "Posición del ganador"}
                        </dt>
                        <dd>
                          {category.winner.winnerPosition ??
                            (en ? "outside the ranking" : "fuera")}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p>
                      {en
                        ? "Winner lock pending."
                        : "Cierre de ganador pendiente."}
                    </p>
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
          <span>{en ? "PENDING" : "EN ESPERA"}</span>
          <h2>
            {en
              ? "The first public evaluation cannot be completed yet."
              : "La primera evaluación pública aún no se puede cerrar."}
          </h2>
          <p>
            {report.state === "unavailable"
              ? en
                ? "The database is not available in this environment."
                : "La base de datos no está disponible en este entorno."
              : en
                ? `Oscar ${report.activeSeason?.ceremonyYear ?? 2027} is still active: final locks or compatible official results are missing.`
                : `Oscar ${report.activeSeason?.ceremonyYear ?? 2027} sigue activo: faltan cierres finales o resultados oficiales compatibles.`}
          </p>
          <p>
            {en
              ? "The 2022–2026 archive contains official results, but we do not fabricate historical predictions to produce a retrospective accuracy rate."
              : "El archivo 2022–2026 contiene verdad oficial, pero no fabricamos predicciones históricas para producir una tasa retroactiva."}
          </p>
        </section>
      )}

      <aside className="evaluation-method-note">
        <p>
          <strong>{en ? "Nominations:" : "Nominaciones:"}</strong>{" "}
          {en
            ? "precision = hits / selected; coverage = hits / official nominees."
            : "precisión = aciertos / seleccionadas; cobertura = aciertos / nominadas oficiales."}
        </p>
        <p>
          <strong>{en ? "Winner:" : "Ganador:"}</strong>{" "}
          {en
            ? "shows whether the winner ranked first and its position in the final ranking."
            : "indica si terminó primero y su posición en el ranking final."}
        </p>
        <Link
          className="text-link"
          href={localizedPath("/metodologia", locale)}
        >
          {en ? "Read the full methodology →" : "Leer metodología completa →"}
        </Link>
      </aside>
    </main>
  );
}
