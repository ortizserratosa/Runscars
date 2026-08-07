import type { Metadata } from "next";
import Link from "next/link";
import { FilmCatalogDetails } from "../../components/FilmCatalogDetails";
import { PosterBlock } from "../../components/PosterBlock";
import { odysseyReviewLinks } from "../../data";
import { consensusCandidates } from "../../../data/aggregation-presentation";
import { getReferenceCriticalReception } from "../../../data/phase6-reference";
import { getFilmCatalogDetail } from "../../../lib/repositories/catalog";
import { FilmCommunity } from "./FilmCommunity";

export async function generateMetadata(): Promise<Metadata> {
  const film = await getFilmCatalogDetail("the-odyssey");
  return {
    title: film?.title ?? "The Odyssey",
    description:
      film?.tmdb?.overview ??
      "Ficha de The Odyssey en la temporada Oscar 2027.",
  };
}

const odyssey = consensusCandidates.find(
  (candidate) => candidate.id === "the-odyssey",
)!;
const reception = getReferenceCriticalReception("the-odyssey");
const criticalCards = [
  ...reception.scores.map((score) => ({
    source: score.sourceName,
    author: score.author ?? "Autor no indicado",
    date: score.publishedAt ?? score.capturedAt,
    value: score.originalDisplay,
    normalized: `${score.normalization.normalizedValue.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}/5`,
    kind: "Puntuación individual",
    href: score.publicationUrl,
  })),
  ...reception.contextualScores.map((score) => ({
    source: score.sourceName,
    author: "Agregado contextual",
    date: score.publishedAt ?? score.capturedAt,
    value: score.originalDisplay,
    normalized: "No participa",
    kind: score.scaleLabel,
    href: score.publicationUrl,
  })),
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value));
}

function formatNumber(value: number | null) {
  return value === null
    ? "—"
    : value.toLocaleString("es-ES", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}

export default async function FilmPage() {
  const film = await getFilmCatalogDetail("the-odyssey");

  if (!film) {
    return null;
  }

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
              title={film.title}
              tone="violet"
              number="01"
              size="large"
            />
            <div className="film-hero-copy">
              <div className="film-status-row">
                <span className="live-chip">
                  <span aria-hidden="true" /> Estrenada
                </span>
                <span>17 jul 2026</span>
              </div>
              <p className="kicker">Oscar 2027 · Mejor película</p>
              <h1>
                The <em>Odyssey</em>
              </h1>
              <p className="film-deck">
                {film.tmdb?.tagline ??
                  "Lidera el consenso profesional por respaldo y posición en las listas aplicables."}
              </p>
              <div className="film-score-strip">
                <div>
                  <span>Consenso</span>
                  <strong>{formatNumber(odyssey.score)}</strong>
                  <small>puntos Borda / 100</small>
                </div>
                <div>
                  <span>Cobertura</span>
                  <strong>{odyssey.coverage}</strong>
                  <small>listas ordenadas</small>
                </div>
                <div>
                  <span>Pos. media</span>
                  <strong>{formatNumber(odyssey.average)}</strong>
                  <small>mediana {formatNumber(odyssey.median)}</small>
                </div>
              </div>
              <p className="metadata-note">
                {film.tmdb
                  ? "Metadatos e imágenes servidos desde la caché local; TMDB no interviene en las señales Oscar."
                  : "Sin captura TMDB disponible en este entorno; se conserva la ficha editorial."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell film-content">
        <FilmCatalogDetails film={film} />

        <div className="film-signal-section prediction-module">
          <div className="module-heading">
            <span className="signal-letter">A</span>
            <div>
              <p className="section-index">PREDICCIONES</p>
              <h2>Quién sostiene el nº 1</h2>
              <p>Cuatro publicaciones, una observación atribuible por lista.</p>
            </div>
          </div>
          <div className="film-source-table">
            {odyssey.sources.map((source) => (
              <div key={source.name}>
                <span className="source-monogram">
                  {source.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <a href={source.href} rel="noreferrer" target="_blank">
                    {source.name}
                  </a>
                  <small>Predicción de nominación · Best Picture</small>
                </div>
                <span>{formatNumber(source.points * 100)} pts</span>
                <strong className="source-rank">#{source.rank}</strong>
              </div>
            ))}
          </div>
          <p className="calculation-proof">
            Cada fila aporta <code>(10 − posición + 1) / 10</code>. La media de
            las cuatro contribuciones es{" "}
            <strong>{formatNumber(odyssey.score)} / 100</strong>.
          </p>
          <Link className="text-link" href="/temporadas/2027/mejor-pelicula">
            Ver la categoría completa
          </Link>
        </div>

        <div className="film-signal-section critics-module">
          <div className="module-heading">
            <span className="signal-letter">B</span>
            <div>
              <p className="section-index">RECEPCIÓN CRÍTICA</p>
              <h2>Valores originales, sin atajos</h2>
              <p>
                Solo la reseña individual participa en la futura media. Los
                agregadores se muestran como contexto.
              </p>
            </div>
          </div>
          <div className="review-score-grid">
            {criticalCards.map((review) => (
              <a
                href={review.href}
                key={review.source}
                rel="noreferrer"
                target="_blank"
              >
                <div className="review-source-line">
                  <span>{review.source}</span>
                  <small>{formatDate(review.date)}</small>
                </div>
                <strong>{review.value}</strong>
                <p>{review.author}</p>
                <span
                  className={
                    review.normalized === "No participa"
                      ? "context-label"
                      : "normalized-label"
                  }
                >
                  {review.normalized}
                </span>
                <small>{review.kind}</small>
              </a>
            ))}
          </div>
          <p className="calculation-proof">
            La nota individual conserva <strong>5/5</strong> y se normaliza con{" "}
            <code>5 ÷ 5 × 5 = 5,0000</code>. Metacritic y Rotten Tomatoes se
            mantienen como contexto y nunca entran en esa media.
          </p>
          <p className="insufficient-note">
            <strong>Datos insuficientes:</strong> hay {reception.scores.length}{" "}
            puntuación individual verificable. Se necesitan{" "}
            {reception.minimumRequired} para ordenar públicamente por recepción.
          </p>
        </div>

        <div className="film-signal-section reviews-module">
          <div className="module-heading">
            <span className="signal-letter">R</span>
            <div>
              <p className="section-index">RESEÑAS ENLAZADAS</p>
              <h2>Lecturas con firma y fecha</h2>
              <p>El prototipo enlaza la pieza canónica y no copia su cuerpo.</p>
            </div>
          </div>
          <div className="review-link-list">
            {odysseyReviewLinks.map((review) => (
              <a
                href={review.href}
                key={review.source}
                rel="noreferrer"
                target="_blank"
              >
                <span>{review.date}</span>
                <div>
                  <strong>{review.source}</strong>
                  <p>{review.author}</p>
                </div>
                <span className="review-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </div>
        </div>

        <div className="film-signal-section community-module">
          <div className="module-heading">
            <span className="signal-letter">C</span>
            <div>
              <p className="section-index">COMUNIDAD</p>
              <h2>Tu señal sigue siendo tuya</h2>
            </div>
          </div>
          <FilmCommunity />
        </div>
      </section>
    </main>
  );
}
