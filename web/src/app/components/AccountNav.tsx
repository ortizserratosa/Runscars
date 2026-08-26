import Link from "next/link";
import { getCurrentUser } from "../../lib/auth/session";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { createSupabaseAdminClient } from "../../lib/supabase/server";

export async function AccountNav() {
  const locale = await getRequestLocale();
  const en = locale === "en";
  const href = (path: string) => localizedPath(path, locale);
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
      {isAdmin ? <Link href={href("/admin")}>Admin</Link> : null}
      <Link className="ghost-button compact" href={href("/cuenta")}>
        {en ? "My account" : "Mi cuenta"}
      </Link>
    </span>
  ) : (
    <Link className="ghost-button compact" href={href("/acceso")}>
      {en ? "Sign in" : "Entrar"}
    </Link>
  );
}
