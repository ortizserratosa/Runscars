import "server-only";
import { createSupabaseServerClient } from "../supabase/server";

export async function listFilmsForSeason(seasonId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("season_films")
    .select(
      "film:films(id, title, alternate_titles, release_status, release_date)",
    )
    .eq("season_id", seasonId)
    .order("film_id");

  if (error) {
    throw new Error(`No se pudieron cargar las películas: ${error.message}`);
  }

  return data.map((row) => row.film);
}
