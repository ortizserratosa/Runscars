import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { headers } from "next/headers";
import {
  localeTag,
  localizedPath,
  stripLocalePrefix,
} from "../lib/i18n/config";
import { getRequestLocale, getRequestPath } from "../lib/i18n/server";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const [requestHeaders, locale, visiblePath] = await Promise.all([
    headers(),
    getRequestLocale(),
    getRequestPath(),
  ]);
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const requestHost =
    forwardedHost ?? requestHeaders.get("host") ?? "localhost:3000";
  const safeHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(requestHost)
    ? requestHost
    : "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") === "https" ? "https" : "http";
  const origin = `${protocol}://${safeHost}`;
  const english = locale === "en";
  const description = english
    ? "Runscars follows criticism, professional predictions and personal Oscar rankings without mixing the signals."
    : "Runscars sigue crítica, predicciones y rankings de la carrera a los Oscar sin mezclar señales.";
  const title = english
    ? "Runscars · The road to the Oscars"
    : "Runscars · La carrera a los Oscar";
  const socialTitle = english
    ? "Runscars · The road to the Oscars, backed by data."
    : "Runscars · La carrera a los Oscar, datos en mano.";
  const internalPath = stripLocalePrefix(visiblePath);
  const socialImageUrl = new URL("/og-20260830.png", origin).toString();
  const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

  return {
    metadataBase: new URL(origin),
    title: {
      default: title,
      template: "%s · Runscars",
    },
    description,
    alternates: {
      canonical: localizedPath(internalPath, locale),
      languages: {
        es: localizedPath(internalPath, "es"),
        en: localizedPath(internalPath, "en"),
        "x-default": localizedPath(internalPath, "es"),
      },
    },
    robots: {
      index: allowIndexing,
      follow: allowIndexing,
    },
    verification: {
      google: "-DG9WuRmmS-JvJT-S6igJwvwDLONugSKILf30hgmOC0",
    },
    openGraph: {
      title: socialTitle,
      description,
      type: "website",
      locale: locale === "en" ? "en_GB" : "es_ES",
      alternateLocale: locale === "en" ? ["es_ES"] : ["en_GB"],
      images: [
        {
          url: socialImageUrl,
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
      images: [socialImageUrl],
    },
    manifest: "/manifest.webmanifest",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  return (
    <html lang={localeTag(locale)} data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#contenido">
          {locale === "en" ? "Skip to content" : "Saltar al contenido"}
        </a>
        <SiteHeader />
        <div id="contenido">{children}</div>
        <SiteFooter />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
