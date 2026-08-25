import "server-only";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "../auth/session";
import { createSupabaseAdminClient } from "../supabase/server";

export async function requireEditorialAdmin() {
  const { user } = await requireCurrentUser();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("editorial_admins")
    .select("user_id,created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  return { admin, user, membership: data };
}
