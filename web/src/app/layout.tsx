import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const requestHost =
    forwardedHost ?? requestHeaders.get("host") ?? "localhost:3000";
  const safeHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(requestHost)
    ? requestHost
    : "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") === "https" ? "https" : "http";
  const origin = `${protocol}://${safeHost}`;
  const description =
    "Runscars sigue crítica, predicciones y rankings de la carrera a los Oscar sin mezclar señales.";

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Runscars · La carrera a los Oscar",
      template: "%s · Runscars",
    },
    description,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: "Runscars · La carrera, con los recibos.",
      description,
      type: "website",
      images: [
        {
          url: new URL("/og.png", origin).toString(),
          width: 1680,
          height: 945,
          alt: "Runscars · La carrera, con los recibos.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Runscars · La carrera, con los recibos.",
      description,
      images: [new URL("/og.png", origin).toString()],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <SiteHeader />
        <div id="contenido">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
