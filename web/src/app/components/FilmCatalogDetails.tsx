import Image from "next/image";
import Link from "next/link";
import type {
  CatalogCredit,
  FilmCatalogDetail,
} from "../../lib/repositories/catalog";
import { tmdbImageUrl } from "../../lib/tmdb/images";
import { localeTag, localizedPath, type Locale } from "../../lib/i18n/config";

function CreditList({
  credits,
  title,
  locale,
}: {
  credits: CatalogCredit[];
  title: string;
  locale: Locale;
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
              href={localizedPath(`/personas/${credit.personId}`, locale)}
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

export function FilmCatalogDetails({
  film,
  locale,
}: {
  film: FilmCatalogDetail;
  locale: Locale;
}) {
  const en = locale === "en";
  if (!film.tmdb) return null;

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
          <p className="section-index">
            {en ? "ABOUT THE FILM" : "SOBRE LA PELÍCULA"}
          </p>
          <h2>{en ? "Cast and film details" : "Reparto y ficha técnica"}</h2>
        </div>
      </div>

      {film.tmdb.overview ? (
        <p className="catalog-overview">{film.tmdb.overview}</p>
      ) : null}

      <dl className="catalog-facts">
        {originalDiffers ? (
          <div>
            <dt>{en ? "Original title" : "Título original"}</dt>
            <dd>{film.tmdb.originalTitle}</dd>
          </div>
        ) : null}
        {film.tmdb.runtime ? (
          <div>
            <dt>{en ? "Runtime" : "Duración"}</dt>
            <dd>{film.tmdb.runtime} min</dd>
          </div>
        ) : null}
        {film.tmdb.originalLanguage ? (
          <div>
            <dt>{en ? "Original language" : "Idioma original"}</dt>
            <dd>{film.tmdb.originalLanguage.toUpperCase()}</dd>
          </div>
        ) : null}
        {film.tmdb.genres.length > 0 ? (
          <div>
            <dt>{en ? "Genres" : "Géneros"}</dt>
            <dd>{film.tmdb.genres.map((genre) => genre.name).join(" · ")}</dd>
          </div>
        ) : null}
      </dl>

      <CreditList
        credits={cast}
        locale={locale}
        title={en ? "Cast" : "Reparto"}
      />
      <CreditList
        credits={crew}
        locale={locale}
        title={en ? "Selected crew" : "Equipo seleccionado"}
      />

      <p className="catalog-provenance">
        {en ? "Captured" : "Captura"}:{" "}
        <time dateTime={film.tmdb.fetchedAt}>
          {new Intl.DateTimeFormat(localeTag(locale), {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(new Date(film.tmdb.fetchedAt))}
        </time>
        .{" "}
        <a href={film.tmdb.url} rel="noreferrer" target="_blank">
          {en ? "View on TMDB ↗" : "Comprobar en TMDB ↗"}
        </a>
      </p>
    </section>
  );
}
