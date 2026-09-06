import "server-only";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import manifest from "../../../data/festivals/2026.json";
import { filmFixtures } from "../../data/films";
import { isSupabaseConfigured } from "../environment";
import { createSupabaseServerClient } from "../supabase/server";

export type FestivalEntryView = {
  id: string;
  order: number;
  section: string;
  originalTitle: string;
  originalRecipient: string | null;
  awardType: string | null;
  filmId: string | null;
  filmTitle: string | null;
  matchStatus: "matched" | "pending_review" | "unmatched";
};

export type FestivalSetView = {
  id: string;
  kind: "selection" | "awards";
  version: number;
  sourceUrl: string;
  sourceTitle: string;
  publishedAt: string | null;
  capturedAt: string;
  extractorVersion: string;
  entries: FestivalEntryView[];
};

export type FestivalEditionView = {
  id: string;
  festivalId: string;
  name: string;
  nameEn: string;
  shortName: string;
  homepageUrl: string;
  competitive: boolean;
  displayOrder: number;
  seasonId: string;
  year: number;
  editionNumber: number | null;
  startsOn: string;
  endsOn: string;
  status: "scheduled" | "ongoing" | "completed";
  awardsStatus: "pending" | "published" | "not_applicable";
  officialUrl: string;
  selectionUrl: string;
  awardsUrl: string | null;
  lastVerifiedAt: string | null;
  selection: FestivalSetView | null;
  awards: FestivalSetView | null;
};

const fixtureEditions = [
  [
    "sundance",
    "Festival de Sundance",
    "Sundance Film Festival",
    "Sundance",
    true,
    1,
    null,
    "2026-01-22",
    "2026-02-01",
    "completed",
    "published",
    "https://festival.sundance.org/",
    "https://www.sundance.org/blogs/2026-sundance-film-festival-unveils-97-projects-selected-for-the-feature-film-and-episodic-program/",
    "https://www.sundance.org/blogs/the-complete-list-of-2026-sundance-film-festival-award-winners/",
  ],
  [
    "berlinale",
    "Festival Internacional de Cine de Berlín",
    "Berlin International Film Festival",
    "Berlinale",
    true,
    2,
    76,
    "2026-02-12",
    "2026-02-22",
    "completed",
    "published",
    "https://www.berlinale.de/en/2026.html",
    "https://www.berlinale.de/en/2026/programme/filmprogramme.html",
    "https://www.berlinale.de/en/archive/awards-juries/awards.html?year=2026",
  ],
  [
    "cannes",
    "Festival de Cannes",
    "Festival de Cannes",
    "Cannes",
    true,
    3,
    79,
    "2026-05-12",
    "2026-05-23",
    "completed",
    "published",
    "https://www.festival-cannes.com/en/2026/",
    "https://www.festival-cannes.com/en/press/press-releases/the-films-of-the-official-selection-2026/",
    "https://www.festival-cannes.com/en/press/press-releases/the-79th-festival-de-cannes-winners-list/",
  ],
  [
    "locarno",
    "Festival de Locarno",
    "Locarno Film Festival",
    "Locarno",
    true,
    4,
    79,
    "2026-08-05",
    "2026-08-15",
    "completed",
    "published",
    "https://www.locarnofestival.ch/",
    "https://www.locarnofestival.ch/en/festival/program.html",
    "https://www.locarnofestival.ch/en/festival/palmares.html",
  ],
  [
    "venice",
    "Festival de Venecia",
    "Venice International Film Festival",
    "Venecia",
    true,
    5,
    83,
    "2026-09-02",
    "2026-09-12",
    "ongoing",
    "pending",
    "https://www.labiennale.org/en/cinema/2026/83rd-festival",
    "https://www.labiennale.org/en/cinema/2026/venezia-83-competition",
    "https://www.labiennale.org/en/cinema/2026/awards",
  ],
  [
    "tiff",
    "Festival Internacional de Cine de Toronto",
    "Toronto International Film Festival",
    "TIFF",
    true,
    6,
    51,
    "2026-09-10",
    "2026-09-20",
    "scheduled",
    "pending",
    "https://tiff.net/films",
    "https://tiff.net/press/news",
    "https://tiff.net/press/news",
  ],
  [
    "san-sebastian",
    "Festival de San Sebastián",
    "San Sebastián International Film Festival",
    "San Sebastián",
    true,
    7,
    74,
    "2026-09-18",
    "2026-09-26",
    "scheduled",
    "pending",
    "https://www.sansebastianfestival.com/2026/",
    "https://www.sansebastianfestival.com/2026/sections_and_films/",
    "https://www.sansebastianfestival.com/2026/awards_and_jury_members/1/23162/in",
  ],
  [
    "telluride",
    "Festival de Telluride",
    "Telluride Film Festival",
    "Telluride",
    false,
    8,
    53,
    "2026-09-04",
    "2026-09-07",
    "scheduled",
    "not_applicable",
    "https://www.telluridefilmfestival.org/",
    "https://www.telluridefilmfestival.org/show",
    null,
  ],
  [
    "nyff",
    "Festival de Cine de Nueva York",
    "New York Film Festival",
    "NYFF",
    false,
    9,
    64,
    "2026-09-25",
    "2026-10-12",
    "scheduled",
    "not_applicable",
    "https://www.filmlinc.org/nyff/",
    "https://www.filmlinc.org/nyff/nyff64-lineup/",
    null,
  ],
] as const;

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

const fixtureFilmByTitle = new Map(
  filmFixtures.flatMap((film) =>
    [film.title, ...film.alternateTitles].map(
      (title) => [normalize(title), film] as const,
    ),
  ),
);

function fixtureSets(editionId: string): FestivalSetView[] {
  return manifest.sets
    .filter((set) => set.editionId === editionId)
    .map((set, setIndex) => ({
      id: `${set.editionId}-${set.kind}-fixture-${setIndex + 1}`,
      kind: set.kind as "selection" | "awards",
      version: 1,
      sourceUrl: set.source.url,
      sourceTitle: set.source.title,
      publishedAt: set.source.publishedAt,
      capturedAt: set.capturedAt,
      extractorVersion: set.extractorVersion,
      entries: set.entries.map((entry, index) => {
        const film = fixtureFilmByTitle.get(normalize(entry.originalTitle));
        return {
          id: `${set.editionId}-${set.kind}-${index + 1}`,
          order: index + 1,
          section: entry.section,
          originalTitle: entry.originalTitle,
          originalRecipient: entry.originalRecipient ?? null,
          awardType: "awardType" in entry ? entry.awardType : null,
          filmId: film?.id ?? null,
          filmTitle: film?.title ?? null,
          matchStatus: film ? ("matched" as const) : ("unmatched" as const),
        };
      }),
    }));
}

function fixtureIndex(): FestivalEditionView[] {
  return fixtureEditions.map((row) => {
    const editionId = `${row[0]}-2026`;
    const sets = fixtureSets(editionId);
    return {
      id: editionId,
      festivalId: row[0],
      name: row[1],
      nameEn: row[2],
      shortName: row[3],
      homepageUrl: row[11],
      competitive: row[4],
      displayOrder: row[5],
      seasonId: "oscars-2027",
      year: 2026,
      editionNumber: row[6],
      startsOn: row[7],
      endsOn: row[8],
      status: row[9],
      awardsStatus: row[10],
      officialUrl: row[11],
      selectionUrl: row[12],
      awardsUrl: row[13],
      lastVerifiedAt: "2026-09-03T00:00:00Z",
      selection: sets.find((set) => set.kind === "selection") ?? null,
      awards: sets.find((set) => set.kind === "awards") ?? null,
    };
  });
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function databaseIndex(): Promise<FestivalEditionView[]> {
  const supabase = createSupabaseServerClient() as unknown as SupabaseClient;
  const [festivalsResult, editionsResult] = await Promise.all([
    supabase.from("festivals").select("*").order("display_order"),
    supabase
      .from("festival_editions")
      .select("*")
      .eq("season_id", "oscars-2027")
      .eq("edition_year", 2026),
  ]);
  if (festivalsResult.error) throw new Error(festivalsResult.error.message);
  if (editionsResult.error) throw new Error(editionsResult.error.message);
  const editionIds = editionsResult.data.map((edition) => edition.id);
  const pointersResult = editionIds.length
    ? await supabase
        .from("current_festival_sets")
        .select("edition_id,kind,set_id")
        .in("edition_id", editionIds)
    : { data: [], error: null };
  if (pointersResult.error) throw new Error(pointersResult.error.message);
  const setIds = pointersResult.data.map((pointer) => pointer.set_id);
  const [setsResult, entriesResult] = await Promise.all([
    setIds.length
      ? supabase
          .from("festival_sets")
          .select(
            "id,kind,version,source_url,source_title,published_at,captured_at,extractor_version",
          )
          .in("id", setIds)
      : Promise.resolve({ data: [], error: null }),
    setIds.length
      ? supabase
          .from("festival_entries")
          .select(
            "id,set_id,entry_order,section,original_title,original_recipient,award_type,film_id,match_status,films(id,title)",
          )
          .in("set_id", setIds)
          .order("entry_order")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (setsResult.error) throw new Error(setsResult.error.message);
  if (entriesResult.error) throw new Error(entriesResult.error.message);
  const entryIds = entriesResult.data.map((entry) => entry.id);
  const currentMatchesResult = entryIds.length
    ? await supabase
        .from("current_festival_entry_matches")
        .select("entry_id,match_history_id")
        .in("entry_id", entryIds)
    : { data: [], error: null };
  if (currentMatchesResult.error)
    throw new Error(currentMatchesResult.error.message);
  const historyIds = currentMatchesResult.data.map(
    (match) => match.match_history_id,
  );
  const historiesResult = historyIds.length
    ? await supabase
        .from("festival_entry_match_history")
        .select("id,status,film_id")
        .in("id", historyIds)
    : { data: [], error: null };
  if (historiesResult.error) throw new Error(historiesResult.error.message);
  const currentFilmIds = historiesResult.data.flatMap((history) =>
    history.film_id ? [history.film_id] : [],
  );
  const currentFilmsResult = currentFilmIds.length
    ? await supabase.from("films").select("id,title").in("id", currentFilmIds)
    : { data: [], error: null };
  if (currentFilmsResult.error)
    throw new Error(currentFilmsResult.error.message);
  const festivalById = new Map(
    festivalsResult.data.map((festival) => [festival.id, festival]),
  );
  const pointerByEditionKind = new Map(
    pointersResult.data.map((pointer) => [
      `${pointer.edition_id}:${pointer.kind}`,
      pointer.set_id,
    ]),
  );
  const viewSet = (editionId: string, kind: "selection" | "awards") => {
    const setId = pointerByEditionKind.get(`${editionId}:${kind}`);
    const set = setsResult.data.find((item) => item.id === setId);
    if (!set) return null;
    return {
      id: set.id,
      kind,
      version: set.version,
      sourceUrl: set.source_url,
      sourceTitle: set.source_title,
      publishedAt: set.published_at,
      capturedAt: set.captured_at,
      extractorVersion: set.extractor_version,
      entries: entriesResult.data
        .filter((entry) => entry.set_id === set.id)
        .map((entry) => {
          const pointer = currentMatchesResult.data.find(
            (match) => match.entry_id === entry.id,
          );
          const currentMatch = historiesResult.data.find(
            (history) => history.id === pointer?.match_history_id,
          );
          const filmId = currentMatch ? currentMatch.film_id : entry.film_id;
          const film = filmId
            ? (currentFilmsResult.data.find((item) => item.id === filmId) ??
              relation(entry.films))
            : null;
          return {
            id: String(entry.id),
            order: entry.entry_order,
            section: entry.section,
            originalTitle: entry.original_title,
            originalRecipient: entry.original_recipient,
            awardType: entry.award_type,
            filmId,
            filmTitle: film?.title ?? null,
            matchStatus: currentMatch?.status ?? entry.match_status,
          };
        }),
    } satisfies FestivalSetView;
  };
  return editionsResult.data
    .flatMap((edition) => {
      const festival = festivalById.get(edition.festival_id);
      if (!festival) return [];
      return [
        {
          id: edition.id,
          festivalId: festival.id,
          name: festival.name,
          nameEn: festival.name_en,
          shortName: festival.short_name,
          homepageUrl: festival.homepage_url,
          competitive: festival.is_competitive,
          displayOrder: festival.display_order,
          seasonId: edition.season_id,
          year: edition.edition_year,
          editionNumber: edition.edition_number,
          startsOn: edition.starts_on,
          endsOn: edition.ends_on,
          status: edition.status,
          awardsStatus: edition.awards_status,
          officialUrl: edition.official_url,
          selectionUrl: edition.selection_url,
          awardsUrl: edition.awards_url,
          lastVerifiedAt: edition.last_verified_at,
          selection: viewSet(edition.id, "selection"),
          awards: viewSet(edition.id, "awards"),
        } satisfies FestivalEditionView,
      ];
    })
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

// Receipts stay in the database; public pages need only the small display view.
const cachedDatabaseIndex = unstable_cache(
  databaseIndex,
  [
    "public-festivals-v1",
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "unconfigured",
  ],
  { revalidate: 60 },
);

export const getFestivalIndex = cache(
  async (): Promise<FestivalEditionView[]> => {
    if (!isSupabaseConfigured()) return fixtureIndex();
    const today = new Date().toISOString().slice(0, 10);
    return (await cachedDatabaseIndex()).map((edition) => ({
      ...edition,
      status:
        today < edition.startsOn
          ? "scheduled"
          : today > edition.endsOn
            ? "completed"
            : "ongoing",
    }));
  },
);

export const getFestivalEdition = cache(
  async (festivalId: string, year: number) =>
    (await getFestivalIndex()).find(
      (edition) => edition.festivalId === festivalId && edition.year === year,
    ) ?? null,
);

export async function getFilmFestivalContext(filmId: string) {
  return (await getFestivalIndex()).flatMap((edition) => {
    const entries = [edition.selection, edition.awards]
      .filter((set): set is FestivalSetView => Boolean(set))
      .flatMap((set) =>
        set.entries
          .filter((entry) => entry.filmId === filmId)
          .map((entry) => ({ ...entry, kind: set.kind })),
      );
    return entries.length ? [{ edition, entries }] : [];
  });
}

export async function getFestivalFilmIds() {
  return new Set(
    (await getFestivalIndex()).flatMap((edition) =>
      [edition.selection, edition.awards]
        .filter((set): set is FestivalSetView => Boolean(set))
        .flatMap((set) =>
          set.entries.flatMap((entry) => (entry.filmId ? [entry.filmId] : [])),
        ),
    ),
  );
}

export async function listFestivalRoutes() {
  return (await getFestivalIndex()).map(
    (edition) => `/festivales/${edition.festivalId}/${edition.year}`,
  );
}
