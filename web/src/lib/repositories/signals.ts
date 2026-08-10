import "server-only";
import {
  aggregateCriticalReception,
  type CriticalReceptionAggregate,
  type CriticalScoreObservation,
} from "../aggregation";
import type { PredictionAggregateV2 } from "../aggregation/v2";
import { compareSnapshotMovements } from "../snapshots/movements";
import {
  buildRealProviderCuts,
  type SnapshotHistoryEntry,
} from "../snapshots/provider-cuts";
import { isSupabaseConfigured } from "../environment";
import { createSupabaseServerClient } from "../supabase/server";
import {
  PUBLIC_CATEGORIES,
  categoryById,
  type PublicCategoryId,
} from "../categories/config";
import {
  phase71FixtureAggregate,
  phase71FixturePreviousAggregate,
} from "../../data/phase71-fixture";

export type CurrentCategoryPredictionView = {
  categoryId: PublicCategoryId;
  categorySlug: string;
  categoryName: string;
  lockedAt: string;
  changedSourceIds: string[];
  sourceLastChangedAt: Record<string, string>;
  aggregate: PredictionAggregateV2;
};

export type FilmPredictionView = {
  categoryId: PublicCategoryId;
  categorySlug: string;
  categoryName: string;
  lockedAt: string;
  candidate: PredictionAggregateV2["ranking"][number];
};

export type LinkedReviewView = {
  id: string;
  sourceName: string;
  title: string;
  author: string | null;
  publishedAt: string | null;
  capturedAt: string;
  publicationUrl: string;
};

export type FilmCriticalView = {
  aggregate: CriticalReceptionAggregate;
  reviews: LinkedReviewView[];
};

type SnapshotRow = {
  id: string;
  category_id: string;
  content_hash: string;
  locked_at: string;
  method_version: string;
  schema_version: string;
  payload: unknown;
};

function snapshotEntry(row: SnapshotRow): SnapshotHistoryEntry | null {
  const payload = row.payload as { aggregate?: PredictionAggregateV2 };
  if (
    row.schema_version !== "runscars-snapshot-v2" ||
    !payload.aggregate ||
    payload.aggregate.methodVersion !== row.method_version
  ) {
    return null;
  }
  return {
    id: row.id,
    contentHash: row.content_hash,
    lockedAt: row.locked_at,
    methodVersion: row.method_version,
    schemaVersion: row.schema_version,
    aggregate: payload.aggregate,
  };
}

function currentViewsFromRows(
  rows: SnapshotRow[],
  pointerByCategory: Map<string, string>,
): CurrentCategoryPredictionView[] {
  return PUBLIC_CATEGORIES.flatMap((category) => {
    const pointerId = pointerByCategory.get(category.id);
    const pointer = rows.find((row) => row.id === pointerId);
    if (!pointer) return [];
    const history = rows
      .filter(
        (row) =>
          row.category_id === category.id &&
          row.method_version === pointer.method_version &&
          Date.parse(row.locked_at) <= Date.parse(pointer.locked_at),
      )
      .flatMap((row) => {
        const entry = snapshotEntry(row);
        return entry ? [entry] : [];
      });
    const cuts = buildRealProviderCuts(history);
    const current = cuts.at(-1);
    if (!current) return [];
    const previous = cuts.at(-2) ?? null;
    const sourceLastChangedAt = Object.fromEntries(
      current.aggregate.sourceLists.map((source) => {
        const changed = [...cuts]
          .reverse()
          .find((cut) => cut.changedSourceIds.includes(source.sourceId));
        return [source.sourceId, changed?.lockedAt ?? current.lockedAt];
      }),
    );
    return [
      {
        categoryId: category.id,
        categorySlug: category.slug,
        categoryName: category.name,
        lockedAt: current.lockedAt,
        changedSourceIds: current.changedSourceIds,
        sourceLastChangedAt,
        aggregate: compareSnapshotMovements(
          current.aggregate,
          previous?.aggregate ?? null,
        ),
      },
    ];
  });
}

function fixtureCurrentPredictions(): CurrentCategoryPredictionView[] {
  return PUBLIC_CATEGORIES.map((category) => {
    const aggregate = phase71FixtureAggregate(category.id);
    const previous = phase71FixturePreviousAggregate(category.id);
    return {
      categoryId: category.id,
      categorySlug: category.slug,
      categoryName: category.name,
      lockedAt: "2026-07-25T04:47:00.000Z",
      changedSourceIds: aggregate.sourceLists.map((source) => source.sourceId),
      sourceLastChangedAt: Object.fromEntries(
        aggregate.sourceLists.map((source) => [
          source.sourceId,
          "2026-07-25T04:47:00.000Z",
        ]),
      ),
      aggregate: compareSnapshotMovements(aggregate, previous),
    };
  });
}

export async function getCurrentCategoryPredictions(): Promise<
  CurrentCategoryPredictionView[]
> {
  if (!isSupabaseConfigured()) return fixtureCurrentPredictions();
  try {
    const supabase = createSupabaseServerClient();
    const pointerResult = await supabase
      .from("current_aggregate_snapshots")
      .select("category_id,snapshot_id")
      .eq("season_id", "oscars-2027")
      .eq("prediction_intention", "nomination")
      .eq("kind", "periodic")
      .in(
        "category_id",
        PUBLIC_CATEGORIES.map((category) => category.id),
      );
    if (pointerResult.error) throw new Error(pointerResult.error.message);
    const pointerByCategory = new Map(
      (pointerResult.data ?? []).map((pointer) => [
        pointer.category_id,
        pointer.snapshot_id,
      ]),
    );
    const historyResult = await supabase
      .from("aggregate_snapshots")
      .select(
        "id,category_id,content_hash,locked_at,method_version,schema_version,payload",
      )
      .eq("season_id", "oscars-2027")
      .eq("prediction_intention", "nomination")
      .eq("kind", "periodic")
      .eq("schema_version", "runscars-snapshot-v2")
      .in(
        "category_id",
        PUBLIC_CATEGORIES.map((category) => category.id),
      )
      .order("locked_at", { ascending: true })
      .order("id", { ascending: true });
    if (historyResult.error) throw new Error(historyResult.error.message);
    return currentViewsFromRows(
      (historyResult.data ?? []) as SnapshotRow[],
      pointerByCategory,
    );
  } catch {
    return process.env.NODE_ENV === "production"
      ? []
      : fixtureCurrentPredictions();
  }
}

export async function getFilmPredictions(
  filmId: string,
): Promise<FilmPredictionView[]> {
  const categories = await getCurrentCategoryPredictions();
  return categories.flatMap((category) => {
    const candidate = category.aggregate.ranking.find(
      (item) => item.film?.id === filmId,
    );
    return candidate
      ? [
          {
            categoryId: category.categoryId,
            categorySlug: category.categorySlug,
            categoryName: category.categoryName,
            lockedAt: category.lockedAt,
            candidate,
          },
        ]
      : [];
  });
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function getFilmCriticalView(
  filmId: string,
  filmTitle: string,
): Promise<FilmCriticalView | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createSupabaseServerClient();
    const result = await supabase
      .from("professional_observations")
      .select(
        "id,data_type,original_value,original_scale,author,published_at,captured_at,participates,state,sources(id,name),source_publications(external_id,canonical_url,title,author)",
      )
      .eq("film_id", filmId)
      .eq("state", "published")
      .in("data_type", ["review", "score_individual", "score_aggregate"])
      .order("published_at", { ascending: false, nullsFirst: false });
    if (result.error) throw new Error(result.error.message);
    const observations: CriticalScoreObservation[] = [];
    const reviews: LinkedReviewView[] = [];
    for (const row of result.data ?? []) {
      const source = Array.isArray(row.sources) ? row.sources[0] : row.sources;
      const publication = Array.isArray(row.source_publications)
        ? row.source_publications[0]
        : row.source_publications;
      if (!source || !publication) continue;
      if (row.data_type === "review") {
        reviews.push({
          id: String(row.id),
          sourceName: source.name,
          title: publication.title,
          author: row.author ?? publication.author,
          publishedAt: row.published_at,
          capturedAt: row.captured_at,
          publicationUrl: publication.canonical_url,
        });
        continue;
      }
      if (
        row.data_type !== "score_individual" &&
        row.data_type !== "score_aggregate"
      ) {
        continue;
      }
      const original = jsonRecord(row.original_value);
      const scale = jsonRecord(row.original_scale);
      const numericValue = numeric(original.score ?? original.value);
      const scaleMin = numeric(scale.minimum ?? scale.min);
      const scaleMax = numeric(scale.maximum ?? scale.max);
      observations.push({
        id: String(row.id),
        sourceId: source.id,
        sourceName: source.name,
        publicationId: publication.external_id,
        publicationUrl: publication.canonical_url,
        author: row.author ?? publication.author,
        publishedAt: row.published_at,
        capturedAt: row.captured_at,
        seasonId: "oscars-2027",
        filmId,
        filmTitle,
        participates: row.participates,
        state: row.state,
        dataType: row.data_type,
        canonicalReviewId: publication.external_id,
        originalDisplay:
          numericValue !== null && scaleMax !== null
            ? `${numericValue}/${scaleMax}`
            : JSON.stringify(row.original_value),
        numericValue,
        scaleMin,
        scaleMax,
        scaleLabel:
          typeof scale.unit === "string" ? scale.unit : "escala original",
      });
    }
    const aggregate = aggregateCriticalReception(observations, filmId);
    if (
      aggregate.scores.length === 0 &&
      aggregate.contextualScores.length === 0 &&
      reviews.length === 0
    ) {
      return null;
    }
    return { aggregate, reviews };
  } catch {
    return null;
  }
}

export function predictionCategory(id: string) {
  return categoryById(id);
}
