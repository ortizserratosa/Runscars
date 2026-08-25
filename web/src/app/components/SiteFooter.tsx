import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <span className="footer-mark">R</span>
        <p>La carrera a los Oscar, con cada señal en su sitio.</p>
      </div>
      <div className="footer-links">
        <Link href="/temporadas/2027">Oscar 2027</Link>
        <Link href="/archivo">Archivo 2022–2026</Link>
        <Link href="/evaluacion">Evaluación</Link>
        <Link href="/metodologia">Metodología</Link>
        <Link href="/critica">Recepción crítica</Link>
        <Link href="/fuentes">Trazabilidad</Link>
        <Link href="/creditos">Créditos</Link>
        <span>Datos verificables · Fuentes separadas</span>
      </div>
    </footer>
  );
}
