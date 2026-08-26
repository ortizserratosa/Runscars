export const SUPPORTED_LOCALES = ["es", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "runscars-locale";
export const LOCALE_HEADER = "x-runscars-locale";
export const PATH_HEADER = "x-runscars-path";

export function isLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function localeTag(locale: Locale) {
  return locale === "en" ? "en-GB" : "es-ES";
}

export function stripLocalePrefix(pathname: string) {
  if (pathname === "/en" || pathname === "/es") return "/";
  if (pathname.startsWith("/en/") || pathname.startsWith("/es/")) {
    return pathname.slice(3) || "/";
  }
  return pathname;
}

export function localizedPath(path: string, locale: Locale) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (
    path.startsWith("/api/") ||
    path.startsWith("/_next/") ||
    /\.[a-z0-9]+(?:[?#]|$)/i.test(path)
  ) {
    return path;
  }

  const match = path.match(/^([^?#]*)(.*)$/);
  const pathname = stripLocalePrefix(match?.[1] || "/");
  const suffix = match?.[2] ?? "";
  if (locale === "es") return `${pathname}${suffix}`;
  return `${pathname === "/" ? "/en" : `/en${pathname}`}${suffix}`;
}

export function localeFromPathname(pathname: string): Locale | null {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/es" || pathname.startsWith("/es/")) return "es";
  return null;
}
