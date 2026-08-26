import Link from "next/link";
import { Suspense } from "react";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { AccountNav } from "./AccountNav";
import { LanguageSwitcher } from "./LanguageSwitcher";

export async function SiteHeader() {
  const locale = await getRequestLocale();
  const en = locale === "en";
  const href = (path: string) => localizedPath(path, locale);
  return (
    <header className="site-header">
      <Link
        className="wordmark"
        href={href("/")}
        aria-label={en ? "Runscars, home" : "Runscars, portada"}
      >
        <span className="wordmark-mark">R</span>
        <span>RUNSCARS</span>
      </Link>

      <nav
        className="main-nav"
        aria-label={en ? "Main navigation" : "Navegación principal"}
      >
        <Link href={href("/temporadas/2027")}>
          {en ? "Season" : "Temporada"}
        </Link>
        <Link href={href("/critica")}>{en ? "Critics" : "Crítica"}</Link>
        <Link href={href("/archivo")}>{en ? "Archive" : "Archivo"}</Link>
        <Link href={href("/fuentes")}>{en ? "Sources" : "Fuentes"}</Link>
        <Link href={href("/metodologia")}>{en ? "Method" : "Método"}</Link>
        <Link href={href("/comunidad")}>{en ? "Community" : "Comunidad"}</Link>
      </nav>

      <details className="mobile-nav">
        <summary aria-label={en ? "Open navigation" : "Abrir navegación"}>
          {en ? "Menu" : "Menú"}
        </summary>
        <nav aria-label={en ? "Mobile navigation" : "Navegación móvil"}>
          <Link href={href("/temporadas/2027")}>
            {en ? "Season" : "Temporada"}
          </Link>
          <Link href={href("/critica")}>{en ? "Critics" : "Crítica"}</Link>
          <Link href={href("/archivo")}>{en ? "Archive" : "Archivo"}</Link>
          <Link href={href("/fuentes")}>{en ? "Sources" : "Fuentes"}</Link>
          <Link href={href("/metodologia")}>{en ? "Method" : "Método"}</Link>
          <Link href={href("/comunidad")}>
            {en ? "Community" : "Comunidad"}
          </Link>
        </nav>
      </details>

      <div className="header-actions">
        <span className="live-chip">
          <span aria-hidden="true" />
          Oscar 2027
        </span>
        <Suspense
          fallback={
            <span className="ghost-button compact" aria-hidden="true">
              {en ? "Account" : "Cuenta"}
            </span>
          }
        >
          <AccountNav />
        </Suspense>
        <Suspense fallback={<span aria-hidden="true">{en ? "ES" : "EN"}</span>}>
          <LanguageSwitcher />
        </Suspense>
      </div>
    </header>
  );
}
