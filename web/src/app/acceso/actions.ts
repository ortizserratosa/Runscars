"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAuthServerClient } from "../../lib/supabase/server";

export type AuthFormState = {
  message: string;
  tone: "error" | "success" | "idle";
};

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

const signUpSchema = signInSchema.extend({
  displayName: z.string().trim().min(2).max(60),
});

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
  const fields = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!fields.success) {
    return {
      message:
        "Revisa el correo y usa una contraseña de al menos 8 caracteres.",
      tone: "error",
    };
  }

  const supabase = await createSupabaseAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword(fields.data);
  if (error) {
    return {
      message: "No hemos podido iniciar sesión con esas credenciales.",
      tone: "error",
    };
  }

  redirect("/cuenta");
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fields = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!fields.success) {
    return {
      message:
        "Indica un nombre, un correo válido y una contraseña de al menos 8 caracteres.",
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
      emailRedirectTo: `${origin}/auth/callback?next=/cuenta`,
    },
  });

  if (error) {
    return {
      message:
        "No hemos podido crear la cuenta. Puede que el correo ya exista.",
      tone: "error",
    };
  }
  if (data.session) {
    redirect("/cuenta");
  }

  return {
    message:
      "Cuenta creada. Revisa tu correo para confirmar el acceso antes de entrar.",
    tone: "success",
  };
}

export async function signOutAction() {
  const supabase = await createSupabaseAuthServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
