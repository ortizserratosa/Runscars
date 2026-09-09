import "server-only";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "../environment";
import { createSupabaseAuthServerClient } from "../supabase/server";
import { getRequestLocale, getRequestPath } from "../i18n/server";
import { localizedPath } from "../i18n/config";
import { safeReturnPath } from "./return-path";

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseAuthServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }

  return { supabase, user: data.user };
}

export async function requireCurrentUser() {
  const current = await getCurrentUser();
  if (!current) {
    const [locale, path] = await Promise.all([
      getRequestLocale(),
      getRequestPath({ includeSearch: true }),
    ]);
    redirect(
      `${localizedPath("/acceso", locale)}?next=${encodeURIComponent(safeReturnPath(path))}`,
    );
  }
  return current;
}
