import type { Metadata } from "next";
import Link from "next/link";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getRequestLocale()) === "en";
  return {
    title: en ? "Terms of use" : "Condiciones de uso",
    description: en
      ? "Rules for using Runscars and publishing public Oscar ballots."
      : "Reglas de uso de Runscars y publicación de quinielas públicas.",
  };
}

export default async function TermsPage() {
  const locale = await getRequestLocale();
  const en = locale === "en";
  return (
    <main className="page-shell editorial-page privacy-page">
      <header className="editorial-hero">
        <p className="section-index">{en ? "PUBLIC BETA" : "BETA PÚBLICA"}</p>
        <h1>{en ? "Terms of use." : "Condiciones de uso."}</h1>
        <p>
          {en
            ? "Runscars is an independent editorial project for following the awards season and creating personal Oscar ballots."
            : "Runscars es un proyecto editorial independiente para seguir la temporada de premios y crear quinielas personales de los Oscar."}
        </p>
      </header>

      <div className="privacy-grid">
        <section className="editorial-card">
          <p className="section-index">{en ? "SERVICE" : "SERVICIO"}</p>
          <h2>
            {en ? "Information, not certainty" : "Información, no certeza"}
          </h2>
          <p>
            {en
              ? "Professional rankings, critical scores and market data describe available evidence at a given time. They are not official nominations, guarantees, betting advice or financial advice."
              : "Los rankings profesionales, notas críticas y datos de mercados describen la evidencia disponible en un momento concreto. No son nominaciones oficiales, garantías, asesoramiento de apuestas ni asesoramiento financiero."}
          </p>
        </section>

        <section className="editorial-card">
          <p className="section-index">{en ? "ACCOUNTS" : "CUENTAS"}</p>
          <h2>
            {en ? "Use your own identity" : "Utiliza tu propia identidad"}
          </h2>
          <p>
            {en
              ? "You are responsible for access to your account and for keeping your sign-in method secure. Do not impersonate another person, automate abusive access or attempt to reach private data."
              : "Eres responsable del acceso a tu cuenta y de proteger tu método de inicio de sesión. No suplantes a otra persona, automatices accesos abusivos ni intentes acceder a datos privados."}
          </p>
        </section>

        <section className="editorial-card">
          <p className="section-index">
            {en ? "PUBLIC PROFILES" : "PERFILES PÚBLICOS"}
          </p>
          <h2>{en ? "Publish with care" : "Publica con cuidado"}</h2>
          <p>
            {en
              ? "A public display name, profile address, ballot and related watch states can be viewed and shared by anyone. Do not include unlawful, abusive or third-party personal information in your public identity."
              : "Un nombre visible, dirección de perfil, quiniela y estados de visionado públicos pueden ser vistos y compartidos por cualquier persona. No incluyas información ilícita, abusiva o datos personales de terceros en tu identidad pública."}
          </p>
        </section>

        <section className="editorial-card">
          <p className="section-index">{en ? "SOURCES" : "FUENTES"}</p>
          <h2>
            {en
              ? "Attribution remains attached"
              : "La atribución permanece unida"}
          </h2>
          <p>
            {en
              ? "Film metadata and professional observations belong to their respective providers and publishers. Runscars stores limited factual data, provenance and links; it does not grant rights over the original publications."
              : "Los metadatos cinematográficos y observaciones profesionales pertenecen a sus respectivos proveedores y publicaciones. Runscars conserva datos factuales limitados, procedencia y enlaces; no concede derechos sobre las publicaciones originales."}
          </p>
        </section>

        <section className="editorial-card">
          <p className="section-index">
            {en ? "AVAILABILITY" : "DISPONIBILIDAD"}
          </p>
          <h2>
            {en ? "A service that evolves" : "Un servicio que evoluciona"}
          </h2>
          <p>
            {en
              ? "During the beta, features and data sources may change, pause or be corrected. We protect locked snapshots and provenance, but cannot promise uninterrupted availability of external services."
              : "Durante la beta, las funciones y fuentes pueden cambiar, pausarse o corregirse. Protegemos los snapshots bloqueados y la procedencia, pero no podemos garantizar la disponibilidad ininterrumpida de servicios externos."}
          </p>
        </section>

        <section className="editorial-card">
          <p className="section-index">{en ? "CONTACT" : "CONTACTO"}</p>
          <h2>{en ? "Report a problem" : "Comunica un problema"}</h2>
          <p>
            {en
              ? "To report an attribution, account or content issue, email "
              : "Para comunicar una incidencia de atribución, cuenta o contenido, escribe a "}
            <a href="mailto:ortizserratosa@gmail.com">
              ortizserratosa@gmail.com
            </a>
            .
          </p>
          <p>
            <Link href={localizedPath("/privacidad", locale)}>
              {en
                ? "Read the privacy policy →"
                : "Leer la política de privacidad →"}
            </Link>
          </p>
        </section>
      </div>
      <p className="credits-note">
        {en
          ? "Last updated: 26 August 2026."
          : "Última actualización: 26 de agosto de 2026."}
      </p>
    </main>
  );
}
