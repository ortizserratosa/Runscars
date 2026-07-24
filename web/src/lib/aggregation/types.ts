export const AGGREGATION_METHOD_VERSION = "runscars-aggregation-v1";

export type ObservationState =
  "pending_review" | "published" | "corrected" | "excluded";

type ObservationBase = {
  id: string;
  sourceId: string;
  sourceName: string;
  publicationId: string;
  publicationUrl: string;
  author: string | null;
  publishedAt: string | null;
  capturedAt: string;
  seasonId: string;
  filmId: string;
  filmTitle: string;
  participates: boolean;
  state: ObservationState;
};

export type PredictionObservation = ObservationBase & {
  dataType: "prediction_ordered" | "prediction_selection";
  categoryId: string;
  intention: "nomination" | "winner";
  rank: number | null;
  listLength: number | null;
  originalValue: string;
};

export type CriticalScoreObservation = ObservationBase & {
  dataType: "score_individual" | "score_aggregate";
  canonicalReviewId: string;
  originalDisplay: string;
  numericValue: number | null;
  scaleMin: number | null;
  scaleMax: number | null;
  scaleLabel: string;
};

export type ScoreNormalization = {
  methodVersion: typeof AGGREGATION_METHOD_VERSION;
  normalizedValue: number;
  normalizedScale: "0–5";
};

export type CriticalScoreWithNormalization = CriticalScoreObservation & {
  normalization: ScoreNormalization;
};

export type CriticalStatistics = {
  mean: number;
  median: number;
  minimum: number;
  maximum: number;
  count: number;
};

export type CriticalReceptionAggregate = {
  filmId: string;
  methodVersion: typeof AGGREGATION_METHOD_VERSION;
  isSufficient: boolean;
  minimumRequired: 3;
  scores: CriticalScoreWithNormalization[];
  contextualScores: CriticalScoreObservation[];
  statistics: CriticalStatistics | null;
  updatedAt: string | null;
  includedObservationIds: string[];
  excludedObservationIds: string[];
};

export type PredictionSourceContribution = {
  sourceId: string;
  sourceName: string;
  publicationId: string;
  publicationUrl: string;
  publishedAt: string | null;
  rank: number | null;
  listLength: number;
  points: number;
  appeared: boolean;
  appearanceKind: "ordered" | "selection" | "absent";
  observationId: string | null;
};

export type PredictionCandidateAggregate = {
  filmId: string;
  filmTitle: string;
  score: number;
  scoreOutOf100: number;
  appearances: number;
  coverage: number;
  applicableSourceCount: number;
  orderedSourceCount: number;
  meanRank: number | null;
  medianRank: number | null;
  topFiveCount: number;
  firstPlaceCount: number;
  position: number;
  movement: number | null;
  sourceContributions: PredictionSourceContribution[];
};

export type PredictionSourceList = {
  sourceId: string;
  sourceName: string;
  publicationId: string;
  publicationUrl: string;
  publishedAt: string | null;
  listLength: number | null;
  orderedObservationIds: string[];
  selectionObservationIds: string[];
};

export type PredictionAggregate = {
  methodVersion: typeof AGGREGATION_METHOD_VERSION;
  seasonId: string;
  categoryId: string;
  intention: "nomination" | "winner";
  cutoffDate: string;
  isConsensus: boolean;
  minimumOrderedSources: 3;
  orderedSourceCount: number;
  applicableSourceCount: number;
  sourceLists: PredictionSourceList[];
  ranking: PredictionCandidateAggregate[];
  includedObservationIds: string[];
  excludedObservationIds: string[];
};
