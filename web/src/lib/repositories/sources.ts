import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "../environment";
import { createSupabaseServerClient } from "../supabase/server";
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
};

type ConnectorRow = {
  source_id: string | null;
  last_successful_check_at: string | null;
  last_failure_at: string | null;
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
  const success = lastSuccessfulCheckAt
    ? Date.parse(lastSuccessfulCheckAt)
    : Number.NEGATIVE_INFINITY;
  const failure = lastFailureAt
    ? Date.parse(lastFailureAt)
    : Number.NEGATIVE_INFINITY;
  return {
    lastSuccessfulCheckAt,
    lastFailureAt,
    health: (failure > success
      ? "failed"
      : Number.isFinite(success)
        ? "ok"
        : "unknown") as SourceHealth,
  };
}

function activeSourceIds(predictions: CurrentCategoryPredictionView[]) {
  return [
    ...new Set(
      predictions.flatMap((category) =>
        category.aggregate.sourceLists.map((source) => source.sourceId),
      ),
    ),
  ];
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
  return [...sourceById.values()]
    .map((source) => ({
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
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
}

export async function getSourceIndex(): Promise<SourceIndexView[]> {
  const predictions = await getCurrentCategoryPredictions();
  if (!isSupabaseConfigured()) return fixtureIndex(predictions);
  try {
    const supabase = client();
    const criticalResult = await supabase
      .from("professional_observations")
      .select("source_id")
      .eq("state", "published")
      .in("data_type", ["review", "score_individual", "score_aggregate"]);
    if (criticalResult.error) throw new Error(criticalResult.error.message);
    const sourceIds = [
      ...new Set([
        ...activeSourceIds(predictions),
        ...(criticalResult.data ?? []).map((row) => row.source_id),
      ]),
    ];
    if (!sourceIds.length) return [];
    const [sourcesResult, connectorsResult] = await Promise.all([
      supabase
        .from("sources")
        .select(
          "id,name,homepage_url,source_types,editorial_status,technical_status,publication_status,last_reviewed_on",
        )
        .in("id", sourceIds),
      supabase
        .from("public_source_freshness")
        .select("source_id,last_successful_check_at,last_failure_at")
        .in("source_id", sourceIds),
    ]);
    if (sourcesResult.error) throw new Error(sourcesResult.error.message);
    return (sourcesResult.data ?? [])
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
          (connectorsResult.error ? [] : (connectorsResult.data ?? [])).filter(
            (connector) => connector.source_id === source.id,
          ),
        ),
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "es"));
  } catch {
    return process.env.NODE_ENV === "production"
      ? []
      : fixtureIndex(predictions);
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

export async function getSourceDetail(
  sourceId: string,
): Promise<SourceDetailView | null> {
  const predictions = await getCurrentCategoryPredictions();
  const summary = (await getSourceIndex()).find(
    (source) => source.id === sourceId,
  );
  if (!summary) return null;
  if (!isSupabaseConfigured()) {
    return {
      ...summary,
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
    const databasePublicationIds = publicationRows.map((row) => row.id);
    const observationsResult = databasePublicationIds.length
      ? await supabase
          .from("professional_observations")
          .select(
            "id,publication_id,original_value,captured_at,extractor_version",
          )
          .eq("source_id", sourceId)
          .eq("state", "published")
          .in("publication_id", databasePublicationIds)
      : { data: [], error: null };
    if (observationsResult.error) {
      throw new Error(observationsResult.error.message);
    }
    const publications = new Map(
      publicationRows.map((publication) => {
        const captures = (observationsResult.data ?? [])
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
      (observationsResult.data ?? []).map((observation) => [
        String(observation.id),
        observation.original_value,
      ]),
    );
    return {
      ...summary,
      notes: sourceResult.data.notes,
      categories: categoryViews(
        sourceId,
        predictions,
        publications,
        originalByObservationId,
      ),
    };
  } catch {
    return process.env.NODE_ENV === "production"
      ? null
      : {
          ...summary,
          notes: null,
          categories: categoryViews(
            sourceId,
            predictions,
            new Map(),
            new Map(),
          ),
        };
  }
}
