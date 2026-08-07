import type { Metadata } from "next";
import Link from "next/link";
import { categoryById } from "../../lib/categories/config";
import { requireCurrentUser } from "../../lib/auth/session";
import { deleteRankingAction } from "../comunidad/actions";
import { signOutAction } from "../acceso/actions";
import { DeleteAccountForm, ProfileForm } from "./AccountForms";

export const metadata: Metadata = {
  title: "Mi cuenta",
  description: "Perfil, rankings, visionados y privacidad de Runscars.",
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { supabase, user } = await requireCurrentUser();
  const [profileResult, rankingsResult, watchedResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("display_name,slug,is_public,watched_is_public,created_at")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("user_rankings")
      .select("id,season_id,category_id,is_public,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("user_film_states")
      .select("film_id,watched_at,films(title)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
  ]);

  if (profileResult.error) {
    throw new Error("No se ha podido cargar el perfil.");
  }
  const profile = profileResult.data;

  return (
    <main className="page-shell account-page">
      <header className="account-hero account-hero-row">
        <div>
          <p className="section-index">MI CUENTA</p>
          <h1>{profile.display_name}</h1>
          <p>{user.email}</p>
        </div>
        <form action={signOutAction}>
          <button className="ghost-button">Cerrar sesión</button>
        </form>
      </header>

      <div className="account-dashboard">
        <section className="account-card">
          <p className="section-index">PERFIL Y PRIVACIDAD</p>
          <h2>Tu presencia pública</h2>
          <ProfileForm profile={profile} />
          {profile.is_public ? (
            <Link className="text-link" href={`/usuarios/${profile.slug}`}>
              Ver mi perfil público →
            </Link>
          ) : (
            <p className="privacy-note">
              Tu perfil no es visible para nadie más.
            </p>
          )}
        </section>

        <section className="account-card">
          <p className="section-index">RANKINGS</p>
          <h2>Versiones activas</h2>
          {rankingsResult.data?.length ? (
            <div className="account-list">
              {rankingsResult.data.map((ranking) => {
                const category = categoryById(ranking.category_id);
                return (
                  <article key={ranking.id}>
                    <div>
                      <strong>{category?.name ?? ranking.category_id}</strong>
                      <small>
                        {ranking.is_public ? "Público" : "Privado"} ·
                        actualizado{" "}
                        {new Intl.DateTimeFormat("es-ES", {
                          dateStyle: "medium",
                        }).format(new Date(ranking.updated_at))}
                      </small>
                    </div>
                    <div className="inline-actions">
                      {category ? (
                        <Link href={`/temporadas/2027/${category.slug}`}>
                          Editar
                        </Link>
                      ) : null}
                      <form action={deleteRankingAction}>
                        <input
                          name="seasonId"
                          type="hidden"
                          value={ranking.season_id}
                        />
                        <input
                          name="categoryId"
                          type="hidden"
                          value={ranking.category_id}
                        />
                        <button>Eliminar</button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="privacy-note">
              Todavía no has guardado ningún ranking.
            </p>
          )}
          <Link className="text-link" href="/temporadas/2027">
            Elegir una categoría →
          </Link>
        </section>

        <section className="account-card">
          <p className="section-index">VISTAS</p>
          <h2>{watchedResult.data?.length ?? 0} películas</h2>
          {watchedResult.data?.length ? (
            <div className="account-list">
              {watchedResult.data.map((state) => {
                const film = Array.isArray(state.films)
                  ? state.films[0]
                  : state.films;
                return (
                  <article key={state.film_id}>
                    <Link href={`/peliculas/${state.film_id}`}>
                      {film?.title ?? state.film_id}
                    </Link>
                    <small>
                      {state.watched_at
                        ? new Intl.DateTimeFormat("es-ES", {
                            dateStyle: "medium",
                          }).format(new Date(state.watched_at))
                        : "Fecha no indicada"}
                    </small>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="privacy-note">No has marcado ninguna película.</p>
          )}
        </section>

        <section className="account-card data-card">
          <p className="section-index">TUS DATOS</p>
          <h2>Exportar o eliminar</h2>
          <p>
            La exportación incluye perfil, rankings y visionados. El borrado
            elimina la identidad de acceso y todo el contenido asociado.
          </p>
          <a className="primary-button dark-button" href="/api/cuenta/exportar">
            Descargar JSON
          </a>
          <DeleteAccountForm />
        </section>
      </div>
    </main>
  );
}
