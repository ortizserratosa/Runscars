import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmCatalogDetails } from "../../components/FilmCatalogDetails";
import { FilmWatchPanel } from "../../components/FilmWatchPanel";
import { PosterBlock } from "../../components/PosterBlock";
import { consensusCandidates } from "../../../data/aggregation-presentation";
import {
  getFilmCatalogDetail,
  listFixtureFilmIds,
} from "../../../lib/repositories/catalog";

type FilmPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listFixtureFilmIds()
    .filter((filmId) => filmId !== "the-odyssey")
    .map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: FilmPageProps): Promise<Metadata> {
  const { slug } = await params;
  const film = await getFilmCatalogDetail(slug);

  if (!film) {
    return { title: "Película no encontrada" };
  }

  return {
    title: film.title,
    description: `Ficha inicial verificable de ${film.title} para Oscar 2027.`,
  };
}

export default async function FilmPage({ params }: FilmPageProps) {
  const { slug } = await params;
  const film = await getFilmCatalogDetail(slug);

  if (!film) {
    notFound();
  }

  const status =
    film.releaseStatus === "released" ? "Estrenada" : "Próximo estreno";
  const releaseDate = film.tmdb?.releaseDate ?? film.editorialReleaseDate;
  const date = releaseDate
    ? new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${releaseDate}T00:00:00Z`))
    : "Fecha no confirmada";
  const prediction = consensusCandidates.find(
    (candidate) => candidate.id === slug,
  );
  const formatNumber = (value: number | null) =>
    value === null
      ? "—"
      : value.toLocaleString("es-ES", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

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
              number="—"
              size="large"
              title={film.title}
              tone="ink"
            />
            <div className="film-hero-copy">
              <div className="film-status-row">
                <span className="live-chip">
                  <span aria-hidden="true" /> {status}
                </span>
                <span>{date}</span>
              </div>
              <p className="kicker">Oscar 2027 · película observada</p>
              <h1>{film.title}</h1>
              <p className="film-deck">
                {film.tmdb?.tagline ??
                  film.tmdb?.overview ??
                  "Ficha procedente del dataset editorial verificable de Runscars."}
              </p>
              {prediction ? (
                <div className="film-score-strip">
                  <div>
                    <span>Consenso</span>
                    <strong>{formatNumber(prediction.score)}</strong>
                    <small>puntos Borda / 100</small>
                  </div>
                  <div>
                    <span>Cobertura</span>
                    <strong>{prediction.coverage}</strong>
                    <small>fuentes aplicables</small>
                  </div>
                  <div>
                    <span>Posición</span>
                    <strong>
                      #
                      {consensusCandidates.findIndex(
                        (candidate) => candidate.id === slug,
                      ) + 1}
                    </strong>
                    <small>
                      media {formatNumber(prediction.average)} · mediana{" "}
                      {formatNumber(prediction.median)}
                    </small>
                  </div>
                </div>
              ) : null}
              {film.alternateTitles.length > 0 ? (
                <div className="film-score-strip">
                  <div>
                    <span>Títulos alternativos</span>
                    <strong>{film.alternateTitles.length}</strong>
                    <small>{film.alternateTitles.join(" · ")}</small>
                  </div>
                </div>
              ) : null}
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

        {prediction ? (
          <div className="film-signal-section prediction-module">
            <div className="module-heading">
              <span className="signal-letter">A</span>
              <div>
                <p className="section-index">PREDICCIONES</p>
                <h2>De las listas al resultado</h2>
                <p>
                  Cada fuente pesa lo mismo. Una ausencia aporta cero; una
                  selección sin orden suma cobertura, pero no puntos.
                </p>
              </div>
            </div>
            <div className="film-source-table">
              {prediction.contributions.map((source) => (
                <div key={source.id}>
                  <span className="source-monogram">
                    {source.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <a href={source.href} rel="noreferrer" target="_blank">
                      {source.name}
                    </a>
                    <small>
                      {source.appearanceKind === "ordered"
                        ? `(10 − ${source.rank} + 1) / 10`
                        : source.appearanceKind === "selection"
                          ? "Selección publicada sin orden"
                          : "Ausente de la publicación"}
                    </small>
                  </div>
                  <span>{formatNumber(source.points * 100)} pts</span>
                  <strong className="source-rank">
                    {source.rank === null ? "—" : `#${source.rank}`}
                  </strong>
                </div>
              ))}
            </div>
            <p className="calculation-proof">
              Media de {prediction.orderedSources} listas ordenadas ={" "}
              <strong>{formatNumber(prediction.score)} / 100</strong>.
            </p>
            <Link className="text-link" href="/temporadas/2027/mejor-pelicula">
              Ver observaciones y clasificación completa
            </Link>
          </div>
        ) : null}

        <div className="film-signal-section reviews-module">
          <div className="module-heading">
            <span className="signal-letter">D</span>
            <div>
              <p className="section-index">PROCEDENCIA</p>
              <h2>Lo que sí está verificado</h2>
              <p>
                Conservamos el título, su relación con la temporada y la
                publicación que permitió identificarla.
              </p>
            </div>
          </div>
          <div className="review-link-list">
            <a href={film.verificationUrl} rel="noreferrer" target="_blank">
              <span>24 jul 2026</span>
              <div>
                <strong>Publicación de comprobación</strong>
                <p>
                  {film.notes ?? "Observación conservada sin estimaciones."}
                </p>
              </div>
              <span className="review-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          </div>
          <Link className="text-link" href="/temporadas/2027/mejor-pelicula">
            Volver a Mejor película
          </Link>
        </div>

        <div className="film-signal-section community-module">
          <div className="module-heading">
            <span className="signal-letter">C</span>
            <div>
              <p className="section-index">COMUNIDAD</p>
              <h2>Tu señal sigue siendo tuya</h2>
            </div>
          </div>
          <FilmWatchPanel filmId={slug} />
        </div>
      </section>
    </main>
  );
}
