import Link from "next/link";
import { Suspense } from "react";
import { AccountNav } from "./AccountNav";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="Runscars, portada">
        <span className="wordmark-mark">R</span>
        <span>RUNSCARS</span>
      </Link>

      <nav className="main-nav" aria-label="Navegación principal">
        <Link href="/temporadas/2027">Temporada</Link>
        <Link href="/critica">Crítica</Link>
        <Link href="/archivo">Archivo</Link>
        <Link href="/fuentes">Fuentes</Link>
        <Link href="/metodologia">Método</Link>
      </nav>

      <details className="mobile-nav">
        <summary aria-label="Abrir navegación">Menú</summary>
        <nav aria-label="Navegación móvil">
          <Link href="/temporadas/2027">Temporada</Link>
          <Link href="/critica">Crítica</Link>
          <Link href="/archivo">Archivo</Link>
          <Link href="/fuentes">Fuentes</Link>
          <Link href="/metodologia">Método</Link>
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
              Cuenta
            </span>
          }
        >
          <AccountNav />
        </Suspense>
      </div>
    </header>
  );
}
