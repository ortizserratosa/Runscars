"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  PASSWORD_MIN_LENGTH,
  signInSchema,
  signUpSchema,
} from "../../lib/auth/validation";
import { createSupabaseAuthServerClient } from "../../lib/supabase/server";
import { isLocale, localizedPath, type Locale } from "../../lib/i18n/config";

export type AuthFormState = {
  message: string;
  tone: "error" | "success" | "idle";
};

function formLocale(formData: FormData): Locale {
  const value = formData.get("locale");
  return typeof value === "string" && isLocale(value) ? value : "es";
}

async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Continúa con los encabezados validados de la petición.
    }
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const safeHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(host)
    ? host
    : "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") === "https" ? "https" : "http";
  return `${protocol}://${safeHost}`;
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = formLocale(formData);
  const en = locale === "en";
  const fields = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!fields.success) {
    return {
      message: en
        ? "Check your email and password."
        : "Revisa el correo y la contraseña.",
      tone: "error",
    };
  }

  const supabase = await createSupabaseAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword(fields.data);
  if (error) {
    return {
      message: en
        ? "We could not sign you in with those credentials."
        : "No hemos podido iniciar sesión con esas credenciales.",
      tone: "error",
    };
  }

  redirect(localizedPath("/cuenta", locale));
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = formLocale(formData);
  const en = locale === "en";
  if (process.env.NEXT_PUBLIC_EMAIL_SIGNUP_ENABLED !== "true") {
    return {
      message: en
        ? "New email registrations are paused during the public beta. Continue with Google instead."
        : "Las altas nuevas por correo están pausadas durante la beta pública. Continúa con Google.",
      tone: "error",
    };
  }
  const fields = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!fields.success) {
    return {
      message: en
        ? `Enter a name, a valid email address and a password of at least ${PASSWORD_MIN_LENGTH} characters.`
        : `Indica un nombre, un correo válido y una contraseña de al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
      tone: "error",
    };
  }

  const supabase = await createSupabaseAuthServerClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: fields.data.email,
    password: fields.data.password,
    options: {
      data: { display_name: fields.data.displayName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(localizedPath("/cuenta", locale))}`,
    },
  });

  if (error) {
    return {
      message: en
        ? "We could not create the account. The email address may already be registered."
        : "No hemos podido crear la cuenta. Puede que el correo ya exista.",
      tone: "error",
    };
  }
  if (data.session) {
    redirect(localizedPath("/cuenta", locale));
  }

  return {
    message: en
      ? "Account created. Check your email to confirm access before signing in."
      : "Cuenta creada. Revisa tu correo para confirmar el acceso antes de entrar.",
    tone: "success",
  };
}

export async function signInWithGoogleAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  void _previous;
  const locale = formLocale(formData);
  const en = locale === "en";
  const supabase = await createSupabaseAuthServerClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(localizedPath("/cuenta", locale))}`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    return {
      message: en
        ? "Google sign-in is not available right now. Use email or try again later."
        : "El acceso con Google aún no está disponible. Prueba con correo o inténtalo más tarde.",
      tone: "error",
    };
  }

  redirect(data.url);
}

export async function signOutAction(formData: FormData) {
  const locale = formLocale(formData);
  const supabase = await createSupabaseAuthServerClient();
  await supabase.auth.signOut();
  redirect(localizedPath("/", locale));
}
