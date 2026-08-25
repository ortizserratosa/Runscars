import Link from "next/link";
import { getCurrentUser } from "../../lib/auth/session";
import { createSupabaseAdminClient } from "../../lib/supabase/server";

export async function AccountNav() {
  let current = null;
  try {
    current = await getCurrentUser();
  } catch {
    current = null;
  }

  let isAdmin = false;
  if (current) {
    try {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("editorial_admins")
        .select("user_id")
        .eq("user_id", current.user.id)
        .maybeSingle();
      isAdmin = Boolean(data);
    } catch {
      isAdmin = false;
    }
  }

  return current ? (
    <span className="account-nav-links">
      {isAdmin ? <Link href="/admin">Admin</Link> : null}
      <Link className="ghost-button compact" href="/cuenta">
        Mi cuenta
      </Link>
    </span>
  ) : (
    <Link className="ghost-button compact" href="/acceso">
      Entrar
    </Link>
  );
}
