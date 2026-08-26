import type { Metadata } from "next";
import Link from "next/link";
import { categoryById } from "../../lib/categories/config";
import { requireCurrentUser } from "../../lib/auth/session";
import { localeTag, localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { deleteRankingAction } from "../comunidad/actions";
import { signOutAction } from "../acceso/actions";
import { DeleteAccountForm, ProfileForm } from "./AccountForms";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getRequestLocale()) === "en";
  return {
    title: en ? "My account" : "Mi cuenta",
    description: en
      ? "Runscars profile, rankings, watch states and privacy."
      : "Perfil, rankings, visionados y privacidad de Runscars.",
  };
}

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const locale = await getRequestLocale();
  const en = locale === "en";
  const { supabase, user } = await requireCurrentUser();
  const [profileResult, rankingsResult, watchedResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("display_name,slug,is_public,created_at")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("user_rankings")
      .select("id,season_id,category_id,is_public,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("user_film_states")
      .select("film_id,status,watched_at,films(title)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
  ]);

  if (profileResult.error) {
    throw new Error(
      en
        ? "The profile could not be loaded."
        : "No se ha podido cargar el perfil.",
    );
  }
  const profile = profileResult.data;

  return (
    <main className="page-shell account-page">
      <header className="account-hero account-hero-row">
        <div>
          <p className="section-index">{en ? "MY ACCOUNT" : "MI CUENTA"}</p>
          <h1>{profile.display_name}</h1>
          <p>{user.email}</p>
        </div>
        <form action={signOutAction}>
          <input name="locale" type="hidden" value={locale} />
          <button className="ghost-button">
            {en ? "Sign out" : "Cerrar sesión"}
          </button>
        </form>
      </header>

      <div className="account-dashboard">
        <section className="account-card">
          <p className="section-index">
            {en ? "PROFILE AND PRIVACY" : "PERFIL Y PRIVACIDAD"}
          </p>
          <h2>{en ? "Your public presence" : "Tu presencia pública"}</h2>
          <ProfileForm locale={locale} profile={profile} />
          {profile.is_public ? (
            <Link
              className="text-link"
              href={localizedPath(`/usuarios/${profile.slug}`, locale)}
            >
              {en ? "View my public profile →" : "Ver mi perfil público →"}
            </Link>
          ) : (
            <p className="privacy-note">
              {en
                ? "Your profile is not visible to anyone else."
                : "Tu perfil no es visible para nadie más."}
            </p>
          )}
        </section>

        <section className="account-card">
          <p className="section-index">RANKINGS</p>
          <h2>{en ? "Active versions" : "Versiones activas"}</h2>
          {rankingsResult.data?.length ? (
            <div className="account-list">
              {rankingsResult.data.map((ranking) => {
                const category = categoryById(ranking.category_id);
                return (
                  <article key={ranking.id}>
                    <div>
                      <strong>
                        {category
                          ? en
                            ? category.nameEn
                            : category.name
                          : ranking.category_id}
                      </strong>
                      <small>
                        {ranking.is_public
                          ? en
                            ? "Public"
                            : "Público"
                          : en
                            ? "Private"
                            : "Privado"}{" "}
                        ·{en ? "updated" : "actualizado"}{" "}
                        {new Intl.DateTimeFormat(localeTag(locale), {
                          dateStyle: "medium",
                        }).format(new Date(ranking.updated_at))}
                      </small>
                    </div>
                    <div className="inline-actions">
                      {category ? (
                        <Link
                          href={localizedPath(
                            `/temporadas/2027/${category.slug}`,
                            locale,
                          )}
                        >
                          {en ? "Edit" : "Editar"}
                        </Link>
                      ) : null}
                      <form action={deleteRankingAction}>
                        <input name="locale" type="hidden" value={locale} />
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
                        <button>{en ? "Delete" : "Eliminar"}</button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="privacy-note">
              {en
                ? "You have not saved any rankings yet."
                : "Todavía no has guardado ningún ranking."}
            </p>
          )}
          <Link
            className="text-link"
            href={localizedPath("/temporadas/2027", locale)}
          >
            {en ? "Choose a category →" : "Elegir una categoría →"}
          </Link>
        </section>

        <section className="account-card">
          <p className="section-index">{en ? "WATCH STATES" : "VISIONADO"}</p>
          <h2>
            {watchedResult.data?.length ?? 0} {en ? "states" : "estados"}
          </h2>
          {watchedResult.data?.length ? (
            <div className="account-list">
              {watchedResult.data.map((state) => {
                const film = Array.isArray(state.films)
                  ? state.films[0]
                  : state.films;
                return (
                  <article key={state.film_id}>
                    <Link
                      href={localizedPath(
                        `/peliculas/${state.film_id}`,
                        locale,
                      )}
                    >
                      {film?.title ?? state.film_id}
                    </Link>
                    <small>
                      {state.status === "watched" && state.watched_at
                        ? new Intl.DateTimeFormat(localeTag(locale), {
                            dateStyle: "medium",
                          }).format(new Date(state.watched_at))
                        : state.status === "not_watched"
                          ? en
                            ? "Not watched"
                            : "No vista"
                          : en
                            ? "Unmarked"
                            : "No indicada"}
                    </small>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="privacy-note">
              {en
                ? "You have not marked any films."
                : "No has marcado ninguna película."}
            </p>
          )}
        </section>

        <section className="account-card data-card">
          <p className="section-index">{en ? "YOUR DATA" : "TUS DATOS"}</p>
          <h2>{en ? "Export or delete" : "Exportar o eliminar"}</h2>
          <p>
            {en
              ? "The export includes your profile, rankings and watch states. Deletion removes your sign-in identity and all associated content."
              : "La exportación incluye perfil, rankings y visionados. El borrado elimina la identidad de acceso y todo el contenido asociado."}
          </p>
          <a className="primary-button dark-button" href="/api/cuenta/exportar">
            {en ? "Download JSON" : "Descargar JSON"}
          </a>
          <DeleteAccountForm locale={locale} />
        </section>
      </div>
    </main>
  );
}
