import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="Runscars, portada">
        <span className="wordmark-mark">R</span>
        <span>RUNSCARS</span>
      </Link>

      <nav className="main-nav" aria-label="Navegación principal">
        <Link href="/temporadas/2027">Temporada</Link>
        <Link href="/temporadas/2027/mejor-pelicula">Categorías</Link>
        <Link href="/fuentes/awardswatch">Fuentes</Link>
      </nav>

      <div className="header-actions">
        <span className="live-chip">
          <span aria-hidden="true" />
          Oscar 2027
        </span>
        <span className="ghost-button compact" aria-label="Entorno de staging">
          Staging
        </span>
      </div>
    </header>
  );
}
