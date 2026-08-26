import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPersonCatalogDetail,
  listCatalogPersonIds,
} from "../../../lib/repositories/catalog";
import { tmdbImageUrl } from "../../../lib/tmdb/images";
import {
  localeTag,
  localizedPath,
  type Locale,
} from "../../../lib/i18n/config";
import { getRequestLocale } from "../../../lib/i18n/server";

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
  const locale = await getRequestLocale();
  const en = locale === "en";
  const person = await getPersonCatalogDetail(slug, en ? "en-US" : "es-ES");
  return person
    ? {
        title: person.name,
        description:
          person.tmdb.biography ??
          (en
            ? `Film profile for ${person.name} on Runscars.`
            : `Ficha cinematográfica de ${person.name} en Runscars.`),
      }
    : { title: en ? "Person not found" : "Persona no encontrada" };
}

function formatDate(value: string | null, locale: Locale) {
  if (!value) {
    return null;
  }
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default async function PersonPage({ params }: PersonPageProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const en = locale === "en";
  const person = await getPersonCatalogDetail(slug, en ? "en-US" : "es-ES");
  if (!person) {
    notFound();
  }

  const profileUrl = tmdbImageUrl(person.tmdb.profilePath, "w342");
  const birthday = formatDate(person.tmdb.birthday, locale);

  return (
    <main>
      <section className="person-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href={localizedPath("/", locale)}>
              {en ? "Home" : "Inicio"}
            </Link>
            <span>/</span>
            <span>{en ? "People" : "Personas"}</span>
          </div>
          <div className="person-hero-grid">
            <div className="person-portrait">
              {profileUrl ? (
                <Image
                  alt={`${en ? "Portrait of" : "Retrato de"} ${person.name}`}
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
                {person.tmdb.knownForDepartment ?? (en ? "Film" : "Cine")}
              </p>
              <h1>{person.name}</h1>
              {person.tmdb.biography ? (
                <p className="person-deck">{person.tmdb.biography}</p>
              ) : (
                <p className="person-deck">
                  {en
                    ? "TMDB does not currently provide a localized biography for this person."
                    : "TMDB no ofrece todavía una biografía localizada para esta persona."}
                </p>
              )}
              <dl className="person-facts">
                {birthday ? (
                  <div>
                    <dt>{en ? "Born" : "Nacimiento"}</dt>
                    <dd>{birthday}</dd>
                  </div>
                ) : null}
                {person.tmdb.placeOfBirth ? (
                  <div>
                    <dt>{en ? "Place" : "Lugar"}</dt>
                    <dd>{person.tmdb.placeOfBirth}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell person-filmography">
        <p className="section-index">{en ? "ON RUNSCARS" : "EN RUNSCARS"}</p>
        <h2>{en ? "Related films" : "Películas relacionadas"}</h2>
        <div>
          {person.films.map((film) => (
            <Link
              href={localizedPath(`/peliculas/${film.id}`, locale)}
              key={film.id}
            >
              <strong>{film.title}</strong>
              <span>{film.roles.join(" · ")}</span>
            </Link>
          ))}
        </div>
        <p className="catalog-provenance">
          {en ? "Metadata captured on" : "Metadatos capturados el"}{" "}
          <time dateTime={person.tmdb.fetchedAt}>
            {formatDate(person.tmdb.fetchedAt.slice(0, 10), locale)}
          </time>
          .{" "}
          <a href={person.tmdb.url} rel="noreferrer" target="_blank">
            {en ? "View on TMDB ↗" : "Comprobar en TMDB ↗"}
          </a>
        </p>
      </section>
    </main>
  );
}
