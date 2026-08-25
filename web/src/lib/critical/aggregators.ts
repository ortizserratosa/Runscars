import type { CriticalScoreObservation } from "../aggregation";

export type CriticalAggregatorFilm = {
  filmId: string;
  filmTitle: string;
  contextualScores: CriticalScoreObservation[];
};

export type CriticalAggregatorHighlight = {
  sourceId: string;
  sourceName: string;
  scores: Array<
    CriticalScoreObservation & { filmId: string; filmTitle: string }
  >;
};

export function groupCriticalAggregatorHighlights(
  films: CriticalAggregatorFilm[],
): CriticalAggregatorHighlight[] {
  const bySource = new Map<string, CriticalAggregatorHighlight>();

  for (const film of films) {
    for (const score of film.contextualScores) {
      const group = bySource.get(score.sourceId) ?? {
        sourceId: score.sourceId,
        sourceName: score.sourceName,
        scores: [],
      };
      group.scores.push({
        ...score,
        filmId: film.filmId,
        filmTitle: film.filmTitle,
      });
      bySource.set(score.sourceId, group);
    }
  }

  return [...bySource.values()]
    .map((group) => ({
      ...group,
      scores: [...group.scores].sort(
        (left, right) =>
          (right.numericValue ?? -1) - (left.numericValue ?? -1) ||
          left.filmTitle.localeCompare(right.filmTitle, "es"),
      ),
    }))
    .sort((left, right) =>
      left.sourceName.localeCompare(right.sourceName, "es"),
    );
}
