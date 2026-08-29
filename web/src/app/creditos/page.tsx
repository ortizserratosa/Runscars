import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getRequestLocale()) === "en";
  return {
    title: en ? "Credits and providers" : "Créditos y proveedores",
    description: en
      ? "Provenance of the film metadata used by Runscars."
      : "Procedencia de los metadatos cinematográficos de Runscars.",
  };
}

export default async function CreditsPage() {
  const locale = await getRequestLocale();
  const en = locale === "en";
  return (
    <main className="page-shell credits-page">
      <div className="breadcrumb">
        <Link href={localizedPath("/", locale)}>{en ? "Home" : "Inicio"}</Link>
        <span>/</span>
        <span>{en ? "Credits" : "Créditos"}</span>
      </div>
      <p className="section-index">{en ? "PROVIDERS" : "PROVEEDORES"}</p>
      <h1>{en ? "Credits and attribution" : "Créditos y atribución"}</h1>
      <section className="tmdb-credit-card">
        <a href="https://www.themoviedb.org/" rel="noreferrer" target="_blank">
          <Image
            alt="The Movie Database (TMDB)"
            height={36}
            src="/tmdb-logo.svg"
            width={274}
          />
        </a>
        <div>
          <h2>{en ? "Film metadata" : "Metadatos cinematográficos"}</h2>
          <p>
            {en
              ? "TMDB provides Runscars with localized titles, synopses, release dates, runtimes, images and people metadata. This information is context only and never determines candidates, predictions, critical reception or Oscar results."
              : "TMDB proporciona a Runscars títulos localizados, sinopsis, fechas, duraciones, imágenes y fichas de personas. Esos datos se muestran como contexto y nunca determinan candidaturas, predicciones, recepción crítica ni resultados de los Oscar."}
          </p>
          <p lang="en">
            This product uses the TMDB API but is not endorsed or certified by
            TMDB.
          </p>
        </div>
      </section>
      <p className="credits-note">
        {en
          ? "The logo is an official TMDB asset and is displayed without changing its colours or proportions."
          : "El logotipo es un recurso oficial aprobado por TMDB y se mantiene sin alterar su color ni proporción."}
      </p>
      <section className="tmdb-credit-card">
        <a
          className="metacritic-credit-wordmark"
          href="https://www.metacritic.com/"
          rel="noreferrer"
          target="_blank"
        >
          Metacritic
        </a>
        <div>
          <h2>{en ? "Metascore context" : "Contexto Metascore"}</h2>
          <p>
            {en
              ? "When a current value is available, Runscars displays the original Metascore and number of critic reviews on the relevant film page. The score links to its Metacritic title page and never participates in Runscars consensus."
              : "Cuando existe un valor vigente, Runscars muestra el Metascore original y el número de críticas en la ficha de la película correspondiente. La puntuación enlaza a su ficha en Metacritic y nunca participa en el consenso de Runscars."}
          </p>
          <p>
            {en
              ? "Metacritic is an independent provider. Its scores are calculated and maintained by Metacritic; this use does not imply endorsement or affiliation."
              : "Metacritic es un proveedor independiente. Sus puntuaciones son calculadas y mantenidas por Metacritic; este uso no implica respaldo ni afiliación."}
          </p>
          <a
            className="text-link"
            href="https://business.tivo.com/misc/metacriticusageguidelines.pdf"
            rel="noreferrer"
            target="_blank"
          >
            {en
              ? "Read the Metacritic usage guidelines ↗"
              : "Consultar las reglas de uso de Metacritic ↗"}
          </a>
        </div>
      </section>
    </main>
  );
}
