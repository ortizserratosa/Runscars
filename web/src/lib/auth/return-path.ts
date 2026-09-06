import { localizedPath, type Locale } from "../i18n/config";

/** Keep login destinations on this site, including their filters and cut. */
export function safeReturnPath(value: unknown, fallback = "/cuenta") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://runscars.app");
    if (
      url.origin !== "https://runscars.app" ||
      /^\/(?:en\/)?(?:acceso|auth|api)(?:\/|$)/.test(url.pathname)
    )
      return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function loginDestination(value: unknown, locale: Locale) {
  return localizedPath(safeReturnPath(value), locale);
}
