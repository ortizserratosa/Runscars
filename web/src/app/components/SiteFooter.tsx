import Link from "next/link";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { BrandLogo } from "./BrandLogo";

export async function SiteFooter() {
  const locale = await getRequestLocale();
  const en = locale === "en";
  const href = (path: string) => localizedPath(path, locale);
  return (
    <footer className="site-footer">
      <div>
        <BrandLogo
          inverse
          tagline={en ? "The race, with receipts." : "La carrera, con pruebas."}
        />
        <p>
          {en
            ? "The road to the Oscars, with transparent data and sources."
            : "La carrera a los Oscar, con datos y fuentes transparentes."}
        </p>
      </div>
      <div className="footer-links">
        <Link href={href("/temporadas/2027")}>Oscar 2027</Link>
        <Link href={href("/archivo")}>
          {en ? "2022–2026 archive" : "Archivo 2022–2026"}
        </Link>
        <Link href={href("/evaluacion")}>
          {en ? "Evaluation" : "Evaluación"}
        </Link>
        <Link href={href("/metodologia")}>
          {en ? "Methodology" : "Metodología"}
        </Link>
        <Link href={href("/comunidad")}>{en ? "Community" : "Comunidad"}</Link>
        <Link href={href("/privacidad")}>
          {en ? "Privacy and security" : "Privacidad y seguridad"}
        </Link>
        <Link href={href("/terminos")}>{en ? "Terms" : "Condiciones"}</Link>
        <Link href={href("/fuentes")}>
          {en ? "Traceability" : "Trazabilidad"}
        </Link>
        <Link href={href("/creditos")}>{en ? "Credits" : "Créditos"}</Link>
        <span>
          {en
            ? "100% verifiable data · Independent sources"
            : "Datos 100% verificables · Fuentes independientes"}
        </span>
      </div>
    </footer>
  );
}
