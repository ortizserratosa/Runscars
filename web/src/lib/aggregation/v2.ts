export const AGGREGATION_METHOD_VERSION_V2 = "runscars-aggregation-v2";
export const MINIMUM_ORDERED_SOURCES_V2 = 4;

export type CategoryCandidatePerson = {
  id: string;
  name: string;
  role: string;
  displayOrder: number;
};

export type CategoryCandidate = {
  id: string;
  seasonId: string;
  categoryId: string;
  label: string;
  film: { id: string; title: string } | null;
  workTitle: string | null;
  people: CategoryCandidatePerson[];
};

export type PredictionObservationV2 = {
  id: string;
  sourceId: string;
  sourceName: string;
  publicationId: string;
  publicationUrl: string;
  author: string | null;
  publishedAt: string | null;
  capturedAt: string;
  seasonId: string;
  categoryId: string;
  intention: "nomination" | "winner";
  candidate: CategoryCandidate;
  dataType: "prediction_ordered" | "prediction_selection";
  rank: number | null;
  listLength: number | null;
  originalValue: string;
  participates: boolean;
  state: "pending_review" | "published" | "corrected" | "excluded";
};

export type PredictionSourceContributionV2 = {
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

export type PredictionCandidateAggregateV2 = CategoryCandidate & {
  candidateId: string;
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
  sourceContributions: PredictionSourceContributionV2[];
};

export type PredictionSourceListV2 = {
  sourceId: string;
  sourceName: string;
  publicationId: string;
  publicationUrl: string;
  publishedAt: string | null;
  listLength: number | null;
  orderedObservationIds: string[];
  selectionObservationIds: string[];
};

export type PredictionAggregateV2 = {
  methodVersion: typeof AGGREGATION_METHOD_VERSION_V2;
  seasonId: string;
  categoryId: string;
  intention: "nomination" | "winner";
  cutoffDate: string;
  isConsensus: boolean;
  minimumOrderedSources: typeof MINIMUM_ORDERED_SOURCES_V2;
  orderedSourceCount: number;
  applicableSourceCount: number;
  sourceLists: PredictionSourceListV2[];
  ranking: PredictionCandidateAggregateV2[];
  includedObservationIds: string[];
  excludedObservationIds: string[];
};

type ActiveSource = {
  sourceId: string;
  sourceName: string;
  publicationId: string;
  publicationUrl: string;
  publishedAt: string | null;
  observations: PredictionObservationV2[];
  ordered: PredictionObservationV2[];
  selection: PredictionObservationV2[];
  listLength: number | null;
  orderedIsValid: boolean;
};

export type PredictionAggregateOptionsV2 = {
  seasonId: string;
  categoryId: string;
  intention: "nomination" | "winner";
  cutoffDate: string;
  previous?: PredictionAggregateV2;
};

const END_OF_DAY = "T23:59:59.999Z";

function instant(value: string) {
  return Date.parse(value.length === 10 ? `${value}${END_OF_DAY}` : value);
}

function effectiveAt(
  observation: Pick<PredictionObservationV2, "publishedAt" | "capturedAt">,
) {
  return observation.publishedAt ?? observation.capturedAt;
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

function validateOrderedList(observations: PredictionObservationV2[]) {
  if (observations.length === 0) {
    return { valid: false, listLength: null };
  }
  const lengths = new Set(observations.map((item) => item.listLength));
  const ranks = observations.map((item) => item.rank);
  const listLength = observations[0].listLength;
  const integerRanks = ranks.every(
    (rank): rank is number =>
      rank !== null && Number.isInteger(rank) && rank > 0,
  );
  const ranksFit =
    listLength !== null &&
    Number.isInteger(listLength) &&
    listLength > 0 &&
    ranks.every((rank) => rank !== null && rank <= listLength);

  return {
    valid:
      lengths.size === 1 &&
      integerRanks &&
      new Set(ranks).size === ranks.length &&
      new Set(observations.map((item) => item.candidate.id)).size ===
        observations.length &&
      ranksFit,
    listLength: ranksFit ? listLength : null,
  };
}

function selectActiveSources(observations: PredictionObservationV2[]) {
  const bySource = new Map<string, Map<string, PredictionObservationV2[]>>();
  for (const observation of observations) {
    const publications =
      bySource.get(observation.sourceId) ??
      new Map<string, PredictionObservationV2[]>();
    const publication = publications.get(observation.publicationId) ?? [];
    publication.push(observation);
    publications.set(observation.publicationId, publication);
    bySource.set(observation.sourceId, publications);
  }

  const active: ActiveSource[] = [];
  for (const [sourceId, publications] of bySource) {
    const latestPublication = [...publications.entries()].sort(
      ([leftId, left], [rightId, right]) => {
        const dateDifference =
          instant(effectiveAt(right[0])) - instant(effectiveAt(left[0]));
        return dateDifference || rightId.localeCompare(leftId);
      },
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
  left: PredictionCandidateAggregateV2,
  right: PredictionCandidateAggregateV2,
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
  return left.label.localeCompare(right.label, "en");
}

export function aggregatePredictionsV2(
  observations: PredictionObservationV2[],
  options: PredictionAggregateOptionsV2,
): PredictionAggregateV2 {
  const cutoff = instant(options.cutoffDate);
  const relevant = observations.filter(
    (observation) =>
      observation.seasonId === options.seasonId &&
      observation.categoryId === options.categoryId &&
      observation.intention === options.intention &&
      observation.state === "published" &&
      observation.participates &&
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
  const candidates = new Map<string, CategoryCandidate>();
  for (const source of activeSources) {
    for (const observation of source.observations) {
      candidates.set(observation.candidate.id, observation.candidate);
    }
  }

  const ranking = [...candidates.values()].map(
    (candidate): PredictionCandidateAggregateV2 => {
      const sourceContributions: PredictionSourceContributionV2[] =
        orderedSources.map((source) => {
          const ordered = source.ordered.find(
            (observation) => observation.candidate.id === candidate.id,
          );
          const selected = source.selection.find(
            (observation) => observation.candidate.id === candidate.id,
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
      sourceContributions.push(
        ...activeSources
          .filter((source) => !source.orderedIsValid)
          .map((source): PredictionSourceContributionV2 => {
            const selected = source.selection.find(
              (observation) => observation.candidate.id === candidate.id,
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
          }),
      );
      const ranks = sourceContributions.flatMap((source) =>
        source.rank === null ? [] : [source.rank],
      );
      const appearances = activeSources.filter((source) =>
        source.observations.some(
          (observation) => observation.candidate.id === candidate.id,
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
        ...candidate,
        candidateId: candidate.id,
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
      candidate.candidateId,
      candidate.position,
    ]) ?? [],
  );
  ranking.forEach((candidate, index) => {
    candidate.position = index + 1;
    const previousPosition = previousPositions.get(candidate.candidateId);
    candidate.movement =
      previousPosition === undefined
        ? null
        : previousPosition - candidate.position;
  });

  const sourceLists: PredictionSourceListV2[] = activeSources.map((source) => ({
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

  return {
    methodVersion: AGGREGATION_METHOD_VERSION_V2,
    seasonId: options.seasonId,
    categoryId: options.categoryId,
    intention: options.intention,
    cutoffDate: options.cutoffDate,
    isConsensus: orderedSources.length >= MINIMUM_ORDERED_SOURCES_V2,
    minimumOrderedSources: MINIMUM_ORDERED_SOURCES_V2,
    orderedSourceCount: orderedSources.length,
    applicableSourceCount: activeSources.length,
    sourceLists,
    ranking,
    includedObservationIds: sourceLists
      .flatMap((source) => [
        ...source.orderedObservationIds,
        ...source.selectionObservationIds,
      ])
      .sort(),
    excludedObservationIds: excludedObservationIds.sort(),
  };
}
