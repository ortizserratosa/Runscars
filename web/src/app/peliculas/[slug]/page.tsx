import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmCatalogDetails } from "../../components/FilmCatalogDetails";
import { FilmWatchPanel } from "../../components/FilmWatchPanel";
import { Movement } from "../../components/Movement";
import { PosterBlock } from "../../components/PosterBlock";
import {
  getFilmCatalogDetail,
  listFixtureFilmIds,
} from "../../../lib/repositories/catalog";
import {
  getFilmCriticalView,
  getFilmPredictions,
} from "../../../lib/repositories/signals";

type FilmPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listFixtureFilmIds().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: FilmPageProps): Promise<Metadata> {
  const { slug } = await params;
  const film = await getFilmCatalogDetail(slug);
  if (!film) return { title: "Película no encontrada" };
  return {
    title: film.title,
    description: `Predicciones y procedencia verificable de ${film.title} para Oscar 2027.`,
  };
}

function formatNumber(value: number | null, digits = 1) {
  return value === null
    ? "—"
    : value.toLocaleString("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}

function dateLabel(value: string | null) {
  if (!value) return "Fecha no indicada";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value));
}

export default async function FilmPage({ params }: FilmPageProps) {
  const { slug } = await params;
  const film = await getFilmCatalogDetail(slug);
  if (!film) notFound();

  const [predictions, critical] = await Promise.all([
    getFilmPredictions(slug),
    getFilmCriticalView(slug, film.title),
  ]);
  const primaryPrediction =
    predictions.find(
      (prediction) => prediction.categoryId === "best-picture",
    ) ??
    predictions[0] ??
    null;
  const releaseDate = film.tmdb?.releaseDate ?? film.editorialReleaseDate;
  const releaseStatus =
    film.releaseStatus === "released" ? "Estrenada" : "Próximo estreno";

  return (
    <main>
      <section className="film-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <Link href="/temporadas/2027">Oscar 2027</Link>
            <span>/</span>
            <span>Películas</span>
          </div>

          <div className="film-hero-grid">
            <PosterBlock
              imagePath={film.tmdb?.posterPath}
              number={
                primaryPrediction
                  ? String(primaryPrediction.candidate.position).padStart(
                      2,
                      "0",
                    )
                  : "—"
              }
              size="large"
              title={film.title}
              tone="ink"
            />
            <div className="film-hero-copy">
              <div className="film-status-row">
                <span className="live-chip">
                  <span aria-hidden="true" /> {releaseStatus}
                </span>
                <span>{dateLabel(releaseDate)}</span>
              </div>
              <p className="kicker">Oscar 2027 · película observada</p>
              <h1>{film.title}</h1>
              <p className="film-deck">
                {film.tmdb?.tagline ??
                  film.tmdb?.overview ??
                  "Ficha editorial enlazada con las señales verificables de la temporada."}
              </p>
              {primaryPrediction ? (
                <div className="film-score-strip">
                  <div>
                    <span>Consenso</span>
                    <strong>
                      {formatNumber(primaryPrediction.candidate.scoreOutOf100)}
                    </strong>
                    <small>puntos Borda / 100</small>
                  </div>
                  <div>
                    <span>Cobertura</span>
                    <strong>
                      {primaryPrediction.candidate.appearances}/
                      {primaryPrediction.candidate.applicableSourceCount}
                    </strong>
                    <small>fuentes aplicables</small>
                  </div>
                  <div>
                    <span>Posición</span>
                    <strong>#{primaryPrediction.candidate.position}</strong>
                    <small>
                      {primaryPrediction.categoryName} · corte del{" "}
                      {dateLabel(primaryPrediction.lockedAt)}
                    </small>
                  </div>
                </div>
              ) : null}
              <p className="metadata-note">
                {film.tmdb
                  ? "Metadatos e imágenes servidos desde la caché local; TMDB no interviene en las señales Oscar."
                  : "Sin captura TMDB disponible; se conserva la ficha editorial verificable."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell film-content">
        <FilmCatalogDetails film={film} />

        {predictions.length ? (
          <div className="film-signal-section prediction-module">
            <div className="module-heading">
              <span className="signal-letter">A</span>
              <div>
                <p className="section-index">PREDICCIONES VIGENTES</p>
                <h2>La misma lectura que en cada categoría</h2>
                <p>
                  Posición, movimiento y fuentes proceden del último corte real
                  de cada carrera.
                </p>
              </div>
            </div>
            <div className="film-category-predictions">
              {predictions.map((prediction) => (
                <article key={prediction.categoryId}>
                  <div className="film-category-heading">
                    <div>
                      <p className="section-index">
                        CORTE DEL {dateLabel(prediction.lockedAt)}
                      </p>
                      <h3>{prediction.categoryName}</h3>
                    </div>
                    <div className="film-category-position">
                      <strong>#{prediction.candidate.position}</strong>
                      <Movement value={prediction.candidate.movement} />
                    </div>
                  </div>
                  <div className="film-source-table">
                    {prediction.candidate.sourceContributions.map((source) => (
                      <div key={source.sourceId}>
                        <span className="source-monogram">
                          {source.sourceName.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <Link href={`/fuentes/${source.sourceId}`}>
                            {source.sourceName}
                          </Link>
                          <small>
                            {source.publishedAt
                              ? `Publicada ${dateLabel(source.publishedAt)}`
                              : "Publicación verificada"}
                          </small>
                        </div>
                        <span>{formatNumber(source.points * 100, 2)} pts</span>
                        <strong className="source-rank">
                          {source.appearanceKind === "ordered"
                            ? `#${source.rank}`
                            : source.appearanceKind === "selection"
                              ? "SEL."
                              : "—"}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <p className="calculation-proof">
                    Consenso:{" "}
                    <strong>
                      {formatNumber(prediction.candidate.scoreOutOf100)} / 100
                    </strong>{" "}
                    · cobertura {prediction.candidate.appearances}/
                    {prediction.candidate.applicableSourceCount}.
                  </p>
                  <Link
                    className="text-link"
                    href={`/temporadas/2027/${prediction.categorySlug}`}
                  >
                    Abrir clasificación y cálculo completo
                  </Link>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {critical ? (
          <div className="film-signal-section critics-module">
            <div className="module-heading">
              <span className="signal-letter">B</span>
              <div>
                <p className="section-index">RECEPCIÓN CRÍTICA VERIFICADA</p>
                <h2>Solo cuando hay datos reales</h2>
                <p>
                  Las puntuaciones individuales se normalizan; los agregadores
                  permanecen como contexto separado.
                </p>
              </div>
            </div>
            {critical.aggregate.scores.length ||
            critical.aggregate.contextualScores.length ? (
              <div className="review-score-grid">
                {critical.aggregate.scores.map((score) => (
                  <a
                    href={score.publicationUrl}
                    key={score.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div className="review-source-line">
                      <span>{score.sourceName}</span>
                      <small>{dateLabel(score.publishedAt)}</small>
                    </div>
                    <strong>{score.originalDisplay}</strong>
                    <p>{score.author ?? "Autor no indicado"}</p>
                    <span className="normalized-label">
                      {formatNumber(score.normalization.normalizedValue, 2)}/5
                    </span>
                    <small>Puntuación individual</small>
                  </a>
                ))}
                {critical.aggregate.contextualScores.map((score) => (
                  <a
                    href={score.publicationUrl}
                    key={score.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div className="review-source-line">
                      <span>{score.sourceName}</span>
                      <small>{dateLabel(score.publishedAt)}</small>
                    </div>
                    <strong>{score.originalDisplay}</strong>
                    <p>{score.author ?? "Agregado contextual"}</p>
                    <span className="context-label">No participa</span>
                    <small>{score.scaleLabel}</small>
                  </a>
                ))}
              </div>
            ) : null}
            {critical.aggregate.isSufficient &&
            critical.aggregate.statistics ? (
              <p className="calculation-proof">
                Media de {critical.aggregate.statistics.count} puntuaciones:{" "}
                <strong>
                  {formatNumber(critical.aggregate.statistics.mean, 2)} / 5
                </strong>
                .
              </p>
            ) : (
              <p className="insufficient-note">
                <strong>Datos insuficientes:</strong> hay{" "}
                {critical.aggregate.scores.length} puntuaciones individuales
                verificables. Se necesitan {critical.aggregate.minimumRequired}
                para publicar una media.
              </p>
            )}
          </div>
        ) : null}

        {critical?.reviews.length ? (
          <div className="film-signal-section reviews-module">
            <div className="module-heading">
              <span className="signal-letter">R</span>
              <div>
                <p className="section-index">RESEÑAS ENLAZADAS</p>
                <h2>Lecturas con firma y fecha</h2>
                <p>Runscars enlaza la pieza canónica y no copia su cuerpo.</p>
              </div>
            </div>
            <div className="review-link-list">
              {critical.reviews.map((review) => (
                <a
                  href={review.publicationUrl}
                  key={review.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span>{dateLabel(review.publishedAt)}</span>
                  <div>
                    <strong>{review.sourceName}</strong>
                    <p>
                      {review.title}
                      {review.author ? ` · ${review.author}` : ""}
                    </p>
                  </div>
                  <span className="review-arrow" aria-hidden="true">
                    ↗
                  </span>
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <div className="film-signal-section reviews-module">
          <div className="module-heading">
            <span className="signal-letter">D</span>
            <div>
              <p className="section-index">PROCEDENCIA</p>
              <h2>Identidad editorial comprobada</h2>
              <p>
                La ficha conserva la publicación que permitió identificar la
                película dentro de la temporada.
              </p>
            </div>
          </div>
          <div className="review-link-list">
            <a href={film.verificationUrl} rel="noreferrer" target="_blank">
              <span>Fuente</span>
              <div>
                <strong>Publicación de comprobación</strong>
                <p>{film.notes ?? "Observación editorial conservada."}</p>
              </div>
              <span className="review-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          </div>
        </div>

        <div className="film-signal-section community-module">
          <div className="module-heading">
            <span className="signal-letter">C</span>
            <div>
              <p className="section-index">TU RANKING</p>
              <h2>Tu señal sigue siendo tuya</h2>
            </div>
          </div>
          <FilmWatchPanel filmId={slug} />
        </div>
      </section>
    </main>
  );
}
