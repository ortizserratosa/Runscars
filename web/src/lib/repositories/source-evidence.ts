import type { CurrentCategoryPredictionView } from "./signals";
import { AGGREGATION_METHOD_VERSION_V4 } from "../aggregation/v2";
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

function effectiveHeadMatches(
  evidence: PredictionEvidenceRow[],
  category: CurrentCategoryPredictionView,
) {
  const sourceId = evidence[0].source_id;
  const source = category.aggregate.sourceLists.find(
    (item) => item.sourceId === sourceId,
  );
  if (
    !source ||
    category.aggregate.categoryId !== category.categoryId ||
    category.aggregate.intention !== evidence[0].prediction_intention
  )
    return false;
  const bounded =
    category.aggregate.methodVersion === AGGREGATION_METHOD_VERSION_V4;
  const scoringDepth = category.aggregate.scoringDepth;
  if (
    bounded &&
    (typeof scoringDepth !== "number" ||
      !Number.isInteger(scoringDepth) ||
      scoringDepth <= 0)
  )
    return false;
  const expected = category.aggregate.ranking.flatMap((candidate) => {
    const contribution = candidate.sourceContributions.find(
      (item) => item.sourceId === sourceId && item.appeared,
    );
    return contribution
      ? [
          JSON.stringify([
            candidate.candidateId,
            contribution.appearanceKind,
            contribution.rank,
            bounded ? null : contribution.listLength,
          ]),
        ]
      : [];
  });
  if (expected.length === 0) return false;
  const actual: string[] = [];
  for (const row of evidence) {
    if (row.source_id !== sourceId) return false;
    if (!row.participates) continue;
    const ordered = row.data_type === "prediction_ordered";
    const rank = numeric(row.original_value, "rank");
    if (ordered && rank === null) return false;
    if (ordered && bounded) {
      if (rank === null || scoringDepth === undefined) return false;
      if (rank > scoringDepth) continue;
    }
    if (!row.category_candidate_id) return false;
    actual.push(
      JSON.stringify([
        row.category_candidate_id,
        ordered ? "ordered" : "selection",
        ordered ? rank : null,
        bounded
          ? null
          : ordered
            ? numeric(row.original_value, "list_length")
            : (source.listLength ?? 0),
      ]),
    );
  }
  // New captures can change only metadata or the unused tail. Their IDs differ,
  // so compare the entire effective ballot before reusing any frozen points.
  // URLs remain latest provenance: a new article with the same ballot need not
  // create a provider cut either. Changed or incomplete heads fail closed.
  return (
    new Set(actual).size === actual.length &&
    JSON.stringify(actual.sort()) === JSON.stringify(expected.sort())
  );
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
    const connector = connectors.find(
      (item) =>
        item.source_id === first.source_id &&
        item.category_id === category.categoryId,
    );
    const state = predictionEvidenceState(first.freshness_at, now);
    const matchesHead =
      !state.expired && effectiveHeadMatches(evidence, category);
    const entries = evidence
      .map((row) => {
        const rank = numeric(row.original_value, "rank");
        const appearanceKind: "ordered" | "selection" =
          row.data_type === "prediction_ordered" ? "ordered" : "selection";
        const candidate = category.aggregate.ranking.find(
          (item) => item.candidateId === row.category_candidate_id,
        );
        const contribution = candidate?.sourceContributions.find(
          (item) =>
            item.sourceId === row.source_id &&
            item.appeared &&
            item.appearanceKind === appearanceKind &&
            item.rank === (appearanceKind === "ordered" ? rank : null),
        );
        const considered =
          matchesHead && row.participates && Boolean(contribution);
        return {
          observationId: String(row.id),
          candidateId: row.category_candidate_id ?? String(row.id),
          label: row.candidate_label ?? row.original_subject,
          appearanceKind,
          rank,
          listLength:
            numeric(row.original_value, "list_length") ?? evidence.length,
          considered,
          points: considered ? (contribution?.points ?? 0) : 0,
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
