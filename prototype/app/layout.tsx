import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const requestHost = forwardedHost ?? requestHeaders.get("host") ?? "localhost:3000";
  const safeHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(requestHost)
    ? requestHost
    : "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") === "https" ? "https" : "http";
  const origin = `${protocol}://${safeHost}`;
  const socialImageUrl = new URL("/og-20260830.png", origin).toString();
  const description =
    "Prototipo navegable para seguir crítica, predicciones y rankings de la carrera a los Oscar sin mezclar señales.";

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Runscars · La carrera a los Oscar",
      template: "%s · Runscars",
    },
    description,
    openGraph: {
      title: "Runscars · La carrera a los Oscar, datos en mano.",
      description,
      type: "website",
      images: [
        {
          url: socialImageUrl,
          width: 1680,
          height: 945,
          alt: "Runscars · La carrera a los Oscar, datos en mano.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Runscars · La carrera a los Oscar, datos en mano.",
      description,
      images: [socialImageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
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
