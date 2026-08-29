import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth/session";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { GoogleAuthButton, SignInForm, SignUpForm } from "./AuthForms";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getRequestLocale()) === "en";
  return {
    title: en ? "Sign in" : "Acceso",
    description: en
      ? "Access your Runscars profile, watch states and rankings."
      : "Accede a tu perfil, visionados y rankings de Runscars.",
  };
}

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const locale = await getRequestLocale();
  const en = locale === "en";
  const emailSignupEnabled =
    process.env.NEXT_PUBLIC_EMAIL_SIGNUP_ENABLED === "true";
  if (await getCurrentUser()) {
    redirect(localizedPath("/cuenta", locale));
  }

  return (
    <main className="page-shell account-page">
      <header className="account-hero">
        <p className="section-index">{en ? "COMMUNITY" : "COMUNIDAD"}</p>
        <h1>{en ? "Your season, in order." : "Tu temporada, en orden."}</h1>
        <p>
          {en
            ? "Your watch states and rankings never affect professional consensus. You decide what stays private and what you share."
            : "Tus visionados y rankings nunca alteran el consenso profesional. Tú decides qué se mantiene privado y qué compartes."}
        </p>
      </header>
      <section className="auth-provider-card">
        <div>
          <p className="section-index">
            {en ? "QUICK ACCESS" : "ACCESO RÁPIDO"}
          </p>
          <h2>{en ? "Sign in with Google" : "Entra con Google"}</h2>
          <p>
            {en
              ? "Google handles sign-in, so you do not need to create another password for Runscars."
              : "Google gestiona el inicio de sesión y no tienes que crear otra contraseña para Runscars."}
          </p>
        </div>
        <GoogleAuthButton locale={locale} />
      </section>
      <div className="auth-grid">
        <section>
          <p className="section-index">
            {en ? "I HAVE AN ACCOUNT" : "YA TENGO CUENTA"}
          </p>
          <h2>{en ? "Sign in" : "Entrar"}</h2>
          <SignInForm locale={locale} />
        </section>
        <section>
          <p className="section-index">{en ? "FIRST TIME" : "PRIMERA VEZ"}</p>
          <h2>{en ? "Create an account" : "Crear cuenta"}</h2>
          {emailSignupEnabled ? (
            <SignUpForm locale={locale} />
          ) : (
            <div className="account-form">
              <p>
                {en
                  ? "During the public beta, new accounts are created with Google. Email sign-in remains available for existing accounts."
                  : "Durante la beta pública, las cuentas nuevas se crean con Google. El acceso por correo sigue disponible para cuentas existentes."}
              </p>
              <p className="form-message">
                {en
                  ? "This avoids relying on a shared confirmation-email service while Runscars prepares its own transactional mail."
                  : "Así evitamos depender de un servicio compartido de confirmación mientras Runscars prepara su correo transaccional propio."}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
