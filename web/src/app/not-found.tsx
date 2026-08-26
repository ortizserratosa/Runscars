import Link from "next/link";
import { localizedPath } from "../lib/i18n/config";
import { getRequestLocale } from "../lib/i18n/server";

export default async function NotFound() {
  const locale = await getRequestLocale();
  const en = locale === "en";

  return (
    <main className="page-shell legal-page">
      <p className="section-index">404</p>
      <h1>{en ? "This page is not here." : "Esta página no está aquí."}</h1>
      <p>
        {en
          ? "The link may have changed or the content may no longer be public."
          : "Puede que el enlace haya cambiado o que el contenido ya no sea público."}
      </p>
      <Link className="primary-button" href={localizedPath("/", locale)}>
        {en ? "Return home" : "Volver a portada"}
      </Link>
    </main>
  );
}
