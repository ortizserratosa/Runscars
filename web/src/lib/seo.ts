import type { Metadata } from "next";
import { localeTag, localizedPath, type Locale } from "./i18n/config";

export const SITE_NAME = "Runscars";
export const SOCIAL_IMAGE_PATH = "/runscars-social-v1.png";

export function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    return new URL(configured ?? "http://localhost:3000").origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function absoluteUrl(path: string) {
  return new URL(path, `${siteOrigin()}/`).toString();
}

export function localizedAlternates(path: string) {
  return {
    es: localizedPath(path, "es"),
    en: localizedPath(path, "en"),
    "x-default": localizedPath(path, "es"),
  };
}

export function conciseDescription(value: string, maximumLength = 160) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximumLength) return normalized;
  const truncated = normalized.slice(0, maximumLength - 1);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, Math.max(lastSpace, maximumLength - 24))}…`;
}

export function buildLocalizedMetadata({
  locale,
  path,
  title,
  description,
  type = "website",
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  type?: "website" | "profile";
}): Metadata {
  const canonical = localizedPath(path, locale);
  const socialTitle = `${title} | ${SITE_NAME}`;
  const image = absoluteUrl(SOCIAL_IMAGE_PATH);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: localizedAlternates(path),
    },
    openGraph: {
      title: socialTitle,
      description,
      type,
      url: canonical,
      siteName: SITE_NAME,
      locale: locale === "en" ? "en_GB" : "es_ES",
      alternateLocale: locale === "en" ? ["es_ES"] : ["en_GB"],
      images: [
        {
          url: image,
          width: 1680,
          height: 945,
          alt: socialTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [image],
    },
    other: {
      "content-language": localeTag(locale),
    },
  };
}
