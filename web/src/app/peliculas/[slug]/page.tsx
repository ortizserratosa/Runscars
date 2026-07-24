import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PosterBlock } from "../../components/PosterBlock";
import { filmFixtures, findFilmById } from "../../../data/films";

type FilmPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return filmFixtures
    .filter((film) => film.id !== "the-odyssey")
    .map((film) => ({ slug: film.id }));
}

export async function generateMetadata({
  params,
}: FilmPageProps): Promise<Metadata> {
  const { slug } = await params;
  const film = findFilmById(slug);

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
  const film = findFilmById(slug);

  if (!film) {
    notFound();
  }

  const status =
    film.releaseStatus === "released" ? "Estrenada" : "Próximo estreno";
  const date = film.releaseDate
    ? new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${film.releaseDate}T00:00:00Z`))
    : "Fecha no confirmada";

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
                Ficha mínima procedente del dataset verificable de la fase 1. No
                contiene metadatos inventados.
              </p>
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
                Reparto, equipo, sinopsis e imágenes llegarán con el catálogo
                TMDB de la fase 4.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell film-content">
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
      </section>
    </main>
  );
}
