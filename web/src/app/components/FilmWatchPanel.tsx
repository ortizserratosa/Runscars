import Link from "next/link";
import { getCurrentUser } from "../../lib/auth/session";
import type { FilmWatchState } from "../../lib/community/validation";
import { setFilmStateAction } from "../comunidad/actions";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";

export async function FilmWatchPanel({ filmId }: { filmId: string }) {
  const [current, locale] = await Promise.all([
    getCurrentUser(),
    getRequestLocale(),
  ]);
  const en = locale === "en";
  if (!current) {
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

  const { data } = await current.supabase
    .from("user_film_states")
    .select("film_id,status")
    .eq("user_id", current.user.id)
    .eq("film_id", filmId)
    .maybeSingle();
  const state = (data?.status ?? "unmarked") as FilmWatchState;
  const labels: Record<FilmWatchState, string> = {
    watched: en ? "Watched" : "Vista",
    not_watched: en ? "Not watched" : "No vista",
    unmarked: en ? "Unmarked" : "No indicada",
  };

  return (
    <div className="film-community-card">
      <div>
        <p className="section-index">{en ? "YOUR STATE" : "TU ESTADO"}</p>
        <h3>{labels[state]}</h3>
        <p>
          {en
            ? "Mark your watch state without affecting criticism or predictions."
            : "Indica tu visionado sin alterar crítica ni predicciones."}
        </p>
      </div>
      <div
        className="film-state-actions"
        role="group"
        aria-label={en ? "Watch state" : "Estado de visionado"}
      >
        {(["watched", "not_watched", "unmarked"] as const).map((nextState) => (
          <form
            action={setFilmStateAction.bind(null, filmId, nextState)}
            key={nextState}
          >
            <input name="locale" type="hidden" value={locale} />
            <button
              aria-pressed={state === nextState}
              className={
                state === nextState
                  ? "primary-button watched-button"
                  : "ghost-button"
              }
              type="submit"
            >
              {labels[nextState]}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
