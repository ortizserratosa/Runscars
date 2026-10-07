import "server-only";
import { unstable_cache } from "next/cache";
import type { Locale } from "../i18n/config";
import { isSupabaseConfigured } from "../environment";
import { createSupabaseServerClient } from "../supabase/server";
import { fetchAllRows, fetchRowsByIds } from "../supabase/pagination";
import metadataFixture from "../../../data/festivals/2026-tmdb-metadata-fixture.json";

export type FilmArtwork = {
  posterPath: string | null;
  backdropPath: string | null;
};

export type FestivalFilmArtwork = FilmArtwork & {
  title: string | null;
  releaseDate: string | null;
  runtime: number | null;
};

type MovieSnapshot = {
  tmdb_id: number;
  locale: string;
  title: string;
  release_date: string | null;
  runtime: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  fetched_at?: string | null;
  last_verified_at?: string | null;
};

function selectMovieArtwork(
  snapshots: MovieSnapshot[],
  locale: Locale,
): FestivalFilmArtwork {
  const preferred = locale === "en" ? "en-US" : "es-ES";
  const latestByLocale = new Map<string, MovieSnapshot>();
  for (const snapshot of [...snapshots].sort(
    (left, right) =>
      Date.parse(right.last_verified_at ?? right.fetched_at ?? "1970-01-01") -
      Date.parse(left.last_verified_at ?? left.fetched_at ?? "1970-01-01"),
  )) {
    if (!latestByLocale.has(snapshot.locale))
      latestByLocale.set(snapshot.locale, snapshot);
  }
  const current = [...latestByLocale.values()];
  const metadata = latestByLocale.get(preferred) ?? current[0];
  const poster =
    current.find(
      (snapshot) => snapshot.locale === preferred && snapshot.poster_path,
    ) ?? current.find((snapshot) => snapshot.poster_path);
  return {
    title: metadata?.title ?? null,
    releaseDate: metadata?.release_date ?? null,
    runtime: metadata?.runtime ?? null,
    posterPath: poster?.poster_path ?? null,
    backdropPath: poster?.backdrop_path ?? metadata?.backdrop_path ?? null,
  };
}

const cachedFestivalMetadata = unstable_cache(
  async (
    ids: string,
    locale: Locale,
  ): Promise<Record<number, FestivalFilmArtwork>> => {
    const client = createSupabaseServerClient();
    const snapshots = await fetchRowsByIds(
      ids.split(",").map(Number),
      (batch) =>
        fetchAllRows((from, to) =>
          client
            .from("tmdb_movie_snapshots")
            .select(
              "tmdb_id,locale,title,release_date,runtime,poster_path,backdrop_path,fetched_at,last_verified_at",
            )
            .in("tmdb_id", batch)
            .in("locale", ["es-ES", "en-US"])
            .gt("expires_at", new Date().toISOString())
            .order("last_verified_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false })
            .range(from, to),
        ),
    );
    const byMovie = new Map<number, MovieSnapshot[]>();
    for (const snapshot of snapshots) {
      const movie = byMovie.get(snapshot.tmdb_id) ?? [];
      movie.push(snapshot);
      byMovie.set(snapshot.tmdb_id, movie);
    }
    return Object.fromEntries(
      [...byMovie].map(([id, movie]) => [
        id,
        selectMovieArtwork(movie, locale),
      ]),
    );
  },
  [
    "festival-tmdb-artwork-v2",
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "fixtures",
  ],
  { revalidate: 3600 },
);
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
      .select(
        "tmdb_id,locale,title,release_date,runtime,poster_path,backdrop_path,fetched_at,last_verified_at",
      )
      .in("tmdb_id", tmdbIds)
      .in("locale", ["es-ES", "en-US"])
      .gt("expires_at", new Date().toISOString())
      .order("last_verified_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false });
    return Object.fromEntries(
      films.map((film) => {
        const candidates = (snapshots ?? []).filter(
          (snapshot) => snapshot.tmdb_id === film.tmdb_id,
        );
        const selected = selectMovieArtwork(candidates, locale);
        return [
          film.id,
          {
            posterPath: selected.posterPath,
            backdropPath: selected.backdropPath,
          },
        ];
      }),
    );
  },
  ["discovery-artwork-v2", process.env.NEXT_PUBLIC_SUPABASE_URL ?? "fixtures"],
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

export async function getFestivalArtwork(
  entries: Array<{ id: string; filmId: string | null; tmdbId?: number | null }>,
  locale: Locale,
): Promise<Record<string, FestivalFilmArtwork>> {
  const tmdbIds = [
    ...new Set(
      entries.flatMap((entry) =>
        entry.tmdbId && Number.isSafeInteger(entry.tmdbId) && entry.tmdbId > 0
          ? [entry.tmdbId]
          : [],
      ),
    ),
  ].sort((left, right) => left - right);
  const [catalogue, metadata] = await Promise.all([
    getFilmArtwork(
      entries.filter((entry) => !entry.tmdbId).map((entry) => entry.filmId),
      locale,
    ),
    isSupabaseConfigured()
      ? tmdbIds.length
        ? cachedFestivalMetadata(tmdbIds.join(","), locale).catch(
            () => ({}) as Record<number, FestivalFilmArtwork>,
          )
        : Promise.resolve({} as Record<number, FestivalFilmArtwork>)
      : Promise.resolve(
          Object.fromEntries(
            tmdbIds.map((id) => [
              id,
              selectMovieArtwork(
                metadataFixture.snapshots.filter(
                  (snapshot) => snapshot.tmdb_id === id,
                ),
                locale,
              ),
            ]),
          ),
        ),
  ]);
  return Object.fromEntries(
    entries.map((entry) => {
      const movie = entry.tmdbId ? metadata[entry.tmdbId] : null;
      const film = entry.filmId ? catalogue[entry.filmId] : null;
      return [
        entry.id,
        {
          title: movie?.title ?? null,
          releaseDate: movie?.releaseDate ?? null,
          runtime: movie?.runtime ?? null,
          posterPath: entry.tmdbId
            ? (movie?.posterPath ?? null)
            : (film?.posterPath ?? null),
          backdropPath: entry.tmdbId
            ? (movie?.backdropPath ?? null)
            : (film?.backdropPath ?? null),
        },
      ];
    }),
  );
}
