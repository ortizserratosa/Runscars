"use client";

import { useState } from "react";
import type { Locale } from "../../lib/i18n/config";

export function ShareButton({
  title,
  text,
  url,
  locale = "es",
}: {
  title: string;
  text: string;
  url: string;
  locale?: Locale;
}) {
  const [message, setMessage] = useState("");
  const en = locale === "en";

  async function share() {
    const absoluteUrl = url.startsWith("http")
      ? url
      : `${window.location.origin}${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: absoluteUrl });
        setMessage(en ? "Link shared." : "Enlace compartido.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setMessage(
        en
          ? "Link copied. It is ready to share."
          : "Enlace copiado. Ya puedes compartirlo.",
      );
    } catch {
      const input = document.createElement("textarea");
      input.value = absoluteUrl;
      input.setAttribute("readonly", "true");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      setMessage(
        copied
          ? en
            ? "Link copied. It is ready to share."
            : "Enlace copiado. Ya puedes compartirlo."
          : en
            ? "The link could not be copied."
            : "No se ha podido copiar el enlace.",
      );
    }
  }

  return (
    <span className="share-control">
      <button className="ghost-button" onClick={share} type="button">
        {en ? "Share ballot ↗" : "Compartir quiniela ↗"}
      </button>
      <span aria-live="polite" className="share-message">
        {message}
      </span>
    </span>
  );
}
