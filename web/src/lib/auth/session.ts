import "server-only";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "../environment";
import { createSupabaseAuthServerClient } from "../supabase/server";

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
    redirect("/acceso");
  }
  return current;
}
