import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Archivo, Bodoni_Moda, IBM_Plex_Mono } from "next/font/google";
import { localeTag, type Locale } from "../../lib/i18n/config";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import "../globals.css";
import "../brand-system.css";

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
  weight: ["400", "700"],
});

export function RootDocument({
  children,
  locale,
  anonymous = false,
}: Readonly<{
  children: React.ReactNode;
  locale: Locale;
  anonymous?: boolean;
}>) {
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
        <SiteHeader locale={locale} anonymous={anonymous} />
        <div id="contenido">{children}</div>
        <SiteFooter locale={locale} />
        {process.env.VERCEL ? <Analytics /> : null}
        {process.env.VERCEL ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
