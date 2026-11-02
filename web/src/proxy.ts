import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  localeFromPathname,
  LOCALE_HEADER,
  PATH_HEADER,
  SEARCH_HEADER,
  stripLocalePrefix,
} from "./lib/i18n/config";
import { updateSupabaseSessionWithResponse } from "./lib/supabase/proxy";
import {
  canonicalPublicRenderPath,
  PUBLIC_RENDER_PREFIX,
  selectPublicRenderPath,
} from "./lib/rendering/public-route";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Internal render URLs are implementation details. An incoming request must
  // use its canonical URL so auth/actions can never enter via the ISR namespace.
  if (
    pathname === PUBLIC_RENDER_PREFIX ||
    pathname.startsWith(`${PUBLIC_RENDER_PREFIX}/`)
  ) {
    const canonical = canonicalPublicRenderPath(pathname);
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      canonical &&
      !request.headers.has("next-action")
    ) {
      const target = request.nextUrl.clone();
      target.pathname = canonical;
      return NextResponse.redirect(target, 308);
    }
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  const pathLocale = localeFromPathname(pathname);

  if (pathLocale === "es") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = stripLocalePrefix(pathname);
    return NextResponse.redirect(redirectUrl, 308);
  }

  const locale = pathLocale ?? DEFAULT_LOCALE;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  requestHeaders.set(PATH_HEADER, pathname);
  requestHeaders.set(SEARCH_HEADER, request.nextUrl.search);

  const publicPath = selectPublicRenderPath({
    method: request.method,
    pathname,
    searchParams: request.nextUrl.searchParams,
    cookies: request.cookies.getAll(),
    headers: request.headers,
  });
  const rewriteUrl =
    publicPath || pathLocale === "en" ? request.nextUrl.clone() : undefined;
  if (rewriteUrl)
    rewriteUrl.pathname = publicPath ?? stripLocalePrefix(pathname);

  const response = await updateSupabaseSessionWithResponse(request, {
    requestHeaders,
    rewriteUrl,
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
