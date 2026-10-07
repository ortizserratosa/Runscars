import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import manifest from "../../../data/precursors/2026-2027.json";
import { isSupabaseConfigured } from "../environment";
import { createSupabaseServerClient } from "../supabase/server";
import type {
  PrecursorEditionView,
  PrecursorSetView,
  PrecursorEntryView,
} from "./types";

function fixtureIndex(): PrecursorEditionView[] {
  return manifest.editions.flatMap((edition) => {
    const organization = manifest.organizations.find(
      (item) => item.id === edition.organizationId,
    );
    if (!organization) return [];
    const sets: PrecursorSetView[] = manifest.sets
      .filter((set) => set.editionId === edition.id)
      .map((set) => ({
        id: `${edition.id}-${set.kind}-fixture`,
        kind: set.kind as PrecursorSetView["kind"],
        version: 1,
        sourceUrl: set.source.url,
        sourceTitle: set.source.title,
        sourceAuthor: set.source.author,
        publishedAt: set.source.publishedAt,
        capturedAt: set.capturedAt,
        ceremonyOn: set.schedule.ceremonyOn,
        nominationsOn: set.schedule.nominationsOn,
        milestones: set.schedule.milestones,
        coverage: set.coverage,
        entries: set.entries.map((entry, index) => ({
          id: `${edition.id}-${set.kind}-${index + 1}`,
          order: index + 1,
          originalCategory: entry.originalCategory,
          originalTitle: entry.originalTitle,
          originalRecipient: entry.originalRecipient,
          categoryId: entry.categoryId,
          categoryRelation:
            entry.categoryRelation as PrecursorEntryView["categoryRelation"],
          filmId: null,
          filmTitle: null,
        })),
      }));
    return [
      {
        ...edition,
        name: organization.name,
        nameEn: organization.nameEn,
        organizationKind:
          organization.kind as PrecursorEditionView["organizationKind"],
        homepageUrl: organization.homepageUrl,
        notes: organization.notes,
        schedule: sets.find((set) => set.kind === "schedule") ?? null,
        nominations: sets.find((set) => set.kind === "nominations") ?? null,
        winners: sets.find((set) => set.kind === "winners") ?? null,
      },
    ];
  });
}

async function databaseIndex(): Promise<PrecursorEditionView[]> {
  const client = createSupabaseServerClient() as unknown as SupabaseClient;
  const [organizations, editions, pointers] = await Promise.all([
    client.from("precursor_organizations").select("*"),
    client.from("precursor_editions").select("*"),
    client.from("current_precursor_sets").select("edition_id,kind,set_id"),
  ]);
  for (const result of [organizations, editions, pointers])
    if (result.error) throw new Error(result.error.message);
  const setIds = (pointers.data ?? []).map((pointer) => pointer.set_id);
  const [sets, entries] = await Promise.all([
    setIds.length
      ? client
          .from("precursor_sets")
          .select(
            "id,edition_id,kind,version,source_url,source_title,source_author,published_at,captured_at,ceremony_on,nominations_on,milestones,coverage_es,coverage_en",
          )
          .in("id", setIds)
      : { data: null, error: null },
    setIds.length
      ? client
          .from("precursor_entries")
          .select(
            "id,set_id,entry_order,original_category,original_title,original_recipient,category_id,category_relation,current_precursor_entry_matches(precursor_entry_match_history(id,status,film_id,films(id,title)))",
          )
          .in("set_id", setIds)
          .order("set_id")
          .order("entry_order")
          .range(0, 499)
      : { data: null, error: null },
  ]);
  if (sets.error) throw new Error(sets.error.message);
  if (entries.error) throw new Error(entries.error.message);
  if (entries.data?.length === 500) {
    for (let offset = 500; ; offset += 500) {
      const page = await client
        .from("precursor_entries")
        .select(
          "id,set_id,entry_order,original_category,original_title,original_recipient,category_id,category_relation,current_precursor_entry_matches(precursor_entry_match_history(id,status,film_id,films(id,title)))",
        )
        .in("set_id", setIds)
        .order("set_id")
        .order("entry_order")
        .range(offset, offset + 499);
      if (page.error) throw new Error(page.error.message);
      entries.data.push(...page.data);
      if (page.data.length < 500) break;
    }
  }
  const viewSet = (
    editionId: string,
    kind: PrecursorSetView["kind"],
  ): PrecursorSetView | null => {
    const set = (sets.data ?? []).find(
      (item) => item.edition_id === editionId && item.kind === kind,
    );
    if (!set) return null;
    return {
      id: set.id,
      kind,
      version: set.version,
      sourceUrl: set.source_url,
      sourceTitle: set.source_title,
      sourceAuthor: set.source_author,
      publishedAt: set.published_at,
      capturedAt: set.captured_at,
      ceremonyOn: set.ceremony_on,
      nominationsOn: set.nominations_on,
      milestones: set.milestones,
      coverage: { es: set.coverage_es, en: set.coverage_en },
      entries: (entries.data ?? [])
        .filter((entry) => entry.set_id === set.id)
        .map((entry) => {
          const pointer = Array.isArray(entry.current_precursor_entry_matches)
            ? entry.current_precursor_entry_matches[0]
            : entry.current_precursor_entry_matches;
          const historyRelation = pointer?.precursor_entry_match_history;
          const history = Array.isArray(historyRelation)
            ? historyRelation[0]
            : historyRelation;
          const film = Array.isArray(history?.films)
            ? history.films[0]
            : history?.films;
          return {
            id: String(entry.id),
            order: entry.entry_order,
            originalCategory: entry.original_category,
            originalTitle: entry.original_title,
            originalRecipient: entry.original_recipient,
            categoryId: entry.category_id,
            categoryRelation: entry.category_relation,
            filmId: history?.film_id ?? null,
            filmTitle: film?.title ?? null,
          };
        }),
    };
  };
  return (editions.data ?? []).flatMap((edition) => {
    const organization = (organizations.data ?? []).find(
      (item) => item.id === edition.organization_id,
    );
    if (!organization) return [];
    return [
      {
        id: edition.id,
        organizationId: organization.id,
        name: organization.name,
        nameEn: organization.name_en,
        organizationKind: organization.kind,
        homepageUrl: organization.homepage_url,
        notes: { es: organization.notes_es, en: organization.notes_en },
        seasonId: edition.season_id,
        ceremonyYear: edition.ceremony_year,
        editionNumber: edition.edition_number,
        schedule: viewSet(edition.id, "schedule"),
        nominations: viewSet(edition.id, "nominations"),
        winners: viewSet(edition.id, "winners"),
      } satisfies PrecursorEditionView,
    ];
  });
}

const cachedDatabaseIndex = unstable_cache(
  databaseIndex,
  [
    "public-precursors-v1",
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "unconfigured",
  ],
  { revalidate: 60 },
);
export const getPrecursorIndex = cache(
  async (seasonId?: string): Promise<PrecursorEditionView[]> => {
    const editions = isSupabaseConfigured()
      ? await cachedDatabaseIndex()
      : fixtureIndex();
    return seasonId
      ? editions.filter((edition) => edition.seasonId === seasonId)
      : editions;
  },
);

export const getPrecursorEdition = cache(
  async (organizationId: string, year: number) =>
    (await getPrecursorIndex()).find(
      (edition) =>
        edition.organizationId === organizationId &&
        edition.ceremonyYear === year,
    ) ?? null,
);

export async function getFilmPrecursorContext(filmId: string) {
  return (await getPrecursorIndex()).flatMap((edition) => {
    const entries = [edition.winners, edition.nominations]
      .filter((set): set is PrecursorSetView => Boolean(set))
      .flatMap((set) =>
        set.entries
          .filter((entry) => entry.filmId === filmId)
          .map((entry) => ({
            ...entry,
            kind: set.kind,
            sourceUrl: set.sourceUrl,
          })),
      );
    return entries.length ? [{ edition, entries }] : [];
  });
}

export async function listPrecursorRoutes() {
  return (await getPrecursorIndex()).map(
    (edition) => `/premios/${edition.organizationId}/${edition.ceremonyYear}`,
  );
}
