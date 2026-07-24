import {
  aggregateCriticalReception,
  buildPredictionTimeline,
  type CriticalScoreObservation,
  type PredictionObservation,
} from "../lib/aggregation";
import { filmFixtures } from "./films";

const capturedAt = "2026-07-24T11:17:17+02:00";
const filmTitles = new Map(filmFixtures.map((film) => [film.id, film.title]));

type OrderedListFixture = {
  idPrefix: string;
  sourceId: string;
  sourceName: string;
  publicationId: string;
  publicationUrl: string;
  author: string;
  publishedAt: string;
  films: string[];
  originalTitles?: Record<string, string>;
};

const orderedLists: OrderedListFixture[] = [
  {
    idPrefix: "ad-20260704-bp",
    sourceId: "awards-daily",
    sourceName: "Awards Daily",
    publicationId: "make-oscars-unpredictable-2026-07-04",
    publicationUrl:
      "https://www.awardsdaily.com/2026/07/04/2027-oscar-predictions-make-the-oscars-unpredictable-again/",
    author: "Sasha Stone",
    publishedAt: "2026-07-04",
    films: [
      "project-hail-mary",
      "the-odyssey",
      "fjord",
      "wild-horse-nine",
      "cliff-booth",
      "dune-part-three",
      "la-bola-negra",
      "digger",
      "obsession",
      "the-debut",
    ],
    originalTitles: {
      "dune-part-three": "Dune Part III",
    },
  },
  {
    idPrefix: "aw-20260715-bp",
    sourceId: "awardswatch",
    sourceName: "AwardsWatch",
    publicationId: "awards-alchemist-2026-07-15",
    publicationUrl:
      "https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/",
    author: "Mark Johnson",
    publishedAt: "2026-07-15",
    films: [
      "the-odyssey",
      "dune-part-three",
      "wild-horse-nine",
      "project-hail-mary",
      "la-bola-negra",
      "fjord",
      "digger",
      "the-debut",
      "behemoth",
      "cliff-booth",
    ],
    originalTitles: {
      "cliff-booth": "Untitled Cliff Booth Movie",
    },
  },
  {
    idPrefix: "ar-20260720-bp",
    sourceId: "awards-radar",
    sourceName: "Awards Radar",
    publicationId: "best-picture-2026-07-20",
    publicationUrl: "https://awardsradar.com/best-picture/",
    author: "Awards Radar Team",
    publishedAt: "2026-07-20",
    films: [
      "the-odyssey",
      "project-hail-mary",
      "wild-horse-nine",
      "dune-part-three",
      "fjord",
      "digger",
      "the-social-reckoning",
      "the-debut",
      "cliff-booth",
      "the-invite",
    ],
  },
  {
    idPrefix: "nbp-20260723-bp",
    sourceId: "next-best-picture",
    sourceName: "Next Best Picture",
    publicationId: "oscars-best-picture-2026-07-23",
    publicationUrl: "https://predictions.nextbestpicture.com/oscars",
    author: "Next Best Picture Team",
    publishedAt: "2026-07-23",
    films: [
      "the-odyssey",
      "la-bola-negra",
      "wild-horse-nine",
      "fjord",
      "project-hail-mary",
      "dune-part-three",
      "behemoth",
      "digger",
      "the-debut",
      "the-invite",
    ],
  },
];

function titleFor(filmId: string) {
  const title = filmTitles.get(filmId);
  if (!title) throw new Error(`Película de referencia desconocida: ${filmId}`);
  return title;
}

export const referencePredictionObservations: PredictionObservation[] =
  orderedLists.flatMap((list) =>
    list.films.map((filmId, index) => ({
      id: `${list.idPrefix}-${String(index + 1).padStart(2, "0")}`,
      sourceId: list.sourceId,
      sourceName: list.sourceName,
      publicationId: list.publicationId,
      publicationUrl: list.publicationUrl,
      author: list.author,
      publishedAt: list.publishedAt,
      capturedAt,
      seasonId: "oscars-2027",
      filmId,
      filmTitle: titleFor(filmId),
      participates: true,
      state: "published",
      dataType: "prediction_ordered",
      categoryId: "best-picture",
      intention: "nomination",
      rank: index + 1,
      listLength: list.films.length,
      originalValue: list.originalTitles?.[filmId] ?? titleFor(filmId),
    })),
  );

const awardsWatchRadar = [
  "the-social-reckoning",
  "fatherland",
  "all-of-a-sudden",
  "being-heumann",
  "michael",
  "sense-and-sensibility",
  "saturn-return",
  "primetime",
];

referencePredictionObservations.push(
  ...awardsWatchRadar.map((filmId, index): PredictionObservation => ({
    id: `aw-20260715-radar-${String(index + 1).padStart(2, "0")}`,
    sourceId: "awardswatch",
    sourceName: "AwardsWatch",
    publicationId: "awards-alchemist-2026-07-15",
    publicationUrl:
      "https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/",
    author: "Mark Johnson",
    publishedAt: "2026-07-15",
    capturedAt,
    seasonId: "oscars-2027",
    filmId,
    filmTitle: titleFor(filmId),
    participates: true,
    state: "published",
    dataType: "prediction_selection",
    categoryId: "best-picture",
    intention: "nomination",
    rank: null,
    listLength: null,
    originalValue:
      filmId === "all-of-a-sudden"
        ? "Soudain (All of a Sudden)"
        : titleFor(filmId),
  })),
);

export const referenceCriticalScoreObservations: CriticalScoreObservation[] = [
  {
    id: "guardian-20260715-odyssey-score",
    sourceId: "guardian",
    sourceName: "The Guardian",
    publicationId: "the-odyssey-review-2026-07-15",
    publicationUrl:
      "https://www.theguardian.com/film/2026/jul/15/the-odyssey-review-christopher-nolan-matt-damon",
    publishedAt: "2026-07-15",
    capturedAt,
    seasonId: "oscars-2027",
    filmId: "the-odyssey",
    filmTitle: "The Odyssey",
    participates: true,
    state: "published",
    dataType: "score_individual",
    author: "Peter Bradshaw",
    canonicalReviewId: "the-odyssey-review-2026-07-15",
    originalDisplay: "5/5",
    numericValue: 5,
    scaleMin: 0,
    scaleMax: 5,
    scaleLabel: "stars",
  },
  {
    id: "guardian-20260310-phm-score",
    sourceId: "guardian",
    sourceName: "The Guardian",
    publicationId: "project-hail-mary-review-2026-03-10",
    publicationUrl:
      "https://www.theguardian.com/film/2026/mar/10/project-hail-mary-review-ryan-goslings-charm-carries-unserious-last-ditch-space-mission",
    publishedAt: "2026-03-10",
    capturedAt,
    seasonId: "oscars-2027",
    filmId: "project-hail-mary",
    filmTitle: "Project Hail Mary",
    participates: true,
    state: "published",
    dataType: "score_individual",
    author: "Peter Bradshaw",
    canonicalReviewId: "project-hail-mary-review-2026-03-10",
    originalDisplay: "3/5",
    numericValue: 3,
    scaleMin: 0,
    scaleMax: 5,
    scaleLabel: "stars",
  },
  {
    id: "rt-20260724-odyssey",
    sourceId: "rotten-tomatoes",
    sourceName: "Rotten Tomatoes",
    publicationId: "the-odyssey-2026",
    publicationUrl: "https://www.rottentomatoes.com/m/the_odyssey_2026",
    publishedAt: "2026-07-24",
    capturedAt,
    seasonId: "oscars-2027",
    filmId: "the-odyssey",
    filmTitle: "The Odyssey",
    participates: false,
    state: "published",
    dataType: "score_aggregate",
    author: null,
    canonicalReviewId: "the-odyssey-2026",
    originalDisplay: "94%",
    numericValue: 94,
    scaleMin: 0,
    scaleMax: 100,
    scaleLabel: "Tomatometer approval; 431 reviews",
  },
  {
    id: "mc-20260724-odyssey",
    sourceId: "metacritic",
    sourceName: "Metacritic",
    publicationId: "the-odyssey-2026",
    publicationUrl: "https://www.metacritic.com/movie/the-odyssey-2026/",
    publishedAt: "2026-07-24",
    capturedAt: "2026-07-24T11:22:19+02:00",
    seasonId: "oscars-2027",
    filmId: "the-odyssey",
    filmTitle: "The Odyssey",
    participates: false,
    state: "published",
    dataType: "score_aggregate",
    author: null,
    canonicalReviewId: "the-odyssey-2026",
    originalDisplay: "88/100",
    numericValue: 88,
    scaleMin: 0,
    scaleMax: 100,
    scaleLabel: "Metascore; 62 critic reviews",
  },
  {
    id: "rt-20260724-phm",
    sourceId: "rotten-tomatoes",
    sourceName: "Rotten Tomatoes",
    publicationId: "project-hail-mary",
    publicationUrl: "https://www.rottentomatoes.com/m/project_hail_mary",
    publishedAt: "2026-07-24",
    capturedAt,
    seasonId: "oscars-2027",
    filmId: "project-hail-mary",
    filmTitle: "Project Hail Mary",
    participates: false,
    state: "published",
    dataType: "score_aggregate",
    author: null,
    canonicalReviewId: "project-hail-mary",
    originalDisplay: "95%",
    numericValue: 95,
    scaleMin: 0,
    scaleMax: 100,
    scaleLabel: "Tomatometer approval; 422 reviews",
  },
  {
    id: "mc-20260724-phm",
    sourceId: "metacritic",
    sourceName: "Metacritic",
    publicationId: "project-hail-mary",
    publicationUrl: "https://www.metacritic.com/movie/project-hail-mary/",
    publishedAt: "2026-07-24",
    capturedAt,
    seasonId: "oscars-2027",
    filmId: "project-hail-mary",
    filmTitle: "Project Hail Mary",
    participates: false,
    state: "published",
    dataType: "score_aggregate",
    author: null,
    canonicalReviewId: "project-hail-mary",
    originalDisplay: "77/100",
    numericValue: 77,
    scaleMin: 0,
    scaleMax: 100,
    scaleLabel: "Metascore; 60 critic reviews",
  },
  {
    id: "mc-20260724-obsession",
    sourceId: "metacritic",
    sourceName: "Metacritic",
    publicationId: "obsession-2025",
    publicationUrl: "https://www.metacritic.com/movie/obsession-2025/",
    publishedAt: "2026-07-24",
    capturedAt,
    seasonId: "oscars-2027",
    filmId: "obsession",
    filmTitle: "Obsession",
    participates: false,
    state: "published",
    dataType: "score_aggregate",
    author: null,
    canonicalReviewId: "obsession-2025",
    originalDisplay: "77/100",
    numericValue: 77,
    scaleMin: 0,
    scaleMax: 100,
    scaleLabel: "Metascore; 37 critic reviews",
  },
];

export const referencePredictionTimeline = buildPredictionTimeline(
  referencePredictionObservations,
  {
    seasonId: "oscars-2027",
    categoryId: "best-picture",
    intention: "nomination",
  },
);

export const referenceCurrentPrediction = referencePredictionTimeline.at(-1)!;

export function getReferenceCriticalReception(filmId: string) {
  return aggregateCriticalReception(referenceCriticalScoreObservations, filmId);
}
