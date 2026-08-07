"use client";

import { useActionState } from "react";
import { signInAction, signUpAction, type AuthFormState } from "./actions";

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

export function SignInForm() {
  const [state, action, pending] = useActionState(
    signInAction,
    initialAuthFormState,
  );
  return (
    <form action={action} className="account-form">
      <label htmlFor="login-email">Correo</label>
      <input
        autoComplete="email"
        id="login-email"
        name="email"
        required
        type="email"
      />
      <label htmlFor="login-password">Contraseña</label>
      <input
        autoComplete="current-password"
        id="login-password"
        minLength={8}
        name="password"
        required
        type="password"
      />
      <button className="primary-button dark-button" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <FormMessage message={state.message} tone={state.tone} />
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(
    signUpAction,
    initialAuthFormState,
  );
  return (
    <form action={action} className="account-form">
      <label htmlFor="signup-name">Nombre visible</label>
      <input
        autoComplete="name"
        id="signup-name"
        maxLength={60}
        minLength={2}
        name="displayName"
        required
      />
      <label htmlFor="signup-email">Correo</label>
      <input
        autoComplete="email"
        id="signup-email"
        name="email"
        required
        type="email"
      />
      <label htmlFor="signup-password">Contraseña</label>
      <input
        autoComplete="new-password"
        id="signup-password"
        minLength={8}
        name="password"
        required
        type="password"
      />
      <button className="primary-button dark-button" disabled={pending}>
        {pending ? "Creando…" : "Crear cuenta"}
      </button>
      <FormMessage message={state.message} tone={state.tone} />
    </form>
  );
}
