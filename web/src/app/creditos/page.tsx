import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Créditos y proveedores",
  description: "Procedencia de los metadatos cinematográficos de Runscars.",
};

export default function CreditsPage() {
  return (
    <main className="page-shell credits-page">
      <div className="breadcrumb">
        <Link href="/">Inicio</Link>
        <span>/</span>
        <span>Créditos</span>
      </div>
      <p className="section-index">PROVEEDORES</p>
      <h1>Créditos y atribución</h1>
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
          <h2>Metadatos cinematográficos</h2>
          <p>
            TMDB proporciona a Runscars títulos localizados, sinopsis, fechas,
            duraciones, imágenes y fichas de personas. Esos datos se muestran
            como contexto y nunca determinan candidaturas, predicciones,
            recepción crítica ni resultados de los Oscar.
          </p>
          <p lang="en">
            This product uses the TMDB API but is not endorsed or certified by
            TMDB.
          </p>
        </div>
      </section>
      <p className="credits-note">
        El logotipo es un recurso oficial aprobado por TMDB y se mantiene sin
        alterar su color ni proporción.
      </p>
    </main>
  );
}
