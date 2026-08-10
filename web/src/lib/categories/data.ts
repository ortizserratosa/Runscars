import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import archive2026 from "../../../data/phase-7/oscars-2026.json";
import {
  phase71FixtureAggregate,
  phase71FixturePreviousAggregate,
  phase71FixtureSeasonSummary,
} from "../../data/phase71-fixture";
import type { PredictionAggregateV2 } from "../aggregation/v2";
import { isSupabaseConfigured } from "../environment";
import { compareSnapshotMovements } from "../snapshots/movements";
import {
  buildRealProviderCuts,
  type SnapshotHistoryEntry,
} from "../snapshots/provider-cuts";
import { createSupabaseServerClient } from "../supabase/server";
import { PUBLIC_CATEGORIES, type PublicCategoryId } from "./config";

export type MarketView = {
  provider: "kalshi" | "polymarket";
  intention: "nomination" | "winner";
  title: string;
  outcome: string;
  probability: number | null;
  volume: number | null;
  openInterest: number | null;
  observedAt: string;
  sourceUrl: string;
};

export type ActiveCategoryView = {
  mode: "active";
  seasonYear: 2027;
  aggregate: PredictionAggregateV2 | null;
  markets: Record<"kalshi" | "polymarket", MarketView[]>;
  dataState: "database" | "fixture" | "unavailable";
  snapshot: {
    id: string;
    contentHash: string;
    lockedAt: string;
    isLatest: boolean;
    previous: {
      id: string;
      lockedAt: string;
    } | null;
    cuts: Array<{
      id: string;
      lockedAt: string;
      changedSources: string[];
      isSelected: boolean;
    }>;
  } | null;
  currentCandidates: Array<{
    id: string;
    label: string;
  }>;
};

export type ArchiveCandidateView = {
  candidateId: string;
  label: string;
  film: { id: string; title: string } | null;
  people: { id: string; name: string; role: string; displayOrder: number }[];
  winner: boolean;
};

export type ArchiveCategoryView = {
  mode: "archive";
  seasonYear: 2026;
  nominees: ArchiveCandidateView[];
  sourceUrl: string;
  capturedAt: string;
  dataState: "database" | "fixture" | "unavailable";
};

export type CategoryView = ActiveCategoryView | ArchiveCategoryView;

type UntypedClient = SupabaseClient;

function client() {
  return createSupabaseServerClient() as unknown as UntypedClient;
}

function allowFixture() {
  return process.env.NODE_ENV !== "production";
}

function activeViewFromHistory({
  snapshots,
  markets,
  dataState,
  selectedSnapshotId,
}: {
  snapshots: SnapshotHistoryEntry[];
  markets: Record<"kalshi" | "polymarket", MarketView[]>;
  dataState: ActiveCategoryView["dataState"];
  selectedSnapshotId?: string;
}): ActiveCategoryView {
  const cuts = buildRealProviderCuts(snapshots);
  const requestedIndex = selectedSnapshotId
    ? cuts.findIndex((cut) => cut.id === selectedSnapshotId)
    : -1;
  const selectedIndex =
    requestedIndex >= 0 ? requestedIndex : Math.max(0, cuts.length - 1);
  const selected = cuts[selectedIndex] ?? null;
  const previous = selectedIndex > 0 ? cuts[selectedIndex - 1] : null;
  const latest = cuts.at(-1) ?? null;
  const sourceNames = new Map(
    cuts.flatMap((cut) =>
      cut.aggregate.sourceLists.map(
        (source) => [source.sourceId, source.sourceName] as const,
      ),
    ),
  );

  return {
    mode: "active",
    seasonYear: 2027,
    aggregate: selected
      ? compareSnapshotMovements(
          selected.aggregate,
          previous?.aggregate ?? null,
        )
      : null,
    markets,
    dataState,
    snapshot: selected
      ? {
          id: selected.id,
          contentHash: selected.contentHash,
          lockedAt: selected.lockedAt,
          isLatest: selected.id === latest?.id,
          previous: previous
            ? {
                id: previous.id,
                lockedAt: previous.lockedAt,
              }
            : null,
          cuts: [...cuts].reverse().map((cut) => ({
            id: cut.id,
            lockedAt: cut.lockedAt,
            changedSources: cut.changedSourceIds.map(
              (sourceId) => sourceNames.get(sourceId) ?? sourceId,
            ),
            isSelected: cut.id === selected.id,
          })),
        }
      : null,
    currentCandidates: (latest?.aggregate.ranking ?? []).map((candidate) => ({
      id: candidate.candidateId,
      label: candidate.label,
    })),
  };
}

function fixtureActive(
  categoryId: PublicCategoryId,
  selectedSnapshotId?: string,
): ActiveCategoryView {
  const currentAggregate = phase71FixtureAggregate(categoryId);
  const previousAggregate = phase71FixturePreviousAggregate(categoryId);
  const marketLabel =
    currentAggregate.ranking[0]?.people[0]?.name ??
    currentAggregate.ranking[0]?.film?.title ??
    currentAggregate.ranking[0]?.label ??
    "Candidatura";
  const fixtureMarket = (
    provider: "kalshi" | "polymarket",
    intention: "nomination" | "winner",
    probability: number,
  ): MarketView => ({
    provider,
    intention,
    title:
      intention === "nomination"
        ? `¿Recibirá ${marketLabel} la nominación?`
        : `¿Ganará ${marketLabel} la categoría?`,
    outcome: marketLabel,
    probability,
    volume: provider === "kalshi" ? 12500 : 9200,
    openInterest: provider === "kalshi" ? 7800 : null,
    observedAt: "2026-07-25T12:17:00.000Z",
    sourceUrl:
      provider === "kalshi"
        ? "https://kalshi.com/markets"
        : "https://polymarket.com",
  });
  return activeViewFromHistory({
    snapshots: [
      {
        id: `periodic-oscars-2027-${categoryId}-nomination-2026-07-20-fixture`,
        contentHash: "fixture-v2-previous-persistent-hash",
        lockedAt: "2026-07-20T04:47:00.000Z",
        methodVersion: previousAggregate.methodVersion,
        schemaVersion: "runscars-snapshot-v2",
        aggregate: previousAggregate,
      },
      {
        id: `periodic-oscars-2027-${categoryId}-nomination-2026-07-25-fixture`,
        contentHash: "fixture-v2-current-persistent-hash",
        lockedAt: "2026-07-25T04:47:00.000Z",
        methodVersion: currentAggregate.methodVersion,
        schemaVersion: "runscars-snapshot-v2",
        aggregate: currentAggregate,
      },
    ],
    markets: {
      kalshi: [
        fixtureMarket("kalshi", "nomination", 0.72),
        fixtureMarket("kalshi", "winner", 0.31),
      ],
      polymarket: [fixtureMarket("polymarket", "winner", 0.34)],
    },
    dataState: "fixture",
    selectedSnapshotId,
  });
}

function fixtureArchive(categoryId: PublicCategoryId): ArchiveCategoryView {
  const category = archive2026.categories.find(
    (item) => item.categoryId === categoryId,
  );
  const candidates = (category?.candidates ?? []) as Array<{
    filmId: string;
    filmTitle: string;
    people?: string[];
    winner?: boolean;
  }>;
  return {
    mode: "archive",
    seasonYear: 2026,
    nominees: candidates.map((candidate) => ({
      candidateId: `archive-${categoryId}-${candidate.filmId}-${
        candidate.people?.join("-") ?? "film"
      }`,
      label: candidate.people?.length
        ? `${candidate.people.join(", ")} — ${candidate.filmTitle}`
        : candidate.filmTitle,
      film: { id: candidate.filmId, title: candidate.filmTitle },
      people: (candidate.people ?? []).map((name, displayOrder) => ({
        id: `archive-person-${displayOrder}`,
        name,
        role: categoryId === "directing" ? "Director" : "Official credit",
        displayOrder,
      })),
      winner: candidate.winner === true,
    })),
    sourceUrl: archive2026.source.sourceUrl,
    capturedAt: archive2026.capturedAt,
    dataState: "fixture",
  };
}

function marketIntention(externalMarketId: string, title: string) {
  return /nom|nominat/i.test(`${externalMarketId} ${title}`)
    ? ("nomination" as const)
    : ("winner" as const);
}

async function marketViews(
  supabase: UntypedClient,
  categoryId: PublicCategoryId,
) {
  const contractsResult = await supabase
    .from("market_contracts")
    .select(
      "id,provider,external_market_id,market_title,outcome_label,source_url,closes_at,resolved_at,market_price_snapshots(probability,volume,open_interest,observed_at)",
    )
    .eq("season_id", "oscars-2027")
    .eq("category_id", categoryId)
    .order("observed_at", {
      ascending: false,
      referencedTable: "market_price_snapshots",
    })
    .limit(1, { referencedTable: "market_price_snapshots" });
  if (contractsResult.error) {
    throw new Error(contractsResult.error.message);
  }
  const markets: Record<"kalshi" | "polymarket", MarketView[]> = {
    kalshi: [],
    polymarket: [],
  };
  for (const contract of contractsResult.data ?? []) {
    const provider = contract.provider as string;
    if (provider !== "kalshi" && provider !== "polymarket") {
      continue;
    }
    if (
      contract.resolved_at ||
      (contract.closes_at && Date.parse(contract.closes_at) <= Date.now())
    ) {
      continue;
    }
    const snapshots = [...(contract.market_price_snapshots ?? [])].sort(
      (left, right) =>
        Date.parse(right.observed_at) - Date.parse(left.observed_at),
    );
    const latest = snapshots[0];
    if (!latest) continue;
    markets[provider].push({
      provider,
      intention: marketIntention(
        contract.external_market_id,
        contract.market_title,
      ),
      title: contract.market_title,
      outcome: contract.outcome_label,
      probability:
        latest.probability === null ? null : Number(latest.probability),
      volume: latest.volume === null ? null : Number(latest.volume),
      openInterest:
        latest.open_interest === null ? null : Number(latest.open_interest),
      observedAt: latest.observed_at,
      sourceUrl: contract.source_url,
    });
  }
  for (const provider of ["kalshi", "polymarket"] as const) {
    markets[provider] = (["nomination", "winner"] as const).flatMap(
      (intention) =>
        markets[provider]
          .filter((market) => market.intention === intention)
          .sort(
            (left, right) =>
              (right.volume ?? 0) - (left.volume ?? 0) ||
              (right.probability ?? 0) - (left.probability ?? 0),
          )
          .slice(0, 4),
    );
  }
  return markets;
}

async function activeCategoryFromDatabase(
  categoryId: PublicCategoryId,
  selectedSnapshotId?: string,
): Promise<ActiveCategoryView> {
  const supabase = client();
  const currentResult = await supabase
    .from("current_aggregate_snapshots")
    .select("snapshot_id")
    .eq("season_id", "oscars-2027")
    .eq("category_id", categoryId)
    .eq("prediction_intention", "nomination")
    .eq("kind", "periodic")
    .maybeSingle();
  if (currentResult.error) throw new Error(currentResult.error.message);
  const markets = await marketViews(supabase, categoryId);
  if (!currentResult.data) {
    return {
      mode: "active",
      seasonYear: 2027,
      aggregate: null,
      markets,
      dataState: "database",
      snapshot: null,
      currentCandidates: [],
    };
  }
  const snapshotResult = await supabase
    .from("aggregate_snapshots")
    .select("id,content_hash,locked_at,method_version,schema_version,payload")
    .eq("id", currentResult.data.snapshot_id)
    .single();
  if (snapshotResult.error) throw new Error(snapshotResult.error.message);
  const row = snapshotResult.data;
  if (row.schema_version !== "runscars-snapshot-v2") {
    return {
      mode: "active",
      seasonYear: 2027,
      aggregate: null,
      markets,
      dataState: "database",
      snapshot: null,
      currentCandidates: [],
    };
  }
  const historyResult = await supabase
    .from("aggregate_snapshots")
    .select("id,content_hash,locked_at,method_version,schema_version,payload")
    .eq("season_id", "oscars-2027")
    .eq("category_id", categoryId)
    .eq("prediction_intention", "nomination")
    .eq("kind", "periodic")
    .eq("method_version", row.method_version)
    .eq("schema_version", "runscars-snapshot-v2")
    .lte("locked_at", row.locked_at)
    .order("locked_at", { ascending: true })
    .order("id", { ascending: true });
  if (historyResult.error) throw new Error(historyResult.error.message);
  const snapshots = (historyResult.data ?? []).flatMap(
    (snapshot): SnapshotHistoryEntry[] => {
      const historyPayload = snapshot.payload as unknown as {
        aggregate?: PredictionAggregateV2;
      };
      if (
        !historyPayload.aggregate ||
        historyPayload.aggregate.methodVersion !== snapshot.method_version
      ) {
        return [];
      }
      return [
        {
          id: snapshot.id,
          contentHash: snapshot.content_hash,
          lockedAt: snapshot.locked_at,
          methodVersion: snapshot.method_version,
          schemaVersion: snapshot.schema_version,
          aggregate: historyPayload.aggregate,
        },
      ];
    },
  );
  return activeViewFromHistory({
    snapshots,
    markets,
    dataState: "database",
    selectedSnapshotId,
  });
}

async function archiveCategoryFromDatabase(
  categoryId: PublicCategoryId,
): Promise<ArchiveCategoryView> {
  const supabase = client();
  const [nominationsResult, winnersResult] = await Promise.all([
    supabase
      .from("current_official_result_sets")
      .select("official_result_sets(id,source_url,captured_at,payload)")
      .eq("season_id", "oscars-2026")
      .eq("kind", "nominations")
      .maybeSingle(),
    supabase
      .from("current_official_result_sets")
      .select("official_result_sets(payload)")
      .eq("season_id", "oscars-2026")
      .eq("kind", "winners")
      .maybeSingle(),
  ]);
  if (nominationsResult.error) throw new Error(nominationsResult.error.message);
  if (winnersResult.error) throw new Error(winnersResult.error.message);
  const nominationsRow = Array.isArray(
    nominationsResult.data?.official_result_sets,
  )
    ? nominationsResult.data.official_result_sets[0]
    : nominationsResult.data?.official_result_sets;
  const winnersRow = Array.isArray(winnersResult.data?.official_result_sets)
    ? winnersResult.data.official_result_sets[0]
    : winnersResult.data?.official_result_sets;
  if (!nominationsRow || !winnersRow) {
    return {
      mode: "archive",
      seasonYear: 2026,
      nominees: [],
      sourceUrl: "https://www.oscars.org/oscars/ceremonies/2026",
      capturedAt: "",
      dataState: "database",
    };
  }
  const nominationEntries = (
    nominationsRow.payload as unknown as {
      entries: Array<{
        categoryId: string;
        categoryCandidateId: string;
      }>;
    }
  ).entries.filter((entry) => entry.categoryId === categoryId);
  const winnerIds = new Set(
    (
      winnersRow.payload as unknown as {
        entries: Array<{
          categoryId: string;
          categoryCandidateId: string;
        }>;
      }
    ).entries
      .filter((entry) => entry.categoryId === categoryId)
      .map((entry) => entry.categoryCandidateId),
  );
  const candidateIds = nominationEntries.map(
    (entry) => entry.categoryCandidateId,
  );
  if (candidateIds.length === 0) {
    return {
      mode: "archive",
      seasonYear: 2026,
      nominees: [],
      sourceUrl: nominationsRow.source_url,
      capturedAt: nominationsRow.captured_at,
      dataState: "database",
    };
  }
  const candidatesResult = await supabase
    .from("category_candidates")
    .select(
      "id,display_label,films(id,title),category_candidate_people(role,display_order,people(id,name))",
    )
    .in("id", candidateIds);
  if (candidatesResult.error) throw new Error(candidatesResult.error.message);
  const candidateById = new Map(
    (candidatesResult.data ?? []).map((candidate) => [candidate.id, candidate]),
  );
  const nominees = nominationEntries.flatMap((entry) => {
    const candidate = candidateById.get(entry.categoryCandidateId);
    if (!candidate) return [];
    const film = Array.isArray(candidate.films)
      ? candidate.films[0]
      : candidate.films;
    const people = (candidate.category_candidate_people ?? [])
      .flatMap((link) => {
        const person = Array.isArray(link.people)
          ? link.people[0]
          : link.people;
        return person
          ? [
              {
                id: person.id,
                name: person.name,
                role: link.role,
                displayOrder: link.display_order,
              },
            ]
          : [];
      })
      .sort((left, right) => left.displayOrder - right.displayOrder);
    return [
      {
        candidateId: candidate.id,
        label: candidate.display_label,
        film: film ? { id: film.id, title: film.title } : null,
        people,
        winner: winnerIds.has(candidate.id),
      },
    ];
  });
  nominees.sort(
    (left, right) =>
      Number(right.winner) - Number(left.winner) ||
      left.label.localeCompare(right.label, "es"),
  );
  return {
    mode: "archive",
    seasonYear: 2026,
    nominees,
    sourceUrl: nominationsRow.source_url,
    capturedAt: nominationsRow.captured_at,
    dataState: "database",
  };
}

export async function getCategoryView(
  seasonYear: 2026 | 2027,
  categoryId: PublicCategoryId,
  options: {
    snapshotId?: string;
  } = {},
): Promise<CategoryView> {
  if (!isSupabaseConfigured()) {
    if (allowFixture()) {
      return seasonYear === 2027
        ? fixtureActive(categoryId, options.snapshotId)
        : fixtureArchive(categoryId);
    }
    return seasonYear === 2027
      ? {
          mode: "active",
          seasonYear,
          aggregate: null,
          markets: { kalshi: [], polymarket: [] },
          dataState: "unavailable",
          snapshot: null,
          currentCandidates: [],
        }
      : {
          mode: "archive",
          seasonYear,
          nominees: [],
          sourceUrl: "https://www.oscars.org/oscars/ceremonies/2026",
          capturedAt: "",
          dataState: "unavailable",
        };
  }
  try {
    return seasonYear === 2027
      ? await activeCategoryFromDatabase(categoryId, options.snapshotId)
      : await archiveCategoryFromDatabase(categoryId);
  } catch {
    if (allowFixture()) {
      return seasonYear === 2027
        ? fixtureActive(categoryId, options.snapshotId)
        : fixtureArchive(categoryId);
    }
    return seasonYear === 2027
      ? {
          mode: "active",
          seasonYear,
          aggregate: null,
          markets: { kalshi: [], polymarket: [] },
          dataState: "unavailable",
          snapshot: null,
          currentCandidates: [],
        }
      : {
          mode: "archive",
          seasonYear,
          nominees: [],
          sourceUrl: "https://www.oscars.org/oscars/ceremonies/2026",
          capturedAt: "",
          dataState: "unavailable",
        };
  }
}

export async function getSeasonSummary(seasonYear: 2026 | 2027) {
  if (seasonYear === 2027 && (!isSupabaseConfigured() || allowFixture())) {
    if (!isSupabaseConfigured()) return phase71FixtureSeasonSummary;
  }
  const views = await Promise.all(
    PUBLIC_CATEGORIES.map(async (category) => ({
      category,
      view: await getCategoryView(seasonYear, category.id),
    })),
  );
  return views.map(({ category, view }) => {
    if (view.mode === "active") {
      return {
        ...category,
        candidateCount: view.aggregate?.ranking.length ?? 0,
        orderedSourceCount: view.aggregate?.orderedSourceCount ?? 0,
        applicableSourceCount: view.aggregate?.applicableSourceCount ?? 0,
        updatedAt: view.snapshot?.lockedAt ?? null,
        isPublic: view.aggregate?.isConsensus ?? false,
      };
    }
    return {
      ...category,
      candidateCount: view.nominees.length,
      orderedSourceCount: 0,
      applicableSourceCount: 1,
      updatedAt: view.capturedAt || null,
      isPublic: view.nominees.length > 0,
    };
  });
}
