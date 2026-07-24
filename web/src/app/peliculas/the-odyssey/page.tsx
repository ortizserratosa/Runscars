import type { Metadata } from "next";
import Link from "next/link";
import { FilmCatalogDetails } from "../../components/FilmCatalogDetails";
import { PosterBlock } from "../../components/PosterBlock";
import { candidates, odysseyReviewLinks, odysseyReviews } from "../../data";
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

const odyssey = candidates[0];

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
                  "Lidera el consenso del fixture con tres primeras posiciones y presencia en las cuatro listas aplicables."}
              </p>
              <div className="film-score-strip">
                <div>
                  <span>Consenso</span>
                  <strong>97,5</strong>
                  <small>puntos Borda / 100</small>
                </div>
                <div>
                  <span>Cobertura</span>
                  <strong>4/4</strong>
                  <small>listas ordenadas</small>
                </div>
                <div>
                  <span>Pos. media</span>
                  <strong>1,25</strong>
                  <small>mediana 1</small>
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
                  {source.name === "AwardsWatch" ? (
                    <Link href="/fuentes/awardswatch">{source.name}</Link>
                  ) : (
                    <strong>{source.name}</strong>
                  )}
                  <small>Predicción de nominación · Best Picture</small>
                </div>
                <span>Posición publicada</span>
                <strong className="source-rank">#{source.rank}</strong>
              </div>
            ))}
          </div>
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
            {odysseyReviews.map((review) => (
              <a
                href={review.href}
                key={review.source}
                rel="noreferrer"
                target="_blank"
              >
                <div className="review-source-line">
                  <span>{review.source}</span>
                  <small>{review.date}</small>
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
          <p className="insufficient-note">
            <strong>Datos insuficientes:</strong> el fixture contiene una
            puntuación individual verificable. Se necesitan tres para ordenar
            públicamente por recepción.
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
