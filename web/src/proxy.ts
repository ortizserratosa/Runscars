import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  localeFromPathname,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  PATH_HEADER,
  SEARCH_HEADER,
  stripLocalePrefix,
} from "./lib/i18n/config";
import { updateSupabaseSessionWithResponse } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathLocale = localeFromPathname(pathname);

  if (pathLocale === "es") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = stripLocalePrefix(pathname);
    const response = NextResponse.redirect(redirectUrl, 308);
    response.cookies.set(LOCALE_COOKIE, "es", {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
    return response;
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (!pathLocale && cookieLocale === "en") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname === "/" ? "/en" : `/en${pathname}`;
    return NextResponse.redirect(redirectUrl, 307);
  }

  const locale = pathLocale ?? DEFAULT_LOCALE;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  requestHeaders.set(PATH_HEADER, pathname);
  requestHeaders.set(SEARCH_HEADER, request.nextUrl.search);

  const rewriteUrl = pathLocale === "en" ? request.nextUrl.clone() : undefined;
  if (rewriteUrl) rewriteUrl.pathname = stripLocalePrefix(pathname);

  const response = await updateSupabaseSessionWithResponse(request, {
    requestHeaders,
    rewriteUrl,
  });
  if (pathLocale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
