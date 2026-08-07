import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryById } from "../../../lib/categories/config";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

type PublicProfilePageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PublicProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `@${slug}`,
    description: "Perfil público y rankings individuales en Runscars.",
  };
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const { slug } = await params;
  const supabase = createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id,slug,display_name,watched_is_public,created_at")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (!profile) {
    notFound();
  }

  const [rankingsResult, watchedResult] = await Promise.all([
    supabase
      .from("user_rankings")
      .select("id,season_id,category_id,updated_at")
      .eq("user_id", profile.user_id)
      .eq("is_public", true)
      .order("updated_at", { ascending: false }),
    profile.watched_is_public
      ? supabase
          .from("user_film_states")
          .select("film_id,watched_at,films(title)")
          .eq("user_id", profile.user_id)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const rankingIds = (rankingsResult.data ?? []).map((ranking) => ranking.id);
  const entriesResult = rankingIds.length
    ? await supabase
        .from("user_ranking_entries")
        .select(
          "ranking_id,category_candidate_id,position,category_candidates(display_label)",
        )
        .in("ranking_id", rankingIds)
        .order("position")
    : { data: [], error: null };
  const entriesByRanking = new Map<
    string,
    Array<{ id: string; label: string; position: number }>
  >();
  for (const entry of entriesResult.data ?? []) {
    const candidate = Array.isArray(entry.category_candidates)
      ? entry.category_candidates[0]
      : entry.category_candidates;
    const values = entriesByRanking.get(entry.ranking_id) ?? [];
    values.push({
      id: entry.category_candidate_id,
      label: candidate?.display_label ?? entry.category_candidate_id,
      position: entry.position,
    });
    entriesByRanking.set(entry.ranking_id, values);
  }

  return (
    <main className="page-shell account-page public-profile-page">
      <header className="account-hero">
        <p className="section-index">PERFIL PÚBLICO</p>
        <h1>{profile.display_name}</h1>
        <p>@{profile.slug}</p>
      </header>

      <section className="public-profile-section">
        <div className="section-heading split-heading">
          <div>
            <p className="section-index">RANKINGS INDIVIDUALES</p>
            <h2>Su temporada</h2>
          </div>
          <p>
            Las posiciones ausentes no se infieren y estos rankings no forman
            todavía un consenso comunitario.
          </p>
        </div>
        {rankingsResult.data?.length ? (
          <div className="public-ranking-grid">
            {rankingsResult.data.map((ranking) => {
              const category = categoryById(ranking.category_id);
              return (
                <article key={ranking.id}>
                  <p className="section-index">OSCAR 2027</p>
                  <h3>{category?.name ?? ranking.category_id}</h3>
                  <ol>
                    {(entriesByRanking.get(ranking.id) ?? []).map((entry) => (
                      <li key={entry.id}>
                        <span>{entry.position}</span>
                        <strong>{entry.label}</strong>
                      </li>
                    ))}
                  </ol>
                  {category ? (
                    <Link href={`/temporadas/2027/${category.slug}`}>
                      Abrir categoría →
                    </Link>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="privacy-note">No hay rankings públicos.</p>
        )}
      </section>

      {profile.watched_is_public ? (
        <section className="public-profile-section">
          <div className="section-heading">
            <p className="section-index">PELÍCULAS VISTAS</p>
            <h2>{watchedResult.data?.length ?? 0} marcadas</h2>
          </div>
          <div className="watched-chip-list">
            {(watchedResult.data ?? []).map((state) => {
              const film = Array.isArray(state.films)
                ? state.films[0]
                : state.films;
              return (
                <Link href={`/peliculas/${state.film_id}`} key={state.film_id}>
                  {film?.title ?? state.film_id}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
