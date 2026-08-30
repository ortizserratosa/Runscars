import { NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  isLocale,
  localizedPath,
  LOCALE_COOKIE,
} from "../../../lib/i18n/config";

function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function requestOrigin(request: Request, requestUrl: URL) {
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim();
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : requestUrl.protocol.slice(0, -1);
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",", 1)[0]
    ?.trim();
  const host = forwardedHost ?? request.headers.get("host") ?? requestUrl.host;

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return requestUrl.origin;
  }
}

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestedLocale = requestUrl.searchParams.get("locale");
  const locale = isLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;
  const returnTo = safeReturnPath(requestUrl.searchParams.get("returnTo"));
  const response = NextResponse.redirect(
    new URL(
      localizedPath(returnTo, locale),
      requestOrigin(request, requestUrl),
    ),
  );
  response.cookies.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: requestUrl.protocol === "https:",
  });
  return response;
}
