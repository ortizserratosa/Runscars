import { getCurrentUser } from "../../../../lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { supabase, user } = current;
  const [profile, rankings, entries, watched] = await Promise.all([
    supabase
      .from("user_profiles")
      .select(
        "slug,display_name,is_public,watched_is_public,created_at,updated_at",
      )
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("user_rankings")
      .select("id,season_id,category_id,is_public,created_at,updated_at")
      .eq("user_id", user.id),
    supabase
      .from("user_ranking_entries")
      .select(
        "id,ranking_id,season_id,category_id,category_candidate_id,custom_label,custom_kind,tmdb_movie_id,tmdb_person_id,qualifying_movie_tmdb_id,tmdb_url,qualifying_movie_tmdb_url,us_theatrical_release_date,tmdb_release_data,tmdb_verified_at,position,created_at",
      )
      .eq("user_id", user.id)
      .order("position"),
    supabase
      .from("user_film_states")
      .select("film_id,status,watched_at,created_at,updated_at")
      .eq("user_id", user.id),
  ]);

  const firstError =
    profile.error ?? rankings.error ?? entries.error ?? watched.error;
  if (firstError) {
    return Response.json(
      { error: "No se ha podido preparar la exportación" },
      { status: 500 },
    );
  }

  const body = JSON.stringify(
    {
      schemaVersion: "runscars-user-export-v1",
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email ?? null,
        createdAt: user.created_at,
      },
      profile: profile.data,
      rankings: rankings.data,
      rankingEntries: entries.data,
      watchedFilms: watched.data,
    },
    null,
    2,
  );

  return new Response(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="runscars-mis-datos.json"',
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
