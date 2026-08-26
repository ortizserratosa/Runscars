import Link from "next/link";
import { localizedPath } from "../../../lib/i18n/config";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function FilmNotFound() {
  const locale = await getRequestLocale();
  const en = locale === "en";
  return (
    <main className="page-shell section-block">
      <p className="section-index">
        {en ? "FILM NOT FOUND" : "PELÍCULA NO ENCONTRADA"}
      </p>
      <h1>
        {en
          ? "This film page does not exist yet."
          : "Esta ficha todavía no existe."}
      </h1>
      <p>
        {en
          ? "Only films in the season's verified catalogue are displayed."
          : "Solo mostramos películas presentes en el catálogo verificado de la temporada."}
      </p>
      <Link
        className="primary-button"
        href={localizedPath("/temporadas/2027", locale)}
      >
        {en ? "Return to the season" : "Volver a la temporada"}
      </Link>
    </main>
  );
}
