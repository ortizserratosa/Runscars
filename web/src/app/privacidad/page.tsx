import type { Metadata } from "next";
import Link from "next/link";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getRequestLocale()) === "en";
  return {
    title: en ? "Privacy and security" : "Privacidad y seguridad",
    description: en
      ? "How Runscars protects accounts, rankings and watch states."
      : "Cómo protegemos las cuentas, rankings y estados de visionado en Runscars.",
  };
}

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const en = locale === "en";
  return (
    <main className="page-shell editorial-page privacy-page">
      <header className="editorial-hero">
        <p className="section-index">
          {en ? "ACCOUNT AND COMMUNITY" : "CUENTA Y COMUNIDAD"}
        </p>
        <h1>{en ? "Privacy and security." : "Privacidad y seguridad."}</h1>
        <p>
          {en
            ? "Runscars is designed to save your Oscar ballot without turning your personal data into part of the show."
            : "Runscars está pensado para guardar tu quiniela sin convertir tus datos personales en parte del espectáculo."}
        </p>
      </header>

      <div className="privacy-grid">
        <section className="editorial-card">
          <p className="section-index">{en ? "ACCOUNTS" : "CUENTAS"}</p>
          <h2>{en ? "A familiar sign-in" : "Un acceso reconocible"}</h2>
          <p>
            {en
              ? "Accounts are managed with Supabase Auth. You can confirm your email address or sign in with Google. New passwords must contain at least 12 characters and are never visible to Runscars."
              : "Las cuentas se gestionan con Supabase Auth. Puedes confirmar tu correo o entrar con Google. Las contraseñas nuevas deben tener al menos 12 caracteres y nunca se muestran en Runscars."}
          </p>
          <p>
            {en
              ? "Your email address is used to authenticate you. It is not published on your profile or included in shared cards."
              : "El correo se usa para autenticarte, pero no se publica en tu perfil ni forma parte de las tarjetas compartidas."}
          </p>
        </section>

        <section className="editorial-card">
          <p className="section-index">{en ? "CONTROL" : "CONTROL"}</p>
          <h2>{en ? "You decide what is public" : "Tú decides qué sale"}</h2>
          <p>
            {en
              ? "Profiles and rankings are private by default. Only a ballot published from a public profile can appear in Community and share its watch states."
              : "Los perfiles y rankings empiezan siendo privados. Solo una quiniela publicada en un perfil público puede aparecer en Comunidad y compartir sus estados de visionado."}
          </p>
          <p>
            {en
              ? "Only the states of films included in that ranking are shown: watched, not watched or unmarked. Watch states outside public rankings are never exposed."
              : "Solo se muestran los estados de las películas incluidas en ese ranking: vista, no vista o no indicada. Nunca exponemos estados de películas ajenas a rankings públicos."}
          </p>
        </section>

        <section className="editorial-card">
          <p className="section-index">{en ? "PROTECTION" : "PROTECCIÓN"}</p>
          <h2>{en ? "Several safeguards" : "Varias barreras"}</h2>
          <p>
            {en
              ? "Secure cookies preserve your session and the server checks every action again. PostgreSQL Row Level Security prevents accounts from reading or changing another person's private profile, rankings or watch states. Email confirmation and rate limits also protect access."
              : "La sesión se conserva con cookies seguras y el servidor vuelve a comprobar cada acción. Las políticas RLS de PostgreSQL impiden leer o modificar perfiles, rankings y visionados de otras cuentas. También aplicamos confirmación de correo y límites de frecuencia al acceso."}
          </p>
        </section>

        <section className="editorial-card">
          <p className="section-index">{en ? "YOUR DATA" : "TUS DATOS"}</p>
          <h2>
            {en ? "Your account remains yours" : "Tu cuenta sigue siendo tuya"}
          </h2>
          <p>
            {en
              ? "You can export your data or delete your account and its content from your account page. We do not sell personal data or use APIs to post automatically on social media: sharing a ballot always begins with an explicit action from you."
              : "Puedes exportar tus datos o eliminar la cuenta y su contenido desde tu espacio personal. No vendemos datos ni integramos APIs para publicar automáticamente en redes sociales: compartir una quiniela siempre empieza por una acción explícita tuya."}
          </p>
        </section>

        <section className="editorial-card">
          <p className="section-index">{en ? "COOKIES" : "COOKIES"}</p>
          <h2>{en ? "Only what the service needs" : "Solo las necesarias"}</h2>
          <p>
            {en
              ? "Runscars uses essential cookies for authentication, security and your language choice. Vercel Web Analytics and Speed Insights measure aggregate usage and performance without adding advertising trackers."
              : "Runscars utiliza cookies necesarias para autenticación, seguridad y elección de idioma. Vercel Web Analytics y Speed Insights miden uso agregado y rendimiento sin añadir rastreadores publicitarios."}
          </p>
        </section>

        <section className="editorial-card">
          <p className="section-index">{en ? "PROCESSORS" : "PROVEEDORES"}</p>
          <h2>{en ? "Services we rely on" : "Servicios que utilizamos"}</h2>
          <p>
            {en
              ? "Supabase processes account and database data, Vercel hosts the application and Google processes data only when you choose Google sign-in. Their own privacy terms also apply to those services."
              : "Supabase procesa las cuentas y la base de datos, Vercel aloja la aplicación y Google procesa datos únicamente cuando eliges su acceso. Sus propias políticas de privacidad también se aplican a esos servicios."}
          </p>
        </section>

        <section className="editorial-card">
          <p className="section-index">{en ? "CONTACT" : "CONTACTO"}</p>
          <h2>{en ? "Questions and rights" : "Consultas y derechos"}</h2>
          <p>
            {en
              ? "For privacy questions or requests that cannot be completed from your account, email "
              : "Para consultas de privacidad o solicitudes que no puedas completar desde tu cuenta, escribe a "}
            <a href="mailto:ortizserratosa@gmail.com">
              ortizserratosa@gmail.com
            </a>
            .
          </p>
          <p>
            <Link href={localizedPath("/terminos", locale)}>
              {en ? "Read the terms of use →" : "Leer las condiciones de uso →"}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
