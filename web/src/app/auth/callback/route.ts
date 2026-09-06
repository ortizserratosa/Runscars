import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "../../../lib/supabase/server";

import { safeReturnPath } from "../../../lib/auth/return-path";
import { localeFromPathname, localizedPath } from "../../../lib/i18n/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeReturnPath(url.searchParams.get("next"));
  const locale = localeFromPathname(next) ?? "es";

  if (code) {
    const supabase = await createSupabaseAuthServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL(
      `${localizedPath("/acceso", locale)}?error=confirmacion&next=${encodeURIComponent(next)}`,
      url.origin,
    ),
  );
}
