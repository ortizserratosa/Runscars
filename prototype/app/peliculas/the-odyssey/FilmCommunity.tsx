"use client";

import { useState } from "react";

export function FilmCommunity() {
  const [watched, setWatched] = useState(false);
  return (
    <div className="film-community-card">
      <div>
        <p className="section-index">TU ESTADO</p>
        <h3>{watched ? "Marcada como vista" : "¿Ya la has visto?"}</h3>
        <p>Este estado es personal y no altera crítica ni predicciones.</p>
      </div>
      <button
        aria-pressed={watched}
        className={watched ? "primary-button watched-button" : "ghost-button"}
        onClick={() => setWatched((value) => !value)}
        type="button"
      >
        {watched ? "✓ Vista" : "Marcar como vista"}
      </button>
    </div>
  );
}
