import "server-only";
import { headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_HEADER,
  PATH_HEADER,
  SEARCH_HEADER,
} from "./config";

export async function getRequestLocale() {
  const value = (await headers()).get(LOCALE_HEADER);
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getRequestPath(options?: { includeSearch?: boolean }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get(PATH_HEADER) ?? "/";
  if (!options?.includeSearch) return pathname;
  return `${pathname}${requestHeaders.get(SEARCH_HEADER) ?? ""}`;
}
