import {
  AGGREGATION_METHOD_VERSION,
  type CriticalReceptionAggregate,
  type CriticalScoreObservation,
  type CriticalScoreWithNormalization,
  type PredictionAggregate,
  type PredictionCandidateAggregate,
  type PredictionObservation,
  type PredictionSourceContribution,
  type PredictionSourceList,
  type ScoreNormalization,
} from "./types";

export * from "./types";

const END_OF_DAY = "T23:59:59.999Z";

function instant(value: string) {
  return Date.parse(value.length === 10 ? `${value}${END_OF_DAY}` : value);
}

function effectiveAt(
  observation: Pick<PredictionObservation, "publishedAt" | "capturedAt">,
) {
  return observation.publishedAt ?? observation.capturedAt;
}

function comparePublicationRecency(
  [leftId, left]: [string, PredictionObservation[]],
  [rightId, right]: [string, PredictionObservation[]],
) {
  const leftObservation = left[0];
  const rightObservation = right[0];
  let dateDifference: number;

  if (leftObservation.publicationUrl === rightObservation.publicationUrl) {
    dateDifference =
      instant(rightObservation.capturedAt) -
      instant(leftObservation.capturedAt);
    if (
      dateDifference === 0 &&
      leftObservation.publishedAt &&
      rightObservation.publishedAt
    ) {
      dateDifference =
        instant(rightObservation.publishedAt) -
        instant(leftObservation.publishedAt);
    } else if (dateDifference === 0 && rightObservation.publishedAt) {
      return 1;
    } else if (dateDifference === 0 && leftObservation.publishedAt) {
      return -1;
    }
  } else if (leftObservation.publishedAt && rightObservation.publishedAt) {
    dateDifference =
      instant(rightObservation.publishedAt) -
      instant(leftObservation.publishedAt);
  } else if (rightObservation.publishedAt) {
    return 1;
  } else if (leftObservation.publishedAt) {
    return -1;
  } else {
    dateDifference =
      instant(effectiveAt(rightObservation)) -
      instant(effectiveAt(leftObservation));
  }

  return dateDifference || rightId.localeCompare(leftId);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function stableDecimal(value: number) {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function isPublishedParticipant(
  observation: Pick<
    PredictionObservation | CriticalScoreObservation,
    "state" | "participates"
  >,
) {
  return observation.state === "published" && observation.participates;
}

export function normalizeCriticalScore(
  observation: Pick<
    CriticalScoreObservation,
    "numericValue" | "scaleMin" | "scaleMax"
  >,
): ScoreNormalization | null {
  const { numericValue, scaleMin, scaleMax } = observation;
  if (
    numericValue === null ||
    scaleMin !== 0 ||
    scaleMax === null ||
    !Number.isFinite(numericValue) ||
    !Number.isFinite(scaleMax) ||
    scaleMax <= 0 ||
    numericValue < 0 ||
    numericValue > scaleMax
  ) {
    return null;
  }

  return {
    methodVersion: AGGREGATION_METHOD_VERSION,
    normalizedValue:
      Math.round((numericValue / scaleMax) * 5 * 10_000) / 10_000,
    normalizedScale: "0–5",
  };
}

function latestByCanonicalReview(
  observations: CriticalScoreObservation[],
): CriticalScoreObservation[] {
  const latest = new Map<string, CriticalScoreObservation>();

  for (const observation of observations) {
    const key = [
      observation.filmId,
      observation.canonicalReviewId,
      observation.author ?? "",
    ].join("::");
    const existing = latest.get(key);
    if (
      !existing ||
      instant(effectiveAt(observation)) > instant(effectiveAt(existing)) ||
      (instant(effectiveAt(observation)) === instant(effectiveAt(existing)) &&
        observation.id > existing.id)
    ) {
      latest.set(key, observation);
    }
  }

  return [...latest.values()];
}

export function aggregateCriticalReception(
  observations: CriticalScoreObservation[],
  filmId: string,
): CriticalReceptionAggregate {
  const relevant = observations.filter(
    (observation) =>
      observation.filmId === filmId && observation.state === "published",
  );
  const individual = latestByCanonicalReview(
    relevant.filter(
      (observation) =>
        observation.dataType === "score_individual" &&
        isPublishedParticipant(observation),
    ),
  );
  const normalized: CriticalScoreWithNormalization[] = [];
  const excludedObservationIds: string[] = [];

  for (const observation of individual) {
    const normalization = normalizeCriticalScore(observation);
    if (normalization) {
      normalized.push({ ...observation, normalization });
    } else {
      excludedObservationIds.push(observation.id);
    }
  }

  normalized.sort((left, right) => {
    const dateDifference =
      instant(effectiveAt(left)) - instant(effectiveAt(right));
    return dateDifference || left.id.localeCompare(right.id);
  });

  const values = normalized.map(
    (observation) => observation.normalization.normalizedValue,
  );
  const scoreMedian = median(values);
  const calculatedStatistics =
    values.length === 0 || scoreMedian === null
      ? null
      : {
          mean: values.reduce((sum, value) => sum + value, 0) / values.length,
          median: scoreMedian,
          minimum: Math.min(...values),
          maximum: Math.max(...values),
          count: values.length,
        };
  const contextualScores = relevant
    .filter((observation) => observation.dataType === "score_aggregate")
    .sort((left, right) => left.id.localeCompare(right.id));
  const latestDate = normalized
    .map((observation) => observation.capturedAt)
    .sort()
    .at(-1);

  return {
    filmId,
    methodVersion: AGGREGATION_METHOD_VERSION,
    isSufficient: normalized.length >= 3,
    minimumRequired: 3,
    scores: normalized,
    contextualScores,
    statistics: normalized.length >= 3 ? calculatedStatistics : null,
    updatedAt: latestDate ?? null,
    includedObservationIds: normalized.map((observation) => observation.id),
    excludedObservationIds: excludedObservationIds.sort(),
  };
}

type ActiveSource = {
  sourceId: string;
  sourceName: string;
  publicationId: string;
  publicationUrl: string;
  publishedAt: string | null;
  observations: PredictionObservation[];
  ordered: PredictionObservation[];
  selection: PredictionObservation[];
  listLength: number | null;
  orderedIsValid: boolean;
};

function validateOrderedList(observations: PredictionObservation[]) {
  if (observations.length === 0) {
    return { valid: false, listLength: null };
  }
  const lengths = new Set(observations.map((item) => item.listLength));
  const ranks = observations.map((item) => item.rank);
  const integerRanks = ranks.every(
    (rank): rank is number =>
      rank !== null && Number.isInteger(rank) && rank > 0,
  );
  const listLength = observations[0].listLength;
  const uniqueRanks = new Set(ranks).size === ranks.length;
  const uniqueFilms =
    new Set(observations.map((item) => item.filmId)).size ===
    observations.length;
  const ranksFit =
    listLength !== null &&
    Number.isInteger(listLength) &&
    listLength > 0 &&
    ranks.every((rank) => rank !== null && rank <= listLength);

  return {
    valid:
      lengths.size === 1 &&
      integerRanks &&
      uniqueRanks &&
      uniqueFilms &&
      ranksFit,
    listLength: ranksFit ? listLength : null,
  };
}

function selectActiveSources(observations: PredictionObservation[]) {
  const bySource = new Map<string, Map<string, PredictionObservation[]>>();

  for (const observation of observations) {
    const publications =
      bySource.get(observation.sourceId) ??
      new Map<string, PredictionObservation[]>();
    const publication = publications.get(observation.publicationId) ?? [];
    publication.push(observation);
    publications.set(observation.publicationId, publication);
    bySource.set(observation.sourceId, publications);
  }

  const active: ActiveSource[] = [];
  for (const [sourceId, publications] of bySource) {
    const latestPublication = [...publications.entries()].sort(
      comparePublicationRecency,
    )[0];
    if (!latestPublication) continue;

    const [publicationId, publicationObservations] = latestPublication;
    const ordered = publicationObservations.filter(
      (observation) => observation.dataType === "prediction_ordered",
    );
    const selection = publicationObservations.filter(
      (observation) => observation.dataType === "prediction_selection",
    );
    const validation = validateOrderedList(ordered);
    const first = publicationObservations[0];

    active.push({
      sourceId,
      sourceName: first.sourceName,
      publicationId,
      publicationUrl: first.publicationUrl,
      publishedAt: first.publishedAt,
      observations: publicationObservations,
      ordered,
      selection,
      listLength: validation.listLength,
      orderedIsValid: validation.valid,
    });
  }

  return active.sort((left, right) =>
    left.sourceName.localeCompare(right.sourceName),
  );
}

function predictionSort(
  left: PredictionCandidateAggregate,
  right: PredictionCandidateAggregate,
) {
  if (right.score !== left.score) return right.score - left.score;
  if (right.appearances !== left.appearances) {
    return right.appearances - left.appearances;
  }
  const leftMedian = left.medianRank ?? Number.POSITIVE_INFINITY;
  const rightMedian = right.medianRank ?? Number.POSITIVE_INFINITY;
  if (leftMedian !== rightMedian) return leftMedian - rightMedian;
  if (right.firstPlaceCount !== left.firstPlaceCount) {
    return right.firstPlaceCount - left.firstPlaceCount;
  }
  return left.filmTitle.localeCompare(right.filmTitle, "en");
}

export type PredictionAggregateOptions = {
  seasonId: string;
  categoryId: string;
  intention: "nomination" | "winner";
  cutoffDate: string;
  previous?: PredictionAggregate;
};

export function aggregatePredictions(
  observations: PredictionObservation[],
  options: PredictionAggregateOptions,
): PredictionAggregate {
  const cutoff = instant(options.cutoffDate);
  const relevant = observations.filter(
    (observation) =>
      observation.seasonId === options.seasonId &&
      observation.categoryId === options.categoryId &&
      observation.intention === options.intention &&
      isPublishedParticipant(observation) &&
      instant(effectiveAt(observation)) <= cutoff,
  );
  const selectedSources = selectActiveSources(relevant);
  const activeSources = selectedSources.filter(
    (source) => source.orderedIsValid || source.selection.length > 0,
  );
  const orderedSources = activeSources.filter(
    (source) => source.orderedIsValid && source.listLength !== null,
  );
  const excludedObservationIds = selectedSources.flatMap((source) =>
    source.ordered.length > 0 && !source.orderedIsValid
      ? source.ordered.map((observation) => observation.id)
      : [],
  );
  const candidates = new Map<string, string>();
  for (const source of activeSources) {
    for (const observation of source.observations) {
      candidates.set(observation.filmId, observation.filmTitle);
    }
  }

  const ranking = [...candidates.entries()].map(
    ([filmId, filmTitle]): PredictionCandidateAggregate => {
      const sourceContributions: PredictionSourceContribution[] =
        orderedSources.map((source) => {
          const ordered = source.ordered.find(
            (observation) => observation.filmId === filmId,
          );
          const selected = source.selection.find(
            (observation) => observation.filmId === filmId,
          );
          const listLength = source.listLength!;
          const points = ordered
            ? stableDecimal((listLength - ordered.rank! + 1) / listLength)
            : 0;

          return {
            sourceId: source.sourceId,
            sourceName: source.sourceName,
            publicationId: source.publicationId,
            publicationUrl: source.publicationUrl,
            publishedAt: source.publishedAt,
            rank: ordered?.rank ?? null,
            listLength,
            points,
            appeared: Boolean(ordered || selected),
            appearanceKind: ordered
              ? "ordered"
              : selected
                ? "selection"
                : "absent",
            observationId: ordered?.id ?? selected?.id ?? null,
          };
        });
      const selectionOnlySources = activeSources
        .filter((source) => !source.orderedIsValid)
        .map((source): PredictionSourceContribution => {
          const selected = source.selection.find(
            (observation) => observation.filmId === filmId,
          );
          return {
            sourceId: source.sourceId,
            sourceName: source.sourceName,
            publicationId: source.publicationId,
            publicationUrl: source.publicationUrl,
            publishedAt: source.publishedAt,
            rank: null,
            listLength: 0,
            points: 0,
            appeared: Boolean(selected),
            appearanceKind: selected ? "selection" : "absent",
            observationId: selected?.id ?? null,
          };
        });
      sourceContributions.push(...selectionOnlySources);

      const ranks = sourceContributions.flatMap((source) =>
        source.rank === null ? [] : [source.rank],
      );
      const appearances = activeSources.filter((source) =>
        source.observations.some(
          (observation) => observation.filmId === filmId,
        ),
      ).length;
      const score = stableDecimal(
        orderedSources.length === 0
          ? 0
          : sourceContributions.reduce(
              (sum, contribution) => sum + contribution.points,
              0,
            ) / orderedSources.length,
      );

      return {
        filmId,
        filmTitle,
        score,
        scoreOutOf100: score * 100,
        appearances,
        coverage:
          activeSources.length === 0 ? 0 : appearances / activeSources.length,
        applicableSourceCount: activeSources.length,
        orderedSourceCount: orderedSources.length,
        meanRank:
          ranks.length === 0
            ? null
            : ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length,
        medianRank: median(ranks),
        topFiveCount: ranks.filter((rank) => rank <= 5).length,
        firstPlaceCount: ranks.filter((rank) => rank === 1).length,
        position: 0,
        movement: null,
        sourceContributions: sourceContributions.sort((left, right) =>
          left.sourceName.localeCompare(right.sourceName),
        ),
      };
    },
  );

  ranking.sort(predictionSort);
  const previousPositions = new Map(
    options.previous?.ranking.map((candidate) => [
      candidate.filmId,
      candidate.position,
    ]) ?? [],
  );
  ranking.forEach((candidate, index) => {
    candidate.position = index + 1;
    const previousPosition = previousPositions.get(candidate.filmId);
    candidate.movement =
      previousPosition === undefined
        ? null
        : previousPosition - candidate.position;
  });

  const sourceLists: PredictionSourceList[] = activeSources.map((source) => ({
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    publicationId: source.publicationId,
    publicationUrl: source.publicationUrl,
    publishedAt: source.publishedAt,
    listLength: source.orderedIsValid ? source.listLength : null,
    orderedObservationIds: source.orderedIsValid
      ? source.ordered.map((observation) => observation.id).sort()
      : [],
    selectionObservationIds: source.selection
      .map((observation) => observation.id)
      .sort(),
  }));
  const includedObservationIds = sourceLists
    .flatMap((source) => [
      ...source.orderedObservationIds,
      ...source.selectionObservationIds,
    ])
    .sort();

  return {
    methodVersion: AGGREGATION_METHOD_VERSION,
    seasonId: options.seasonId,
    categoryId: options.categoryId,
    intention: options.intention,
    cutoffDate: options.cutoffDate,
    isConsensus: orderedSources.length >= 3,
    minimumOrderedSources: 3,
    orderedSourceCount: orderedSources.length,
    applicableSourceCount: activeSources.length,
    sourceLists,
    ranking,
    includedObservationIds,
    excludedObservationIds: excludedObservationIds.sort(),
  };
}

export function buildPredictionTimeline(
  observations: PredictionObservation[],
  options: Omit<PredictionAggregateOptions, "cutoffDate" | "previous">,
) {
  const dates = [
    ...new Set(
      observations
        .filter(
          (observation) =>
            observation.seasonId === options.seasonId &&
            observation.categoryId === options.categoryId &&
            observation.intention === options.intention &&
            isPublishedParticipant(observation),
        )
        .map((observation) => effectiveAt(observation).slice(0, 10)),
    ),
  ].sort();

  const timeline: PredictionAggregate[] = [];
  for (const cutoffDate of dates) {
    const aggregate = aggregatePredictions(observations, {
      ...options,
      cutoffDate,
      previous: timeline.at(-1),
    });
    timeline.push(aggregate);
  }
  return timeline;
}
