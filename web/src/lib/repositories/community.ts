import "server-only";
import {
  PUBLIC_CATEGORIES,
  categoryById,
  categoryBySlug,
} from "../categories/config";
import {
  parseCommunityFilters,
  type FilmWatchState,
} from "../community/validation";
import { isSupabaseConfigured } from "../environment";
import { createSupabaseServerClient } from "../supabase/server";

const PAGE_SIZE = 12;

type RankingRow = {
  id: string;
  user_id: string;
  season_id: string;
  category_id: string;
  updated_at: string;
};

type ProfileRow = {
  user_id: string;
  slug: string;
  display_name: string;
  is_public: boolean;
};

type CandidateRow = {
  id: string;
  film_id: string | null;
  display_label: string;
};

type EntryRow = {
  ranking_id: string;
  category_candidate_id: string;
  position: number;
};

type FilmRow = { id: string; title: string };

export type PublicRankingEntry = {
  id: string;
  position: number;
  label: string;
  filmId: string | null;
  filmTitle: string | null;
  filmState: FilmWatchState;
};

export type PublicRankingSummary = {
  id: string;
  seasonId: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  updatedAt: string;
  entriesCount: number;
  watchedCount: number;
  profile: {
    slug: string;
    displayName: string;
    initials: string;
  };
};

export type PublicRanking = PublicRankingSummary & {
  entries: PublicRankingEntry[];
};

function initials(displayName: string) {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .padEnd(1, "R");
}

function profileSummary(profile: ProfileRow) {
  return {
    slug: profile.slug,
    displayName: profile.display_name,
    initials: initials(profile.display_name),
  };
}

function categorySummary(categoryId: string) {
  const category = categoryById(categoryId);
  return {
    categoryName: category?.name ?? categoryId,
    categorySlug: category?.slug ?? categoryId,
  };
}

async function publicProfilesByIds(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userIds: string[],
) {
  if (!userIds.length) return new Map<string, ProfileRow>();
  const { data } = await supabase
    .from("user_profiles")
    .select("user_id,slug,display_name,is_public")
    .eq("is_public", true)
    .in("user_id", userIds);
  return new Map(
    ((data ?? []) as ProfileRow[]).map((profile) => [profile.user_id, profile]),
  );
}

async function rankingEntries(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  rankingIds: string[],
) {
  if (!rankingIds.length) {
    return {
      entries: [] as EntryRow[],
      candidates: new Map<string, CandidateRow>(),
      films: new Map<string, FilmRow>(),
    };
  }
  const { data: rawEntries } = await supabase
    .from("user_ranking_entries")
    .select("ranking_id,category_candidate_id,position")
    .in("ranking_id", rankingIds)
    .order("position");
  const entries = (rawEntries ?? []) as EntryRow[];
  const candidateIds = [
    ...new Set(entries.map((entry) => entry.category_candidate_id)),
  ];
  const { data: rawCandidates } = candidateIds.length
    ? await supabase
        .from("category_candidates")
        .select("id,film_id,display_label")
        .in("id", candidateIds)
    : { data: [] };
  const candidates = new Map(
    ((rawCandidates ?? []) as CandidateRow[]).map((candidate) => [
      candidate.id,
      candidate,
    ]),
  );
  const filmIds = [
    ...new Set(
      [...candidates.values()]
        .map((candidate) => candidate.film_id)
        .filter((filmId): filmId is string => Boolean(filmId)),
    ),
  ];
  const { data: rawFilms } = filmIds.length
    ? await supabase.from("films").select("id,title").in("id", filmIds)
    : { data: [] };
  const films = new Map(
    ((rawFilms ?? []) as FilmRow[]).map((film) => [film.id, film]),
  );
  return { entries, candidates, films };
}

function buildEntries(
  entries: EntryRow[],
  candidates: Map<string, CandidateRow>,
  films: Map<string, FilmRow>,
  states: Map<string, FilmWatchState>,
) {
  return entries.map((entry) => {
    const candidate = candidates.get(entry.category_candidate_id);
    const film = candidate?.film_id ? films.get(candidate.film_id) : undefined;
    const filmState = candidate?.film_id
      ? (states.get(candidate.film_id) ?? "unmarked")
      : "unmarked";
    return {
      id: entry.category_candidate_id,
      position: entry.position,
      label: candidate?.display_label ?? entry.category_candidate_id,
      filmId: candidate?.film_id ?? null,
      filmTitle: film?.title ?? null,
      filmState,
    } satisfies PublicRankingEntry;
  });
}

export async function listPublicRankings(input: {
  seasonId: string;
  categoryId?: string;
  query?: string;
  page?: number;
}) {
  if (!isSupabaseConfigured()) {
    return {
      rankings: [],
      total: 0,
      page: input.page ?? 1,
      pageSize: PAGE_SIZE,
    };
  }
  const supabase = createSupabaseServerClient();
  const filters = parseCommunityFilters({
    season: input.seasonId,
    category: input.categoryId,
    q: input.query,
    page: String(input.page ?? 1),
  });
  const category = filters.categoryId
    ? (categoryById(filters.categoryId) ?? categoryBySlug(filters.categoryId))
    : null;
  if (filters.categoryId && !category) {
    return { rankings: [], total: 0, page: filters.page, pageSize: PAGE_SIZE };
  }

  let matchingUserIds: string[] | null = null;
  if (filters.query) {
    const escaped = filters.query.replace(/[%_,]/g, "\\$&");
    const { data } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("is_public", true)
      .or(`display_name.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
    matchingUserIds = (data ?? []).map((profile) => profile.user_id);
    if (!matchingUserIds.length) {
      return {
        rankings: [],
        total: 0,
        page: filters.page,
        pageSize: PAGE_SIZE,
      };
    }
  }

  let rankingsQuery = supabase
    .from("user_rankings")
    .select("id,user_id,season_id,category_id,updated_at", { count: "exact" })
    .eq("season_id", filters.seasonId)
    .eq("is_public", true)
    .order("updated_at", { ascending: false });
  if (category) rankingsQuery = rankingsQuery.eq("category_id", category.id);
  if (matchingUserIds)
    rankingsQuery = rankingsQuery.in("user_id", matchingUserIds);
  const { data: rawRankings, count } = await rankingsQuery;
  const allRankings = (rawRankings ?? []) as RankingRow[];
  const start = (filters.page - 1) * PAGE_SIZE;
  const rankings = allRankings.slice(start, start + PAGE_SIZE);
  const profileMap = await publicProfilesByIds(
    supabase,
    rankings.map((ranking) => ranking.user_id),
  );
  const visibleRankings = rankings.filter((ranking) =>
    profileMap.has(ranking.user_id),
  );
  const details = await rankingEntries(
    supabase,
    visibleRankings.map((ranking) => ranking.id),
  );
  const filmIds = [...details.films.keys()];
  const userIds = [...profileMap.keys()];
  const { data: rawStates } =
    filmIds.length && userIds.length
      ? await supabase
          .from("user_film_states")
          .select("user_id,film_id,status")
          .in("user_id", userIds)
          .in("film_id", filmIds)
      : { data: [] };
  const statesByUser = new Map<string, Map<string, FilmWatchState>>();
  for (const state of rawStates ?? []) {
    const states = statesByUser.get(state.user_id) ?? new Map();
    states.set(state.film_id, state.status as FilmWatchState);
    statesByUser.set(state.user_id, states);
  }
  const entriesByRanking = new Map<string, EntryRow[]>();
  for (const entry of details.entries) {
    const values = entriesByRanking.get(entry.ranking_id) ?? [];
    values.push(entry);
    entriesByRanking.set(entry.ranking_id, values);
  }
  return {
    rankings: visibleRankings.map((ranking) => {
      const summary = categorySummary(ranking.category_id);
      const entries = buildEntries(
        entriesByRanking.get(ranking.id) ?? [],
        details.candidates,
        details.films,
        statesByUser.get(ranking.user_id) ?? new Map(),
      );
      return {
        id: ranking.id,
        seasonId: ranking.season_id,
        categoryId: ranking.category_id,
        ...summary,
        updatedAt: ranking.updated_at,
        entriesCount: entries.length,
        watchedCount: entries.filter((entry) => entry.filmState === "watched")
          .length,
        profile: profileSummary(profileMap.get(ranking.user_id)!),
      } satisfies PublicRankingSummary;
    }),
    total: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
}

export async function getPublicRanking(input: {
  slug: string;
  seasonId: string;
  categoryId: string;
}): Promise<PublicRanking | null> {
  if (!isSupabaseConfigured()) return null;
  const category = categoryById(input.categoryId);
  if (!category) return null;
  const supabase = createSupabaseServerClient();
  const { data: rawProfile } = await supabase
    .from("user_profiles")
    .select("user_id,slug,display_name,is_public")
    .eq("slug", input.slug)
    .eq("is_public", true)
    .maybeSingle();
  const profile = rawProfile as ProfileRow | null;
  if (!profile) return null;
  const { data: rawRanking } = await supabase
    .from("user_rankings")
    .select("id,user_id,season_id,category_id,updated_at")
    .eq("user_id", profile.user_id)
    .eq("season_id", input.seasonId)
    .eq("category_id", input.categoryId)
    .eq("is_public", true)
    .maybeSingle();
  const ranking = rawRanking as RankingRow | null;
  if (!ranking) return null;
  const details = await rankingEntries(supabase, [ranking.id]);
  const filmIds = [...details.films.keys()];
  const { data: rawStates } = filmIds.length
    ? await supabase
        .from("user_film_states")
        .select("film_id,status")
        .eq("user_id", profile.user_id)
        .in("film_id", filmIds)
    : { data: [] };
  const states = new Map<string, FilmWatchState>();
  for (const state of rawStates ?? []) {
    states.set(state.film_id, state.status as FilmWatchState);
  }
  const entries = buildEntries(
    details.entries,
    details.candidates,
    details.films,
    states,
  );
  return {
    id: ranking.id,
    seasonId: ranking.season_id,
    categoryId: ranking.category_id,
    ...categorySummary(ranking.category_id),
    updatedAt: ranking.updated_at,
    entriesCount: entries.length,
    watchedCount: entries.filter((entry) => entry.filmState === "watched")
      .length,
    profile: profileSummary(profile),
    entries,
  };
}

export async function countPublicRankingsByCategory(seasonId: string) {
  if (!isSupabaseConfigured()) {
    return new Map(
      PUBLIC_CATEGORIES.map((category) => [category.id, 0] as const),
    );
  }
  const supabase = createSupabaseServerClient();
  const counts = await Promise.all(
    PUBLIC_CATEGORIES.map(async (category) => {
      const { count } = await supabase
        .from("user_rankings")
        .select("id", { count: "exact", head: true })
        .eq("season_id", seasonId)
        .eq("category_id", category.id)
        .eq("is_public", true);
      return [category.id, count ?? 0] as const;
    }),
  );
  return new Map(counts);
}

export function publicRankingUrl({
  slug,
  categorySlug,
}: {
  slug: string;
  categorySlug: string;
}) {
  return `/usuarios/${slug}/${categorySlug}`;
}
