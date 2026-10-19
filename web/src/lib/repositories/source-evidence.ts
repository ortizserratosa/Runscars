import type { CurrentCategoryPredictionView } from "./signals";
import {
  isPredictionFresh,
  PREDICTION_FRESHNESS_DAYS,
} from "../aggregation/freshness";

export type PredictionEvidenceRow = {
  id: number;
  source_id: string;
  source_name: string;
  category_id: string;
  prediction_intention: "nomination" | "winner";
  category_candidate_id: string | null;
  candidate_label: string | null;
  original_subject: string;
  original_value: unknown;
  original_count?: number | null;
  data_type: "prediction_ordered" | "prediction_selection";
  participates: boolean;
  published_at: string | null;
  captured_at: string;
  freshness_at: string;
  extractor_version: string;
  publication_external_id: string;
  publication_title: string;
  publication_url: string;
  author: string | null;
};

export type PredictionConnectorRow = {
  source_id: string;
  category_id: string;
  last_successful_check_at: string | null;
  last_failure_at: string | null;
  has_current_failure: boolean;
};

export function predictionEvidenceState(freshnessAt: string, now: string) {
  return {
    freshnessAt,
    expiresAt: new Date(
      Date.parse(freshnessAt) + PREDICTION_FRESHNESS_DAYS * 86_400_000,
    ).toISOString(),
    expired: !isPredictionFresh(freshnessAt, now),
  };
}

function numeric(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = (value as Record<string, unknown>)[key];
  return typeof result === "number" && Number.isInteger(result) && result > 0
    ? result
    : null;
}

export function sourceEvidenceCategories(
  rows: PredictionEvidenceRow[],
  predictions: CurrentCategoryPredictionView[],
  connectors: PredictionConnectorRow[],
  now: string,
) {
  return predictions.flatMap((category) => {
    const evidence = rows.filter(
      (row) =>
        row.category_id === category.categoryId &&
        row.prediction_intention === "nomination",
    );
    const first = evidence[0];
    if (!first) return [];
    const source = category.aggregate.sourceLists.find(
      (item) => item.sourceId === first.source_id,
    );
    const consideredIds = new Set(
      source
        ? [...source.orderedObservationIds, ...source.selectionObservationIds]
        : [],
    );
    const connector = connectors.find(
      (item) =>
        item.source_id === first.source_id &&
        item.category_id === category.categoryId,
    );
    const state = predictionEvidenceState(first.freshness_at, now);
    const entries = evidence
      .map((row) => {
        const candidate = category.aggregate.ranking.find(
          (item) => item.candidateId === row.category_candidate_id,
        );
        const contribution = candidate?.sourceContributions.find(
          (item) =>
            item.sourceId === row.source_id &&
            item.observationId === String(row.id),
        );
        return {
          observationId: String(row.id),
          candidateId: row.category_candidate_id ?? String(row.id),
          label: row.candidate_label ?? row.original_subject,
          appearanceKind:
            row.data_type === "prediction_ordered"
              ? ("ordered" as const)
              : ("selection" as const),
          rank: numeric(row.original_value, "rank"),
          listLength:
            numeric(row.original_value, "list_length") ?? evidence.length,
          considered: !state.expired && consideredIds.has(String(row.id)),
          points: contribution?.points ?? 0,
          originalValue: row.original_value,
          aggregatePosition: candidate?.position ?? 0,
          aggregateScore: candidate?.scoreOutOf100 ?? 0,
          aggregateCoverage: candidate
            ? `${candidate.appearances}/${candidate.applicableSourceCount}`
            : "0/0",
          aggregateSources:
            candidate?.sourceContributions
              .filter((item) => item.appeared)
              .map((item) => ({ id: item.sourceId, name: item.sourceName })) ??
            [],
        };
      })
      .sort(
        (a, b) =>
          (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
          a.label.localeCompare(b.label, "es"),
      );
    return [
      {
        categoryId: category.categoryId,
        categorySlug: category.categorySlug,
        categoryName: category.categoryName,
        intention: first.prediction_intention,
        lastChangedAt: category.sourceLastChangedAt[first.source_id] ?? null,
        publication: {
          externalId: first.publication_external_id,
          title: first.publication_title,
          url: first.publication_url,
          author: first.author,
          publishedAt: first.published_at,
          capturedAt: first.captured_at,
          extractorVersion: first.extractor_version,
        },
        ...state,
        originalCount: Math.max(
          first.original_count ?? 0,
          ...entries.map((entry) => entry.listLength),
        ),
        matchedCount: entries.length,
        consideredCount: entries.filter((entry) => entry.considered).length,
        scoringDepth: category.aggregate.scoringDepth ?? null,
        health: connector?.has_current_failure
          ? ("failed" as const)
          : connector?.last_successful_check_at
            ? ("ok" as const)
            : ("unknown" as const),
        lastSuccessfulCheckAt: connector?.last_successful_check_at ?? null,
        lastFailureAt: connector?.last_failure_at ?? null,
        entries,
      },
    ];
  });
}
