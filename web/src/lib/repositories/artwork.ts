import "server-only";
import { unstable_cache } from "next/cache";
import type { Locale } from "../i18n/config";
import { isSupabaseConfigured } from "../environment";
import { createSupabaseServerClient } from "../supabase/server";

export type FilmArtwork = {
  posterPath: string | null;
  backdropPath: string | null;
};
const cachedArtwork = unstable_cache(
  async (ids: string, locale: Locale): Promise<Record<string, FilmArtwork>> => {
    const client = createSupabaseServerClient();
    const { data: films, error } = await client
      .from("films")
      .select("id,tmdb_id")
      .in("id", ids.split(","));
    if (error || !films?.length) return {};
    const tmdbIds = films.flatMap((film) =>
      film.tmdb_id ? [film.tmdb_id] : [],
    );
    if (!tmdbIds.length) return {};
    const { data: snapshots } = await client
      .from("tmdb_movie_snapshots")
      .select("tmdb_id,locale,poster_path,backdrop_path,fetched_at")
      .in("tmdb_id", tmdbIds)
      .in("locale", ["es-ES", "en-US"])
      .gt("expires_at", new Date().toISOString())
      .order("fetched_at", { ascending: false });
    const preferred = locale === "en" ? "en-US" : "es-ES";
    return Object.fromEntries(
      films.map((film) => {
        const candidates = (snapshots ?? []).filter(
          (snapshot) => snapshot.tmdb_id === film.tmdb_id,
        );
        const selected =
          candidates.find(
            (snapshot) => snapshot.locale === preferred && snapshot.poster_path,
          ) ?? candidates.find((snapshot) => snapshot.poster_path);
        return [
          film.id,
          {
            posterPath: selected?.poster_path ?? null,
            backdropPath: selected?.backdrop_path ?? null,
          },
        ];
      }),
    );
  },
  ["discovery-artwork-v1", process.env.NEXT_PUBLIC_SUPABASE_URL ?? "fixtures"],
  { revalidate: 3600 },
);

export async function getFilmArtwork(
  ids: Array<string | null>,
  locale: Locale,
) {
  const unique = [
    ...new Set(ids.filter((id): id is string => Boolean(id))),
  ].sort();
  if (!isSupabaseConfigured() || !unique.length)
    return {} as Record<string, FilmArtwork>;
  return cachedArtwork(unique.join(","), locale);
}
