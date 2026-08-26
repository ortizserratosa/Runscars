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

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestedLocale = requestUrl.searchParams.get("locale");
  const locale = isLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;
  const returnTo = safeReturnPath(requestUrl.searchParams.get("returnTo"));
  const response = NextResponse.redirect(
    new URL(localizedPath(returnTo, locale), requestUrl.origin),
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
