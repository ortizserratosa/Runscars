import "server-only";
import { cache } from "react";
import type { PredictionAggregateV2 } from "../aggregation/v2";
import {
  canCompareSnapshotMovements,
  compareSnapshotMovements,
} from "../snapshots/movements";
import {
  getCurrentPublicSnapshotPointers,
  getPublicHistorySelection,
} from "../snapshots/public-history";
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

async function databaseCurrentPredictions(): Promise<
  CurrentCategoryPredictionView[]
> {
  const pointers = await getCurrentPublicSnapshotPointers();
  const pointerByCategory = new Map(
    pointers.map((pointer) => [pointer.category_id, pointer.snapshot_id]),
  );
  // Each category caches its own compact projection by immutable pointer.
  // A failed category read throws; it never replaces cached data with fixtures.
  const views = await Promise.all(
    PUBLIC_CATEGORIES.map(async (category) => {
      const pointerId = pointerByCategory.get(category.id);
      if (!pointerId) return null;
      const {
        cuts,
        selected: current,
        previous,
      } = await getPublicHistorySelection(category.id, pointerId);
      if (!current) return null;
      return {
        categoryId: category.id,
        categorySlug: category.slug,
        categoryName: category.name,
        lockedAt: current.lockedAt,
        changedSourceIds: current.changedSourceIds,
        sourceLastChangedAt: Object.fromEntries(
          current.aggregate.sourceLists.map((source) => {
            const changed = cuts.findLast((cut) =>
              cut.changedSourceIds.includes(source.sourceId),
            );
            return [source.sourceId, changed?.lockedAt ?? current.lockedAt];
          }),
        ),
        aggregate: compareSnapshotMovements(
          current.aggregate,
          previous &&
            !current.comparisonDateIncomplete &&
            !previous.comparisonDateIncomplete &&
            canCompareSnapshotMovements(current.aggregate, previous.aggregate)
            ? previous.aggregate
            : null,
        ),
      };
    }),
  );
  return views.filter((view) => view !== null);
}

export const getCurrentCategoryPredictions = cache(
  async (): Promise<CurrentCategoryPredictionView[]> => {
    if (!isSupabaseConfigured()) return fixtureCurrentPredictions();
    try {
      return await databaseCurrentPredictions();
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw error;
      return fixtureCurrentPredictions();
    }
  },
);

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
