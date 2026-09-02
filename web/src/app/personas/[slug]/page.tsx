import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "../../components/JsonLd";
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
import {
  absoluteUrl,
  buildLocalizedMetadata,
  conciseDescription,
} from "../../../lib/seo";

type PersonPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

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
    ? buildLocalizedMetadata({
        locale,
        path: `/personas/${person.id}`,
        title: en
          ? `${person.name}: Films and Oscar Predictions`
          : `${person.name}: películas y predicciones Oscar`,
        description: conciseDescription(
          person.tmdb.biography ??
            (en
              ? `Films, roles and 2027 Oscar context for ${person.name} on Runscars.`
              : `Películas, trabajos y contexto de los Oscar 2027 de ${person.name} en Runscars.`),
        ),
        type: "profile",
      })
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
  const pageUrl = absoluteUrl(localizedPath(`/personas/${person.id}`, locale));
  const personId = `${pageUrl}#person`;
  const sameAs = [
    person.tmdb.url,
    ...(person.tmdb.imdbId
      ? [`https://www.imdb.com/name/${person.tmdb.imdbId}/`]
      : []),
    ...(person.tmdb.homepageUrl ? [person.tmdb.homepageUrl] : []),
  ];

  return (
    <main>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "ProfilePage",
              "@id": `${pageUrl}#webpage`,
              url: pageUrl,
              name: person.name,
              inLanguage: localeTag(locale),
              dateModified: person.tmdb.fetchedAt,
              mainEntity: { "@id": personId },
            },
            {
              "@type": "Person",
              "@id": personId,
              url: pageUrl,
              name: person.name,
              ...(profileUrl ? { image: profileUrl } : {}),
              ...(person.tmdb.biography
                ? { description: person.tmdb.biography }
                : {}),
              ...(person.tmdb.birthday
                ? { birthDate: person.tmdb.birthday }
                : {}),
              ...(person.tmdb.deathday
                ? { deathDate: person.tmdb.deathday }
                : {}),
              ...(person.tmdb.placeOfBirth
                ? { birthPlace: person.tmdb.placeOfBirth }
                : {}),
              ...(person.tmdb.knownForDepartment
                ? { jobTitle: person.tmdb.knownForDepartment }
                : {}),
              sameAs,
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: en ? "Home" : "Inicio",
                  item: absoluteUrl(localizedPath("/", locale)),
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: person.name,
                  item: pageUrl,
                },
              ],
            },
          ],
        }}
      />
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
