"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const en = usePathname().startsWith("/en");

  useEffect(() => {
    console.error("Runscars route error", error);
  }, [error]);

  return (
    <main className="page-shell legal-page">
      <p className="section-index">
        {en ? "TEMPORARY ISSUE" : "INCIDENCIA TEMPORAL"}
      </p>
      <h1>
        {en
          ? "This page could not be loaded."
          : "No se ha podido cargar esta página."}
      </h1>
      <p>
        {en
          ? "Your account data has not been changed. You can safely try again."
          : "No se ha modificado ningún dato de tu cuenta. Puedes volver a intentarlo con seguridad."}
      </p>
      <button className="primary-button" onClick={reset} type="button">
        {en ? "Try again" : "Reintentar"}
      </button>
    </main>
  );
}
