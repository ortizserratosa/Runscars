"use client";

import { useActionState } from "react";
import {
  signInAction,
  signInWithGoogleAction,
  signUpAction,
  type AuthFormState,
} from "./actions";
import { PASSWORD_MIN_LENGTH } from "../../lib/auth/validation";
import type { Locale } from "../../lib/i18n/config";

const initialAuthFormState: AuthFormState = {
  message: "",
  tone: "idle",
};

function FormMessage({
  message,
  tone,
}: {
  message: string;
  tone: "error" | "success" | "idle";
}) {
  return (
    <p
      aria-live="polite"
      className={tone === "idle" ? "form-message" : `form-message ${tone}`}
    >
      {message}
    </p>
  );
}

export function SignInForm({ locale }: { locale: Locale }) {
  const en = locale === "en";
  const [state, action, pending] = useActionState(
    signInAction,
    initialAuthFormState,
  );
  return (
    <form action={action} className="account-form">
      <input name="locale" type="hidden" value={locale} />
      <label htmlFor="login-email">{en ? "Email" : "Correo"}</label>
      <input
        autoComplete="email"
        id="login-email"
        name="email"
        required
        type="email"
      />
      <label htmlFor="login-password">{en ? "Password" : "Contraseña"}</label>
      <input
        autoComplete="current-password"
        id="login-password"
        name="password"
        required
        type="password"
      />
      <button className="primary-button dark-button" disabled={pending}>
        {pending
          ? en
            ? "Signing in…"
            : "Entrando…"
          : en
            ? "Sign in"
            : "Entrar"}
      </button>
      <FormMessage message={state.message} tone={state.tone} />
    </form>
  );
}

export function SignUpForm({ locale }: { locale: Locale }) {
  const en = locale === "en";
  const [state, action, pending] = useActionState(
    signUpAction,
    initialAuthFormState,
  );
  return (
    <form action={action} className="account-form">
      <input name="locale" type="hidden" value={locale} />
      <label htmlFor="signup-name">
        {en ? "Display name" : "Nombre visible"}
      </label>
      <input
        autoComplete="name"
        id="signup-name"
        maxLength={60}
        minLength={2}
        name="displayName"
        required
      />
      <label htmlFor="signup-email">{en ? "Email" : "Correo"}</label>
      <input
        autoComplete="email"
        id="signup-email"
        name="email"
        required
        type="email"
      />
      <label htmlFor="signup-password">{en ? "Password" : "Contraseña"}</label>
      <input
        autoComplete="new-password"
        id="signup-password"
        minLength={PASSWORD_MIN_LENGTH}
        name="password"
        required
        type="password"
      />
      <button className="primary-button dark-button" disabled={pending}>
        {pending
          ? en
            ? "Creating…"
            : "Creando…"
          : en
            ? "Create account"
            : "Crear cuenta"}
      </button>
      <FormMessage message={state.message} tone={state.tone} />
    </form>
  );
}

export function GoogleAuthButton({ locale }: { locale: Locale }) {
  const en = locale === "en";
  const [state, action, pending] = useActionState(
    signInWithGoogleAction,
    initialAuthFormState,
  );

  return (
    <form action={action} className="google-auth-form">
      <input name="locale" type="hidden" value={locale} />
      <button className="google-button" disabled={pending} type="submit">
        {pending
          ? en
            ? "Connecting…"
            : "Conectando…"
          : en
            ? "Continue with Google"
            : "Continuar con Google"}
      </button>
      <FormMessage message={state.message} tone={state.tone} />
    </form>
  );
}
