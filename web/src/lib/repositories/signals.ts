import "server-only";
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
import {
  isMetacriticTitleUrl,
  parseMetacriticValues,
} from "../critical/metacritic";
import { referenceCriticalScoreObservations } from "../../data/phase6-reference";

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

export type MetacriticScoreView = {
  score: number;
  reviewCount: number | null;
  publicationUrl: string;
  capturedAt: string;
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

function fixtureMetacriticScore(filmId: string): MetacriticScoreView | null {
  const observation = referenceCriticalScoreObservations.find(
    (item) =>
      item.filmId === filmId &&
      item.sourceId === "metacritic" &&
      item.dataType === "score_aggregate" &&
      item.state === "published",
  );
  if (
    !observation ||
    observation.numericValue === null ||
    !isMetacriticTitleUrl(observation.publicationUrl)
  ) {
    return null;
  }
  const countMatch = observation.scaleLabel.match(/(\d[\d,]*)\s+critic/i);
  return {
    score: observation.numericValue,
    reviewCount: countMatch ? Number(countMatch[1].replaceAll(",", "")) : null,
    publicationUrl: observation.publicationUrl,
    capturedAt: observation.capturedAt,
  };
}

export async function getFilmMetacriticScore(
  filmId: string,
): Promise<MetacriticScoreView | null> {
  if (!isSupabaseConfigured()) return fixtureMetacriticScore(filmId);
  try {
    const supabase = createSupabaseServerClient();
    const result = await supabase
      .from("professional_observations")
      .select("original_value,original_scale,source_url,captured_at")
      .eq("film_id", filmId)
      .eq("source_id", "metacritic")
      .eq("data_type", "score_aggregate")
      .eq("state", "published")
      .order("captured_at", { ascending: false })
      .limit(5);
    if (result.error) throw new Error(result.error.message);

    for (const row of result.data ?? []) {
      const values = parseMetacriticValues(
        row.original_value,
        row.original_scale,
      );
      if (!values || !isMetacriticTitleUrl(row.source_url)) continue;
      return {
        ...values,
        publicationUrl: row.source_url,
        capturedAt: row.captured_at,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function predictionCategory(id: string) {
  return categoryById(id);
}
