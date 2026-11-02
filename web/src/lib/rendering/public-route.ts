import { hasSessionCookie } from "../auth/session-cookie";
import {
  DEFAULT_LOCALE,
  isLocale,
  localeFromPathname,
  localizedPath,
  stripLocalePrefix,
} from "../i18n/config";

export const PUBLIC_RENDER_PREFIX = "/public-render";

function isPublicFamily(pathname: string) {
  return pathname === "/" || /^\/(?:peliculas|personas)\/[^/]+$/.test(pathname);
}

export function canonicalPublicRenderPath(pathname: string): string | null {
  const match = pathname.match(/^\/public-render\/([^/]+)(\/.*)?$/);
  if (!match || !isLocale(match[1])) return null;
  const path = match[2] || "/";
  return isPublicFamily(path) ? localizedPath(path, match[1]) : null;
}

// This is a routing decision, never an authentication check. Any supplied
// session, including a malformed/expired one, keeps Supabase's verified SSR path.
export function selectPublicRenderPath({
  method,
  pathname,
  searchParams,
  cookies,
  headers,
}: {
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
  cookies: ReadonlyArray<{ name: string }>;
  headers: Pick<Headers, "has">;
}): string | null {
  if (
    (method !== "GET" && method !== "HEAD") ||
    headers.has("next-action") ||
    headers.has("authorization") ||
    hasSessionCookie(cookies) ||
    cookies.some(({ name }) =>
      ["__prerender_bypass", "__next_preview_data"].includes(name),
    )
  ) {
    return null;
  }

  // Search parameters that can change content stay in the existing dynamic
  // route. RSC's protocol discriminator and inert campaign attribution do not.
  for (const key of searchParams.keys()) {
    if (
      key !== "_rsc" &&
      !key.startsWith("utm_") &&
      !["gclid", "fbclid", "msclkid"].includes(key)
    ) {
      return null;
    }
  }

  const locale = localeFromPathname(pathname) ?? DEFAULT_LOCALE;
  const path = stripLocalePrefix(pathname);
  if (!isPublicFamily(path)) return null;
  return `${PUBLIC_RENDER_PREFIX}/${locale}${path === "/" ? "" : path}`;
}
