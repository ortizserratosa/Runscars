import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { isSupabaseConfigured } from "../environment";
import { createSupabaseServerClient } from "../supabase/server";
import { getPrecursorIndex } from "../precursors/data";
import type { PrecursorEditionView } from "../precursors/types";
import { fetchAllRows, fetchRowsByIds } from "../supabase/pagination";
import { getFestivalIndex, type FestivalEditionView } from "../festivals/data";
import {
  getCurrentCategoryPredictions,
  type CurrentCategoryPredictionView,
} from "./signals";

function client() {
  return createSupabaseServerClient() as unknown as SupabaseClient;
}

export type SourceHealth = "ok" | "failed" | "unknown";

export type SourceIndexView = {
  id: string;
  name: string;
  homepageUrl: string;
  sourceTypes: string[];
  editorialStatus: string;
  technicalStatus: string;
  publicationStatus: string;
  lastReviewedOn: string | null;
  activeCategoryCount: number;
  lastPublishedAt: string | null;
  lastChangedAt: string | null;
  lastSuccessfulCheckAt: string | null;
  lastFailureAt: string | null;
  lastCapturedAt?: string | null;
  festivalArchiveReviewed?: boolean;
  health: SourceHealth;
};

export type SourceCategoryView = {
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  intention: "nomination" | "winner";
  lastChangedAt: string;
  publication: {
    externalId: string;
    title: string;
    url: string;
    author: string | null;
    publishedAt: string | null;
    capturedAt: string | null;
    extractorVersion: string | null;
  };
  entries: Array<{
    candidateId: string;
    label: string;
    appearanceKind: "ordered" | "selection";
    rank: number | null;
    listLength: number;
    points: number;
    originalValue: unknown;
    aggregatePosition: number;
    aggregateScore: number;
    aggregateCoverage: string;
    aggregateSources: Array<{ id: string; name: string }>;
  }>;
};

export type SourceDetailView = SourceIndexView & {
  notes: string | null;
  categories: SourceCategoryView[];
  festivalEditions: FestivalEditionView[];
};

type ConnectorRow = {
  source_id: string | null;
  last_successful_check_at: string | null;
  last_failure_at: string | null;
  is_active?: boolean;
  has_current_failure?: boolean;
  has_active_connector?: boolean;
};

type FestivalConnectorRow = ConnectorRow & {
  configuration: {
    edition_id?: string;
    manual_archive_kinds?: string[];
    minimum_entries?: Partial<Record<"selection" | "awards", number>>;
  };
};

function latest(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(right) > Date.parse(left) ? right : left;
}

function connectorSummary(rows: ConnectorRow[]) {
  const lastSuccessfulCheckAt = rows.reduce<string | null>(
    (value, row) => latest(value, row.last_successful_check_at),
    null,
  );
  const lastFailureAt = rows.reduce<string | null>(
    (value, row) => latest(value, row.last_failure_at),
    null,
  );
  const automaticRows = rows.filter(
    (row) => row.is_active !== false && row.has_active_connector !== false,
  );
  const automaticSuccess = automaticRows.reduce<string | null>(
    (value, row) => latest(value, row.last_successful_check_at),
    null,
  );
  const success = automaticSuccess
    ? Date.parse(automaticSuccess)
    : Number.NEGATIVE_INFINITY;
  const failed = automaticRows.some(
    (row) =>
      row.has_current_failure ??
      (row.last_failure_at !== null &&
        Date.parse(row.last_failure_at) >
          (row.last_successful_check_at
            ? Date.parse(row.last_successful_check_at)
            : Number.NEGATIVE_INFINITY)),
  );
  return {
    lastSuccessfulCheckAt,
    lastFailureAt,
    health: (failed
      ? "failed"
      : Number.isFinite(success)
        ? "ok"
        : "unknown") as SourceHealth,
  };
}

function summaryDates(
  sourceId: string,
  predictions: CurrentCategoryPredictionView[],
) {
  const publications = predictions.flatMap((category) =>
    category.aggregate.sourceLists
      .filter((source) => source.sourceId === sourceId)
      .flatMap((source) => (source.publishedAt ? [source.publishedAt] : [])),
  );
  const changes = predictions.flatMap((category) => {
    const changed = category.sourceLastChangedAt[sourceId];
    return changed ? [changed] : [];
  });
  return {
    activeCategoryCount: predictions.filter((category) =>
      category.aggregate.sourceLists.some(
        (source) => source.sourceId === sourceId,
      ),
    ).length,
    lastPublishedAt: publications.sort().at(-1) ?? null,
    lastChangedAt: changes.sort().at(-1) ?? null,
  };
}

function fixtureIndex(
  predictions: CurrentCategoryPredictionView[],
  precursors: PrecursorEditionView[],
): SourceIndexView[] {
  const sourceById = new Map<
    string,
    { id: string; name: string; url: string }
  >();
  for (const category of predictions) {
    for (const source of category.aggregate.sourceLists) {
      sourceById.set(source.sourceId, {
        id: source.sourceId,
        name: source.sourceName,
        url: source.publicationUrl,
      });
    }
  }
  const predicted = [...sourceById.values()].map((source) => ({
    ...source,
    homepageUrl: source.url,
    sourceTypes: ["prediction"],
    editorialStatus: "selected",
    technicalStatus: "prototype",
    publicationStatus: "publishable",
    lastReviewedOn: null,
    ...summaryDates(source.id, predictions),
    lastSuccessfulCheckAt: null,
    lastFailureAt: null,
    health: "unknown" as const,
  }));
  const supplemental = [
    ["tmdb", "TMDB", "https://www.themoviedb.org/", "metadata"],
    ["metacritic", "Metacritic", "https://www.metacritic.com/movie/", "score"],
    [
      "academy",
      "Academy of Motion Picture Arts and Sciences",
      "https://www.oscars.org/",
      "official",
    ],
    ["kalshi", "Kalshi", "https://kalshi.com/", "market"],
    ["polymarket", "Polymarket", "https://polymarket.com/", "market"],
    [
      "sundance",
      "Sundance Film Festival",
      "https://www.sundance.org/festivals/sundance-film-festival/",
      "festival",
    ],
    [
      "berlinale",
      "Berlin International Film Festival",
      "https://www.berlinale.de/en/home.html",
      "festival",
    ],
    [
      "cannes",
      "Festival de Cannes",
      "https://www.festival-cannes.com/en/",
      "festival",
    ],
    [
      "locarno",
      "Locarno Film Festival",
      "https://www.locarnofestival.ch/",
      "festival",
    ],
    [
      "venice",
      "La Biennale di Venezia — Cinema",
      "https://www.labiennale.org/en/cinema",
      "festival",
    ],
    [
      "tiff",
      "Toronto International Film Festival",
      "https://tiff.net/",
      "festival",
    ],
    [
      "san-sebastian",
      "Festival de San Sebastián",
      "https://www.sansebastianfestival.com/",
      "festival",
    ],
    [
      "telluride",
      "Telluride Film Festival",
      "https://www.telluridefilmfestival.org/",
      "festival",
    ],
    [
      "nyff",
      "New York Film Festival",
      "https://www.filmlinc.org/nyff/",
      "festival",
    ],
    ...precursors
      .filter((edition) => edition.ceremonyYear === 2027)
      .map((edition) => [
        edition.organizationId,
        edition.name,
        edition.homepageUrl,
        "official",
      ]),
  ].map(([id, name, homepageUrl, sourceType]) => ({
    id,
    name,
    homepageUrl,
    sourceTypes: [sourceType],
    editorialStatus: "selected",
    technicalStatus: sourceType === "official" ? "manual" : "automated",
    publicationStatus: "publishable",
    lastReviewedOn: "2026-09-03",
    activeCategoryCount: 0,
    lastPublishedAt: null,
    lastChangedAt: null,
    lastSuccessfulCheckAt: null,
    lastFailureAt: null,
    health: "unknown" as const,
  }));
  return [...predicted, ...supplemental]
    .filter(
      (source, index, sources) =>
        sources.findIndex((candidate) => candidate.id === source.id) === index,
    )
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
}

function withPrecursorEvidence(
  sources: SourceIndexView[],
  precursors: PrecursorEditionView[],
): SourceIndexView[] {
  return sources.map((source) => {
    const sets = precursors
      .filter((edition) => edition.organizationId === source.id)
      .flatMap((edition) =>
        [edition.schedule, edition.nominations, edition.winners].filter(
          (set) => set !== null,
        ),
      );
    if (!sets.length) return source;
    return {
      ...source,
      lastPublishedAt:
        sets
          .flatMap((set) => (set.publishedAt ? [set.publishedAt] : []))
          .sort()
          .at(-1) ?? null,
      lastCapturedAt:
        sets
          .map((set) => set.capturedAt)
          .sort()
          .at(-1) ?? null,
    };
  });
}

function withFestivalEvidence(
  sources: SourceIndexView[],
  festivals: FestivalEditionView[],
  connectors: FestivalConnectorRow[] = [],
): SourceIndexView[] {
  return sources.map((source) => {
    const editions = festivals.filter(
      (edition) => edition.festivalId === source.id,
    );
    const sets = editions.flatMap((edition) =>
      [edition.selection, edition.awards].filter((set) => set !== null),
    );
    if (!editions.length) return source;
    const archiveConnectors = connectors.filter(
      (connector) =>
        connector.source_id === source.id &&
        connector.is_active === false &&
        (connector.configuration.manual_archive_kinds?.length ?? 0) > 0,
    );
    const festivalArchiveReviewed =
      archiveConnectors.length > 0 &&
      archiveConnectors.every((connector) => {
        const edition = editions.find(
          (edition) => edition.id === connector.configuration.edition_id,
        );
        return (
          edition?.status === "completed" &&
          connector.configuration.manual_archive_kinds!.every((kind) => {
            if (kind !== "selection" && kind !== "awards") return false;
            const set = edition[kind];
            return (
              set !== null &&
              set.entries.length >=
                Math.max(
                  1,
                  connector.configuration.minimum_entries?.[kind] ?? 1,
                )
            );
          })
        );
      });
    return {
      ...source,
      festivalArchiveReviewed,
      lastPublishedAt: sets.reduce<string | null>(
        (value, set) => latest(value, set.publishedAt),
        source.lastPublishedAt,
      ),
      lastCapturedAt: sets.reduce<string | null>(
        (value, set) => latest(value, set.capturedAt),
        source.lastCapturedAt ?? null,
      ),
    };
  });
}

export async function getSourceIndex(): Promise<SourceIndexView[]> {
  const [predictions, precursors, festivals] = await Promise.all([
    getCurrentCategoryPredictions(),
    getPrecursorIndex(),
    getFestivalIndex(),
  ]);
  if (!isSupabaseConfigured())
    return withFestivalEvidence(
      withPrecursorEvidence(fixtureIndex(predictions, precursors), precursors),
      festivals,
    );
  try {
    const supabase = client();
    const [
      sourcesResult,
      connectorsResult,
      marketConnectorsResult,
      festivalConnectorsResult,
    ] = await Promise.all([
      supabase
        .from("sources")
        .select(
          "id,name,homepage_url,source_types,editorial_status,technical_status,publication_status,last_reviewed_on",
        ),
      supabase
        .from("public_source_freshness")
        .select(
          "source_id,last_successful_check_at,last_failure_at,has_current_failure,has_active_connector",
        ),
      supabase
        .from("market_connectors")
        .select("source_id,is_active,last_success_at,last_failure_at"),
      supabase
        .from("public_festival_freshness")
        .select(
          "source_id,is_active,configuration,last_success_at,last_failure_at",
        ),
    ]);
    if (sourcesResult.error) throw new Error(sourcesResult.error.message);
    const connectorRows: ConnectorRow[] = [
      ...(connectorsResult.error ? [] : (connectorsResult.data ?? [])),
      ...(marketConnectorsResult.error
        ? []
        : (marketConnectorsResult.data ?? [])
      ).map((connector) => ({
        source_id: connector.source_id,
        last_successful_check_at: connector.last_success_at,
        last_failure_at: connector.last_failure_at,
        is_active: connector.is_active,
      })),
      ...(festivalConnectorsResult.error
        ? []
        : (festivalConnectorsResult.data ?? [])
      ).map((connector) => ({
        source_id: connector.source_id,
        last_successful_check_at: connector.last_success_at,
        last_failure_at: connector.last_failure_at,
        is_active: connector.is_active,
      })),
    ];
    const sources = (sourcesResult.data ?? [])
      .map((source): SourceIndexView => ({
        id: source.id,
        name: source.name,
        homepageUrl: source.homepage_url,
        sourceTypes: source.source_types,
        editorialStatus: source.editorial_status,
        technicalStatus: source.technical_status,
        publicationStatus: source.publication_status,
        lastReviewedOn: source.last_reviewed_on,
        ...summaryDates(source.id, predictions),
        ...connectorSummary(
          connectorRows.filter(
            (connector) => connector.source_id === source.id,
          ),
        ),
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "es"));
    const festivalConnectors = (
      festivalConnectorsResult.error
        ? []
        : (festivalConnectorsResult.data ?? [])
    ).map((connector) => ({
      source_id: connector.source_id,
      is_active: connector.is_active,
      configuration: connector.configuration,
      last_successful_check_at: connector.last_success_at,
      last_failure_at: connector.last_failure_at,
    }));
    return withFestivalEvidence(
      withPrecursorEvidence(sources, precursors),
      festivals,
      festivalConnectors,
    );
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    return withFestivalEvidence(
      withPrecursorEvidence(fixtureIndex(predictions, precursors), precursors),
      festivals,
    );
  }
}

function categoryViews(
  sourceId: string,
  predictions: CurrentCategoryPredictionView[],
  publications: Map<
    string,
    {
      externalId: string;
      title: string;
      url: string;
      author: string | null;
      publishedAt: string | null;
      capturedAt: string | null;
      extractorVersion: string | null;
    }
  >,
  originalByObservationId: Map<string, unknown>,
): SourceCategoryView[] {
  return predictions.flatMap((category) => {
    const source = category.aggregate.sourceLists.find(
      (item) => item.sourceId === sourceId,
    );
    if (!source) return [];
    const fallbackPublication = {
      externalId: source.publicationId,
      title: `${source.sourceName} · ${category.categoryName}`,
      url: source.publicationUrl,
      author: null,
      publishedAt: source.publishedAt,
      capturedAt: null,
      extractorVersion: null,
    };
    const entries = category.aggregate.ranking.flatMap((candidate) => {
      const contribution = candidate.sourceContributions.find(
        (item) => item.sourceId === sourceId,
      );
      if (!contribution || contribution.appearanceKind === "absent") return [];
      return [
        {
          candidateId: candidate.candidateId,
          label: candidate.label,
          appearanceKind: contribution.appearanceKind,
          rank: contribution.rank,
          listLength: contribution.listLength,
          points: contribution.points,
          originalValue: contribution.observationId
            ? (originalByObservationId.get(contribution.observationId) ??
              candidate.label)
            : candidate.label,
          aggregatePosition: candidate.position,
          aggregateScore: candidate.scoreOutOf100,
          aggregateCoverage: `${candidate.appearances}/${candidate.applicableSourceCount}`,
          aggregateSources: candidate.sourceContributions
            .filter((item) => item.appeared)
            .map((item) => ({ id: item.sourceId, name: item.sourceName })),
        },
      ];
    });
    entries.sort(
      (left, right) =>
        (left.rank ?? Number.POSITIVE_INFINITY) -
          (right.rank ?? Number.POSITIVE_INFINITY) ||
        left.label.localeCompare(right.label, "es"),
    );
    return [
      {
        categoryId: category.categoryId,
        categorySlug: category.categorySlug,
        categoryName: category.categoryName,
        intention: category.aggregate.intention,
        lastChangedAt:
          category.sourceLastChangedAt[sourceId] ?? category.lockedAt,
        publication:
          publications.get(source.publicationId) ?? fallbackPublication,
        entries,
      },
    ];
  });
}

export const getSourceDetail = cache(async function getSourceDetail(
  sourceId: string,
): Promise<SourceDetailView | null> {
  const [predictions, festivals] = await Promise.all([
    getCurrentCategoryPredictions(),
    getFestivalIndex(),
  ]);
  const festivalEditions = festivals
    .filter((edition) => edition.festivalId === sourceId)
    .sort((left, right) => right.year - left.year);
  const summary = (await getSourceIndex()).find(
    (source) => source.id === sourceId,
  );
  if (!summary) return null;
  if (!isSupabaseConfigured()) {
    return {
      ...summary,
      festivalEditions,
      notes: null,
      categories: categoryViews(sourceId, predictions, new Map(), new Map()),
    };
  }
  try {
    const supabase = client();
    const publicationIds = predictions.flatMap((category) =>
      category.aggregate.sourceLists
        .filter((source) => source.sourceId === sourceId)
        .map((source) => source.publicationId),
    );
    const [sourceResult, publicationResult] = await Promise.all([
      supabase.from("sources").select("notes").eq("id", sourceId).single(),
      publicationIds.length
        ? supabase
            .from("source_publications")
            .select("id,external_id,canonical_url,title,author,published_at")
            .eq("source_id", sourceId)
            .in("external_id", publicationIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (sourceResult.error) throw new Error(sourceResult.error.message);
    if (publicationResult.error)
      throw new Error(publicationResult.error.message);
    const publicationRows = publicationResult.data ?? [];
    const observationIds = predictions.flatMap((category) =>
      category.aggregate.ranking.flatMap((candidate) =>
        candidate.sourceContributions.flatMap((contribution) =>
          contribution.sourceId === sourceId && contribution.observationId
            ? [contribution.observationId]
            : [],
        ),
      ),
    );
    const observations = await fetchRowsByIds(observationIds, (ids) =>
      fetchAllRows((from, to) =>
        supabase
          .from("professional_observations")
          .select(
            "id,publication_id,original_value,captured_at,extractor_version",
          )
          .eq("source_id", sourceId)
          .eq("state", "published")
          .in("id", ids)
          .order("id")
          .range(from, to),
      ),
    );
    const publications = new Map(
      publicationRows.map((publication) => {
        const captures = observations
          .filter(
            (observation) => observation.publication_id === publication.id,
          )
          .sort(
            (left, right) =>
              Date.parse(right.captured_at) - Date.parse(left.captured_at),
          );
        return [
          publication.external_id,
          {
            externalId: publication.external_id,
            title: publication.title,
            url: publication.canonical_url,
            author: publication.author,
            publishedAt: publication.published_at,
            capturedAt: captures[0]?.captured_at ?? null,
            extractorVersion: captures[0]?.extractor_version ?? null,
          },
        ] as const;
      }),
    );
    const originalByObservationId = new Map(
      observations.map((observation) => [
        String(observation.id),
        observation.original_value,
      ]),
    );
    return {
      ...summary,
      festivalEditions,
      notes: sourceResult.data.notes,
      categories: categoryViews(
        sourceId,
        predictions,
        publications,
        originalByObservationId,
      ),
    };
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    return {
      ...summary,
      festivalEditions,
      notes: null,
      categories: categoryViews(sourceId, predictions, new Map(), new Map()),
    };
  }
});
