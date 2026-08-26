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
    </main>
  );
}
