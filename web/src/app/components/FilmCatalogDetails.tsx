import Image from "next/image";
import Link from "next/link";
import type {
  CatalogCredit,
  FilmCatalogDetail,
} from "../../lib/repositories/catalog";
import { tmdbImageUrl } from "../../lib/tmdb/images";

function CreditList({
  credits,
  title,
}: {
  credits: CatalogCredit[];
  title: string;
}) {
  if (credits.length === 0) {
    return null;
  }

  return (
    <div className="catalog-credit-group">
      <h3>{title}</h3>
      <div className="catalog-credit-grid">
        {credits.map((credit) => {
          const profileUrl = tmdbImageUrl(credit.profilePath, "w185");
          return (
            <Link
              href={`/personas/${credit.personId}`}
              key={`${credit.personId}-${credit.role}`}
            >
              <span className="credit-portrait">
                {profileUrl ? (
                  <Image alt="" fill sizes="64px" src={profileUrl} />
                ) : (
                  credit.name.slice(0, 1)
                )}
              </span>
              <span>
                <strong>{credit.name}</strong>
                <small>{credit.role}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function FilmCatalogDetails({ film }: { film: FilmCatalogDetail }) {
  if (!film.tmdb) {
    return (
      <section className="film-signal-section catalog-module">
        <div className="module-heading">
          <span className="signal-letter">M</span>
          <div>
            <p className="section-index">METADATOS</p>
            <h2>La ficha sigue disponible</h2>
            <p>
              Este entorno no tiene una captura TMDB vigente. Runscars conserva
              y muestra el dataset editorial sin consultar la API durante la
              visita.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const cast = film.credits
    .filter((credit) => credit.kind === "cast")
    .slice(0, 8);
  const crew = film.credits.filter((credit) => credit.kind === "crew");
  const originalDiffers =
    film.tmdb.originalTitle.toLocaleLowerCase() !==
    film.title.toLocaleLowerCase();

  return (
    <section className="film-signal-section catalog-module">
      <div className="module-heading">
        <span className="signal-letter">M</span>
        <div>
          <p className="section-index">METADATOS CINEMATOGRÁFICOS</p>
          <h2>La película, fuera de la carrera</h2>
          <p>
            Metadatos servidos desde la copia local de Runscars. No participan
            en las predicciones ni en la recepción crítica.
          </p>
        </div>
      </div>

      {film.tmdb.overview ? (
        <p className="catalog-overview">{film.tmdb.overview}</p>
      ) : null}

      <dl className="catalog-facts">
        {originalDiffers ? (
          <div>
            <dt>Título original</dt>
            <dd>{film.tmdb.originalTitle}</dd>
          </div>
        ) : null}
        {film.tmdb.runtime ? (
          <div>
            <dt>Duración</dt>
            <dd>{film.tmdb.runtime} min</dd>
          </div>
        ) : null}
        {film.tmdb.originalLanguage ? (
          <div>
            <dt>Idioma original</dt>
            <dd>{film.tmdb.originalLanguage.toUpperCase()}</dd>
          </div>
        ) : null}
        {film.tmdb.genres.length > 0 ? (
          <div>
            <dt>Géneros</dt>
            <dd>{film.tmdb.genres.map((genre) => genre.name).join(" · ")}</dd>
          </div>
        ) : null}
      </dl>

      <CreditList credits={cast} title="Reparto" />
      <CreditList credits={crew} title="Equipo seleccionado" />

      <p className="catalog-provenance">
        Captura:{" "}
        <time dateTime={film.tmdb.fetchedAt}>
          {new Intl.DateTimeFormat("es-ES", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(new Date(film.tmdb.fetchedAt))}
        </time>
        .{" "}
        <a href={film.tmdb.url} rel="noreferrer" target="_blank">
          Comprobar en TMDB ↗
        </a>
      </p>
    </section>
  );
}
