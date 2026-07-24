import {
  referenceCurrentPrediction,
  referencePredictionTimeline,
} from "./phase6-reference";

const tones = [
  "violet",
  "acid",
  "rust",
  "blue",
  "sand",
  "ink",
  "clay",
  "rose",
  "sun",
  "moss",
];

export type ConsensusCandidate = {
  id: string;
  title: string;
  score: number;
  scoreExact: number;
  coverage: string;
  appearances: number;
  applicableSources: number;
  orderedSources: number;
  average: number | null;
  median: number | null;
  topFive: number;
  firsts: number;
  movement: number | null;
  sources: Array<{
    id: string;
    name: string;
    rank: number;
    listLength: number;
    points: number;
    href: string;
    observationId: string;
  }>;
  contributions: Array<{
    id: string;
    name: string;
    rank: number | null;
    listLength: number;
    points: number;
    href: string;
    appearanceKind: "ordered" | "selection" | "absent";
    observationId: string | null;
  }>;
  tone: string;
};

export type CalculationCut = {
  id: string;
  shortDate: string;
  date: string;
  label: string;
  sourceCount: number;
  observationCount: number;
  isConsensus: boolean;
  ranking: Array<{
    id: string;
    title: string;
    score: number;
    movement: number | null;
  }>;
};

function dateLabel(value: string, month: "short" | "long") {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month,
    year: month === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export const consensusCandidates: ConsensusCandidate[] =
  referenceCurrentPrediction.ranking.map((candidate, index) => ({
    id: candidate.filmId,
    title: candidate.filmTitle,
    score: candidate.scoreOutOf100,
    scoreExact: candidate.score,
    coverage: `${candidate.appearances}/${candidate.applicableSourceCount}`,
    appearances: candidate.appearances,
    applicableSources: candidate.applicableSourceCount,
    orderedSources: candidate.orderedSourceCount,
    average: candidate.meanRank,
    median: candidate.medianRank,
    topFive: candidate.topFiveCount,
    firsts: candidate.firstPlaceCount,
    movement: candidate.movement,
    sources: candidate.sourceContributions.flatMap((source) =>
      source.rank === null || source.observationId === null
        ? []
        : [
            {
              id: source.sourceId,
              name: source.sourceName,
              rank: source.rank,
              listLength: source.listLength,
              points: source.points,
              href: source.publicationUrl,
              observationId: source.observationId,
            },
          ],
    ),
    contributions: candidate.sourceContributions.map((source) => ({
      id: source.sourceId,
      name: source.sourceName,
      rank: source.rank,
      listLength: source.listLength,
      points: source.points,
      href: source.publicationUrl,
      appearanceKind: source.appearanceKind,
      observationId: source.observationId,
    })),
    tone: tones[index % tones.length],
  }));

export const calculationCuts: CalculationCut[] =
  referencePredictionTimeline.map((cut, index, timeline) => ({
    id: cut.cutoffDate,
    shortDate: dateLabel(cut.cutoffDate, "short").toUpperCase(),
    date: dateLabel(cut.cutoffDate, "long"),
    label:
      index === timeline.length - 1
        ? "Corte de cálculo actual"
        : cut.isConsensus
          ? "Primer consenso calculable"
          : index === 0
            ? "Señal inicial"
            : "Señal en formación",
    sourceCount: cut.orderedSourceCount,
    observationCount: cut.includedObservationIds.length,
    isConsensus: cut.isConsensus,
    ranking: cut.ranking.map((candidate) => ({
      id: candidate.filmId,
      title: candidate.filmTitle,
      score: candidate.scoreOutOf100,
      movement: candidate.movement,
    })),
  }));
