import "server-only";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_HEADER, PATH_HEADER } from "./config";

export async function getRequestLocale() {
  const value = (await headers()).get(LOCALE_HEADER);
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getRequestPath() {
  return (await headers()).get(PATH_HEADER) ?? "/";
}
