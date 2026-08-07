import Link from "next/link";
import { getCurrentUser } from "../../lib/auth/session";
import { toggleWatchedAction } from "../comunidad/actions";

export async function FilmWatchPanel({ filmId }: { filmId: string }) {
  const current = await getCurrentUser();
  if (!current) {
    return (
      <div className="film-community-card">
        <div>
          <p className="section-index">TU ESTADO</p>
          <h3>¿Ya la has visto?</h3>
          <p>Inicia sesión para guardar este estado de forma privada.</p>
        </div>
        <Link className="ghost-button" href="/acceso">
          Entrar
        </Link>
      </div>
    );
  }

  const { data } = await current.supabase
    .from("user_film_states")
    .select("film_id")
    .eq("user_id", current.user.id)
    .eq("film_id", filmId)
    .maybeSingle();
  const watched = Boolean(data);
  const action = toggleWatchedAction.bind(null, filmId, !watched);

  return (
    <div className="film-community-card">
      <div>
        <p className="section-index">TU ESTADO</p>
        <h3>{watched ? "Marcada como vista" : "¿Ya la has visto?"}</h3>
        <p>Este estado es personal y no altera crítica ni predicciones.</p>
      </div>
      <form action={action}>
        <button
          aria-pressed={watched}
          className={watched ? "primary-button watched-button" : "ghost-button"}
          type="submit"
        >
          {watched ? "✓ Vista · desmarcar" : "Marcar como vista"}
        </button>
      </form>
    </div>
  );
}
