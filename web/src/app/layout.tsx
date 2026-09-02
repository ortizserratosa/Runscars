import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Archivo, Bodoni_Moda, IBM_Plex_Mono } from "next/font/google";
import { headers } from "next/headers";
import {
  localeTag,
  localizedPath,
  stripLocalePrefix,
} from "../lib/i18n/config";
import { getRequestLocale, getRequestPath } from "../lib/i18n/server";
import { SITE_NAME, SOCIAL_IMAGE_PATH } from "../lib/seo";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import "./globals.css";
import "./brand-system.css";

const displayFont = Bodoni_Moda({
  display: "swap",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-runscars-display",
});

const sansFont = Archivo({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-runscars-sans",
});

const monoFont = IBM_Plex_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-runscars-mono",
  weight: ["400", "500", "600", "700"],
});

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
    ? "Follow the 2027 Oscar predictions with an updated, source-by-source expert consensus for Best Picture and every major category."
    : "Sigue las predicciones de los Oscar 2027 con un consenso de expertos actualizado y verificable para Mejor película y las categorías principales.";
  const title = english
    ? "Oscar Predictions 2027 | Runscars"
    : "Predicciones Oscar 2027 | Runscars";
  const socialTitle = english
    ? "Oscar Predictions 2027: Expert Consensus | Runscars"
    : "Predicciones Oscar 2027: consenso de expertos | Runscars";
  const internalPath = stripLocalePrefix(visiblePath);
  const canonicalPath = localizedPath(internalPath, locale);
  const socialImageUrl = new URL(SOCIAL_IMAGE_PATH, origin).toString();
  const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

  return {
    metadataBase: new URL(origin),
    applicationName: SITE_NAME,
    title: {
      default: title,
      template: `%s | ${SITE_NAME}`,
    },
    description,
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: "entertainment",
    alternates: {
      canonical: canonicalPath,
      languages: {
        es: localizedPath(internalPath, "es"),
        en: localizedPath(internalPath, "en"),
        "x-default": localizedPath(internalPath, "es"),
      },
    },
    robots: {
      index: allowIndexing,
      follow: allowIndexing,
      googleBot: {
        index: allowIndexing,
        follow: allowIndexing,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    verification: {
      google: "-DG9WuRmmS-JvJT-S6igJwvwDLONugSKILf30hgmOC0",
    },
    openGraph: {
      title: socialTitle,
      description,
      type: "website",
      url: canonicalPath,
      siteName: SITE_NAME,
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
    <html
      className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable}`}
      lang={localeTag(locale)}
      data-scroll-behavior="smooth"
    >
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
