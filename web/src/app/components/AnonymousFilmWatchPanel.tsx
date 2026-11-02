import Link from "next/link";
import { localizedPath, type Locale } from "../../lib/i18n/config";

export function AnonymousFilmWatchPanel({ locale }: { locale: Locale }) {
  const en = locale === "en";
  return (
    <div className="film-community-card">
      <div>
        <p className="section-index">{en ? "YOUR STATE" : "TU ESTADO"}</p>
        <h3>{en ? "Have you seen it?" : "¿Ya la has visto?"}</h3>
        <p>
          {en
            ? "Sign in to save this state privately."
            : "Inicia sesión para guardar este estado de forma privada."}
        </p>
      </div>
      <Link className="ghost-button" href={localizedPath("/acceso", locale)}>
        {en ? "Sign in" : "Entrar"}
      </Link>
    </div>
  );
}
