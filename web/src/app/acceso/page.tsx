import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth/session";
import { loginDestination, safeReturnPath } from "../../lib/auth/return-path";
import { getRequestLocale } from "../../lib/i18n/server";
import { GoogleAuthButton, SignInForm, SignUpForm } from "./AuthForms";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getRequestLocale()) === "en";
  return {
    title: en ? "Sign in" : "Acceso",
    description: en
      ? "Access your Runscars profile, watch states and rankings."
      : "Accede a tu perfil, visionados y rankings de Runscars.",
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeReturnPath((await searchParams).next);
  const locale = await getRequestLocale();
  const en = locale === "en";
  const emailSignupEnabled =
    process.env.NEXT_PUBLIC_EMAIL_SIGNUP_ENABLED === "true";
  if (await getCurrentUser()) {
    redirect(loginDestination(next, locale));
  }

  return (
    <main className="page-shell account-page">
      <header className="account-hero">
        <p className="section-index">{en ? "COMMUNITY" : "COMUNIDAD"}</p>
        <h1>{en ? "Your season, in order." : "Tu temporada, en orden."}</h1>
        <p>
          {en
            ? "Keep track of the films you’ve seen, rank your favourites and share your Oscar predictions."
            : "Lleva la cuenta de las películas que has visto, ordena tus favoritas y comparte tus predicciones Oscar."}
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
        <GoogleAuthButton locale={locale} next={next} />
      </section>
      <div className="auth-grid">
        <section>
          <p className="section-index">
            {en ? "I HAVE AN ACCOUNT" : "YA TENGO CUENTA"}
          </p>
          <h2>{en ? "Sign in" : "Entrar"}</h2>
          <SignInForm locale={locale} next={next} />
        </section>
        <section>
          <p className="section-index">{en ? "FIRST TIME" : "PRIMERA VEZ"}</p>
          <h2>{en ? "Create an account" : "Crear cuenta"}</h2>
          {emailSignupEnabled ? (
            <SignUpForm locale={locale} next={next} />
          ) : (
            <div className="account-form">
              <p>
                {en
                  ? "Create your account with Google. If you already have an email account, you can sign in with it."
                  : "Crea tu cuenta con Google. Si ya tienes una cuenta con correo y contraseña, puedes seguir entrando con ella."}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
