import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmCatalogDetails } from "../../components/FilmCatalogDetails";
import { FilmWatchPanel } from "../../components/FilmWatchPanel";
import { MetacriticScoreCard } from "../../components/MetacriticScoreCard";
import { Movement } from "../../components/Movement";
import { PosterBlock } from "../../components/PosterBlock";
import {
  getFilmCatalogDetail,
  listFixtureFilmIds,
} from "../../../lib/repositories/catalog";
import {
  getFilmMetacriticScore,
  getFilmPredictions,
} from "../../../lib/repositories/signals";
import { localizedCategoryName } from "../../../lib/i18n/categories";
import {
  localeTag,
  localizedPath,
  type Locale,
} from "../../../lib/i18n/config";
import { getRequestLocale } from "../../../lib/i18n/server";

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
  const locale = await getRequestLocale();
  const en = locale === "en";
  const film = await getFilmCatalogDetail(slug, en ? "en-US" : "es-ES");
  if (!film) return { title: en ? "Film not found" : "Película no encontrada" };
  return {
    title: film.title,
    description: en
      ? `Predictions and verifiable provenance for ${film.title} in the 2027 Oscar season.`
      : `Predicciones y procedencia verificable de ${film.title} para Oscar 2027.`,
  };
}

function formatNumber(value: number | null, locale: Locale, digits = 1) {
  return value === null
    ? "—"
    : value.toLocaleString(localeTag(locale), {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}

function dateLabel(value: string | null, locale: Locale) {
  if (!value)
    return locale === "en" ? "Date not provided" : "Fecha no indicada";
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value));
}

export default async function FilmPage({ params }: FilmPageProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const en = locale === "en";
  const film = await getFilmCatalogDetail(slug, en ? "en-US" : "es-ES");
  if (!film) notFound();

  const [predictions, metacriticScore] = await Promise.all([
    getFilmPredictions(slug),
    getFilmMetacriticScore(slug),
  ]);
  const primaryPrediction =
    predictions.find(
      (prediction) => prediction.categoryId === "best-picture",
    ) ??
    predictions[0] ??
    null;
  const releaseDate = film.tmdb?.releaseDate ?? film.editorialReleaseDate;
  const releaseStatus =
    film.releaseStatus === "released"
      ? en
        ? "Released"
        : "Estrenada"
      : en
        ? "Upcoming"
        : "Próximo estreno";

  return (
    <main>
      <section className="film-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href={localizedPath("/", locale)}>
              {en ? "Home" : "Inicio"}
            </Link>
            <span>/</span>
            <Link href={localizedPath("/temporadas/2027", locale)}>
              Oscar 2027
            </Link>
            <span>/</span>
            <span>{en ? "Films" : "Películas"}</span>
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
                <span>{dateLabel(releaseDate, locale)}</span>
              </div>
              <p className="kicker">
                {en
                  ? "Oscar 2027 · tracked film"
                  : "Oscar 2027 · película observada"}
              </p>
              <h1>{film.title}</h1>
              <p className="film-deck">
                {film.tmdb?.tagline ??
                  film.tmdb?.overview ??
                  (en
                    ? "Editorial film page connected to the season's verifiable signals."
                    : "Ficha editorial enlazada con las señales verificables de la temporada.")}
              </p>
              {primaryPrediction ? (
                <div className="film-score-strip">
                  <div>
                    <span>{en ? "Consensus" : "Consenso"}</span>
                    <strong>
                      {formatNumber(
                        primaryPrediction.candidate.scoreOutOf100,
                        locale,
                      )}
                    </strong>
                    <small>
                      {en
                        ? "consensus points / 100"
                        : "puntos de consenso / 100"}
                    </small>
                  </div>
                  <div>
                    <span>{en ? "Coverage" : "Cobertura"}</span>
                    <strong>
                      {primaryPrediction.candidate.appearances}/
                      {primaryPrediction.candidate.applicableSourceCount}
                    </strong>
                    <small>
                      {en ? "applicable sources" : "fuentes aplicables"}
                    </small>
                  </div>
                  <div>
                    <span>{en ? "Position" : "Posición"}</span>
                    <strong>#{primaryPrediction.candidate.position}</strong>
                    <small>
                      {localizedCategoryName(
                        locale,
                        primaryPrediction.categoryId,
                        primaryPrediction.categoryName,
                      )}{" "}
                      · {en ? "update from" : "actualización del"}{" "}
                      {dateLabel(primaryPrediction.lockedAt, locale)}
                    </small>
                  </div>
                </div>
              ) : null}
              <p className="metadata-note">
                {film.tmdb
                  ? en
                    ? "Metadata and images are served from the local cache; TMDB does not influence Oscar signals."
                    : "Metadatos e imágenes servidos desde la caché local; TMDB no interviene en las señales Oscar."
                  : en
                    ? "No TMDB capture is available; the verifiable editorial film page is preserved."
                    : "Sin captura TMDB disponible; se conserva la ficha editorial verificable."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell film-content">
        <FilmCatalogDetails film={film} locale={locale} />

        {metacriticScore ? (
          <MetacriticScoreCard locale={locale} score={metacriticScore} />
        ) : null}

        {predictions.length ? (
          <div className="film-signal-section prediction-module">
            <div className="module-heading">
              <span className="signal-letter">A</span>
              <div>
                <p className="section-index">
                  {en ? "CURRENT PREDICTIONS" : "PREDICCIONES VIGENTES"}
                </p>
                <h2>
                  {en
                    ? "The same reading as on every category page"
                    : "La misma lectura que en cada categoría"}
                </h2>
                <p>
                  {en
                    ? "Position, movement and sources come from the latest update for each race."
                    : "Posición, movimiento y fuentes proceden de la última actualización de cada carrera."}
                </p>
              </div>
            </div>
            <div className="film-category-predictions">
              {predictions.map((prediction) => (
                <article key={prediction.categoryId}>
                  <div className="film-category-heading">
                    <div>
                      <p className="section-index">
                        {en ? "UPDATE FROM" : "ACTUALIZACIÓN DEL"}{" "}
                        {dateLabel(prediction.lockedAt, locale)}
                      </p>
                      <h3>
                        {localizedCategoryName(
                          locale,
                          prediction.categoryId,
                          prediction.categoryName,
                        )}
                      </h3>
                    </div>
                    <div className="film-category-position">
                      <strong>#{prediction.candidate.position}</strong>
                      <Movement
                        locale={locale}
                        value={prediction.candidate.movement}
                      />
                    </div>
                  </div>
                  <div className="film-source-table">
                    {prediction.candidate.sourceContributions.map((source) => (
                      <div key={source.sourceId}>
                        <span className="source-monogram">
                          {source.sourceName.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <Link
                            href={localizedPath(
                              `/fuentes/${source.sourceId}`,
                              locale,
                            )}
                          >
                            {source.sourceName}
                          </Link>
                          <small>
                            {source.publishedAt
                              ? `${en ? "Published" : "Publicada"} ${dateLabel(source.publishedAt, locale)}`
                              : en
                                ? "Verified publication"
                                : "Publicación verificada"}
                          </small>
                        </div>
                        <span>
                          {formatNumber(source.points * 100, locale, 2)} pts
                        </span>
                        <strong className="source-rank">
                          {source.appearanceKind === "ordered"
                            ? `#${source.rank}`
                            : source.appearanceKind === "selection"
                              ? en
                                ? "SEL."
                                : "SEL."
                              : "—"}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <p className="calculation-proof">
                    {en ? "Consensus" : "Consenso"}:{" "}
                    <strong>
                      {formatNumber(prediction.candidate.scoreOutOf100, locale)}{" "}
                      / 100
                    </strong>{" "}
                    · {en ? "coverage" : "cobertura"}{" "}
                    {prediction.candidate.appearances}/
                    {prediction.candidate.applicableSourceCount}.
                  </p>
                  <Link
                    className="text-link"
                    href={localizedPath(
                      `/temporadas/2027/${prediction.categorySlug}`,
                      locale,
                    )}
                  >
                    {en
                      ? "Open full ranking and calculation"
                      : "Abrir clasificación y cálculo completo"}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className="film-signal-section reviews-module">
          <div className="module-heading">
            <span className="signal-letter">D</span>
            <div>
              <p className="section-index">
                {en ? "PROVENANCE" : "PROCEDENCIA"}
              </p>
              <h2>
                {en
                  ? "Verified editorial identity"
                  : "Identidad editorial comprobada"}
              </h2>
              <p>
                {en
                  ? "The film page preserves the publication used to identify the film within the season."
                  : "La ficha conserva la publicación que permitió identificar la película dentro de la temporada."}
              </p>
            </div>
          </div>
          <div className="review-link-list">
            <a href={film.verificationUrl} rel="noreferrer" target="_blank">
              <span>{en ? "Source" : "Fuente"}</span>
              <div>
                <strong>
                  {en
                    ? "Verification publication"
                    : "Publicación de comprobación"}
                </strong>
                <p>
                  {film.notes ??
                    (en
                      ? "Editorial observation preserved."
                      : "Observación editorial conservada.")}
                </p>
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
              <p className="section-index">
                {en ? "YOUR RANKING" : "TU RANKING"}
              </p>
              <h2>{en ? "Your personal ballot" : "Tu quiniela personal"}</h2>
            </div>
          </div>
          <FilmWatchPanel filmId={slug} />
        </div>
      </section>
    </main>
  );
}
