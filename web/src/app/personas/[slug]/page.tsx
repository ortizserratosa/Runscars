import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPersonCatalogDetail,
  listCatalogPersonIds,
} from "../../../lib/repositories/catalog";
import { tmdbImageUrl } from "../../../lib/tmdb/images";

type PersonPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return (await listCatalogPersonIds()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PersonPageProps): Promise<Metadata> {
  const { slug } = await params;
  const person = await getPersonCatalogDetail(slug);
  return person
    ? {
        title: person.name,
        description:
          person.tmdb.biography ??
          `Ficha cinematográfica de ${person.name} en Runscars.`,
      }
    : { title: "Persona no encontrada" };
}

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default async function PersonPage({ params }: PersonPageProps) {
  const { slug } = await params;
  const person = await getPersonCatalogDetail(slug);
  if (!person) {
    notFound();
  }

  const profileUrl = tmdbImageUrl(person.tmdb.profilePath, "w342");
  const birthday = formatDate(person.tmdb.birthday);

  return (
    <main>
      <section className="person-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <span>Personas</span>
          </div>
          <div className="person-hero-grid">
            <div className="person-portrait">
              {profileUrl ? (
                <Image
                  alt={`Retrato de ${person.name}`}
                  fill
                  priority
                  sizes="(max-width: 760px) 70vw, 320px"
                  src={profileUrl}
                />
              ) : (
                <span>{person.name.slice(0, 1)}</span>
              )}
            </div>
            <div>
              <p className="kicker">
                {person.tmdb.knownForDepartment ?? "Cine"}
              </p>
              <h1>{person.name}</h1>
              {person.tmdb.biography ? (
                <p className="person-deck">{person.tmdb.biography}</p>
              ) : (
                <p className="person-deck">
                  TMDB no ofrece todavía una biografía localizada para esta
                  persona.
                </p>
              )}
              <dl className="person-facts">
                {birthday ? (
                  <div>
                    <dt>Nacimiento</dt>
                    <dd>{birthday}</dd>
                  </div>
                ) : null}
                {person.tmdb.placeOfBirth ? (
                  <div>
                    <dt>Lugar</dt>
                    <dd>{person.tmdb.placeOfBirth}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell person-filmography">
        <p className="section-index">EN RUNSCARS</p>
        <h2>Películas relacionadas</h2>
        <div>
          {person.films.map((film) => (
            <Link href={`/peliculas/${film.id}`} key={film.id}>
              <strong>{film.title}</strong>
              <span>{film.roles.join(" · ")}</span>
            </Link>
          ))}
        </div>
        <p className="catalog-provenance">
          Metadatos capturados el{" "}
          <time dateTime={person.tmdb.fetchedAt}>
            {formatDate(person.tmdb.fetchedAt.slice(0, 10))}
          </time>
          .{" "}
          <a href={person.tmdb.url} rel="noreferrer" target="_blank">
            Comprobar en TMDB ↗
          </a>
        </p>
      </section>
    </main>
  );
}
