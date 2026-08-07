import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth/session";
import { SignInForm, SignUpForm } from "./AuthForms";

export const metadata: Metadata = {
  title: "Acceso",
  description: "Accede a tu perfil, visionados y rankings de Runscars.",
};

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  if (await getCurrentUser()) {
    redirect("/cuenta");
  }

  return (
    <main className="page-shell account-page">
      <header className="account-hero">
        <p className="section-index">COMUNIDAD</p>
        <h1>Tu temporada, en orden.</h1>
        <p>
          Tus visionados y rankings nunca alteran el consenso profesional. Tú
          decides qué se mantiene privado y qué compartes.
        </p>
      </header>
      <div className="auth-grid">
        <section>
          <p className="section-index">YA TENGO CUENTA</p>
          <h2>Entrar</h2>
          <SignInForm />
        </section>
        <section>
          <p className="section-index">PRIMERA VEZ</p>
          <h2>Crear cuenta</h2>
          <SignUpForm />
        </section>
      </div>
    </main>
  );
}
