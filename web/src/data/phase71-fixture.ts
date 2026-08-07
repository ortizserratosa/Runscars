import {
  aggregatePredictionsV2,
  type CategoryCandidate,
  type PredictionObservationV2,
} from "../lib/aggregation/v2";
import {
  PUBLIC_CATEGORIES,
  type PublicCategoryId,
} from "../lib/categories/config";

const sourceMeta = {
  awardswatch: {
    name: "AwardsWatch",
    url: "https://awardswatch.com/oscar-predictions-hq/",
  },
  "awards-daily": {
    name: "Awards Daily",
    url: "https://www.awardsdaily.com/2026/05/04/may-predictions-and-temperature-check-on-all-oscar-categories/",
  },
  "awards-radar": {
    name: "Awards Radar",
    url: "https://awardsradar.com/2026/04/10/year-in-advance-oscar-predictions-far-out-thoughts-on-what-the-academy-might-be-thinking-in-2027-part-two/",
  },
  "next-best-picture": {
    name: "Next Best Picture",
    url: "https://predictions.nextbestpicture.com/u/655756da85df4c0efaa10bd2/oscars",
  },
  "midnight-critics": {
    name: "Midnight Critics Circle",
    url: "https://www.midnightcritics.com/predictions/2027-oscar-predictions",
  },
  "the-ringer": {
    name: "The Ringer",
    url: "https://www.theringer.com/2026/03/20/oscars/oscars-2027-predictions-best-picture-movies-contenders",
  },
} as const;

type CandidateInput = {
  filmId: string;
  filmTitle: string;
  people?: string[];
};

const pools: Record<PublicCategoryId, CandidateInput[]> = {
  "best-picture": [
    { filmId: "wild-horse-nine", filmTitle: "Wild Horse Nine" },
    { filmId: "the-odyssey", filmTitle: "The Odyssey" },
    { filmId: "dune-part-three", filmTitle: "Dune: Part Three" },
    { filmId: "la-bola-negra", filmTitle: "La Bola Negra" },
    { filmId: "digger", filmTitle: "Digger" },
    { filmId: "project-hail-mary", filmTitle: "Project Hail Mary" },
    { filmId: "fjord", filmTitle: "Fjord" },
    { filmId: "cliff-booth", filmTitle: "The Adventures of Cliff Booth" },
  ],
  directing: [
    {
      filmId: "dune-part-three",
      filmTitle: "Dune: Part Three",
      people: ["Denis Villeneuve"],
    },
    {
      filmId: "the-odyssey",
      filmTitle: "The Odyssey",
      people: ["Christopher Nolan"],
    },
    {
      filmId: "wild-horse-nine",
      filmTitle: "Wild Horse Nine",
      people: ["Martin McDonagh"],
    },
    {
      filmId: "la-bola-negra",
      filmTitle: "La Bola Negra",
      people: ["Javier Ambrossi", "Javier Calvo"],
    },
    {
      filmId: "fjord",
      filmTitle: "Fjord",
      people: ["Cristian Mungiu"],
    },
    {
      filmId: "digger",
      filmTitle: "Digger",
      people: ["Alejandro G. Iñárritu"],
    },
  ],
  actor: [
    { filmId: "digger", filmTitle: "Digger", people: ["Tom Cruise"] },
    {
      filmId: "wild-horse-nine",
      filmTitle: "Wild Horse Nine",
      people: ["John Malkovich"],
    },
    {
      filmId: "project-hail-mary",
      filmTitle: "Project Hail Mary",
      people: ["Ryan Gosling"],
    },
    {
      filmId: "the-odyssey",
      filmTitle: "The Odyssey",
      people: ["Matt Damon"],
    },
    { filmId: "fjord", filmTitle: "Fjord", people: ["Sebastian Stan"] },
    {
      filmId: "the-debut",
      filmTitle: "The Debut",
      people: ["Paul Giamatti"],
    },
  ],
  actress: [
    { filmId: "fjord", filmTitle: "Fjord", people: ["Renate Reinsve"] },
    {
      filmId: "fatherland",
      filmTitle: "Fatherland",
      people: ["Sandra Hüller"],
    },
    {
      filmId: "obsession",
      filmTitle: "Obsession",
      people: ["Inde Navarrette"],
    },
    {
      filmId: "all-of-a-sudden",
      filmTitle: "All of a Sudden",
      people: ["Virginie Efira"],
    },
    {
      filmId: "the-debut",
      filmTitle: "The Debut",
      people: ["Julianne Moore"],
    },
  ],
  "supporting-actor": [
    { filmId: "digger", filmTitle: "Digger", people: ["John Goodman"] },
    {
      filmId: "wild-horse-nine",
      filmTitle: "Wild Horse Nine",
      people: ["Sam Rockwell"],
    },
    {
      filmId: "wild-horse-nine",
      filmTitle: "Wild Horse Nine",
      people: ["Steve Buscemi"],
    },
    {
      filmId: "the-debut",
      filmTitle: "The Debut",
      people: ["Paul Giamatti"],
    },
    {
      filmId: "la-bola-negra",
      filmTitle: "La Bola Negra",
      people: ["Guitarricadelafuente"],
    },
  ],
  "supporting-actress": [
    {
      filmId: "wild-horse-nine",
      filmTitle: "Wild Horse Nine",
      people: ["Mariana di Girolamo"],
    },
    {
      filmId: "the-odyssey",
      filmTitle: "The Odyssey",
      people: ["Anne Hathaway"],
    },
    {
      filmId: "project-hail-mary",
      filmTitle: "Project Hail Mary",
      people: ["Sandra Hüller"],
    },
    {
      filmId: "the-invite",
      filmTitle: "The Invite",
      people: ["Penélope Cruz"],
    },
    {
      filmId: "cliff-booth",
      filmTitle: "The Adventures of Cliff Booth",
      people: ["Elizabeth Debicki"],
    },
  ],
  "original-screenplay": [
    { filmId: "wild-horse-nine", filmTitle: "Wild Horse Nine" },
    { filmId: "fjord", filmTitle: "Fjord" },
    { filmId: "digger", filmTitle: "Digger" },
    { filmId: "obsession", filmTitle: "Obsession" },
    { filmId: "the-debut", filmTitle: "The Debut" },
    { filmId: "saturn-return", filmTitle: "Saturn Return" },
  ],
  "adapted-screenplay": [
    { filmId: "project-hail-mary", filmTitle: "Project Hail Mary" },
    { filmId: "the-odyssey", filmTitle: "The Odyssey" },
    { filmId: "la-bola-negra", filmTitle: "La Bola Negra" },
    { filmId: "dune-part-three", filmTitle: "Dune: Part Three" },
    { filmId: "all-of-a-sudden", filmTitle: "All of a Sudden" },
    { filmId: "fatherland", filmTitle: "Fatherland" },
  ],
};

const orderVariants = [
  [0, 1, 2, 3, 4],
  [1, 0, 4, 2, 3],
  [2, 1, 0, 5, 4],
  [0, 3, 1, 2, 4],
  [0, 3, 1, 4, 2],
];

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function candidate(categoryId: PublicCategoryId, input: CandidateInput) {
  const people = input.people ?? [];
  const id = `candidate-${categoryId}-${input.filmId}${
    people.length ? `-${people.map(slug).join("-")}` : ""
  }`;
  return {
    id,
    seasonId: "oscars-2027",
    categoryId,
    label: people.length
      ? `${people.join(", ")} — ${input.filmTitle}`
      : input.filmTitle,
    film: { id: input.filmId, title: input.filmTitle },
    workTitle: null,
    people: people.map((name, displayOrder) => ({
      id: `fixture-${slug(name)}`,
      name,
      role:
        categoryId === "directing"
          ? "Director"
          : categoryId.includes("screenplay")
            ? "Screenplay"
            : "Acting",
      displayOrder,
    })),
  } satisfies CategoryCandidate;
}

export function phase71FixtureObservations(categoryId: PublicCategoryId) {
  const candidates = pools[categoryId].map((input) =>
    candidate(categoryId, input),
  );
  const orderedSourceIds = categoryId.includes("screenplay")
    ? ["awards-daily", "awards-radar", "next-best-picture", "midnight-critics"]
    : [
        "awardswatch",
        "awards-daily",
        "awards-radar",
        "next-best-picture",
        "midnight-critics",
      ];
  const observations: PredictionObservationV2[] = [];
  orderedSourceIds.forEach((sourceId, sourceIndex) => {
    const source = sourceMeta[sourceId as keyof typeof sourceMeta];
    const indexes = orderVariants[sourceIndex];
    indexes.forEach((candidateIndex, rankIndex) => {
      const item = candidates[candidateIndex % candidates.length];
      observations.push({
        id: `fixture-${categoryId}-${sourceId}-${rankIndex + 1}`,
        sourceId,
        sourceName: source.name,
        publicationId: `${sourceId}-2026-07`,
        publicationUrl: source.url,
        author: null,
        publishedAt: "2026-07-24T12:00:00.000Z",
        capturedAt: "2026-07-25T04:17:00.000Z",
        seasonId: "oscars-2027",
        categoryId,
        intention: "nomination",
        candidate: item,
        dataType: "prediction_ordered",
        rank: rankIndex + 1,
        listLength: indexes.length,
        originalValue: item.label,
        participates: true,
        state: "published",
      });
    });
  });
  if (categoryId === "best-picture") {
    const source = sourceMeta["the-ringer"];
    candidates.slice(0, 6).forEach((item, index) => {
      observations.push({
        id: `fixture-best-picture-the-ringer-${index + 1}`,
        sourceId: "the-ringer",
        sourceName: source.name,
        publicationId: "the-ringer-2026-03-20",
        publicationUrl: source.url,
        author: "Julianna Ress",
        publishedAt: "2026-03-20T12:18:00.000Z",
        capturedAt: "2026-07-25T04:17:00.000Z",
        seasonId: "oscars-2027",
        categoryId,
        intention: "nomination",
        candidate: item,
        dataType: "prediction_selection",
        rank: null,
        listLength: null,
        originalValue: item.label,
        participates: true,
        state: "published",
      });
    });
  }
  return observations;
}

export function phase71FixtureAggregate(categoryId: PublicCategoryId) {
  return aggregatePredictionsV2(phase71FixtureObservations(categoryId), {
    seasonId: "oscars-2027",
    categoryId,
    intention: "nomination",
    cutoffDate: "2026-07-25T04:47:00.000Z",
  });
}

export function phase71FixturePreviousAggregate(categoryId: PublicCategoryId) {
  const current = phase71FixtureAggregate(categoryId);
  const ranking = [...current.ranking];

  if (ranking.length >= 2) {
    [ranking[0], ranking[1]] = [ranking[1], ranking[0]];
  }

  return {
    ...current,
    cutoffDate: "2026-07-20T04:47:00.000Z",
    ranking: ranking.slice(0, -1).map((candidate, index) => ({
      ...candidate,
      position: index + 1,
      movement: null,
    })),
  };
}

export const phase71FixtureSeasonSummary = PUBLIC_CATEGORIES.map((category) => {
  const aggregate = phase71FixtureAggregate(category.id);
  return {
    ...category,
    candidateCount: aggregate.ranking.length,
    orderedSourceCount: aggregate.orderedSourceCount,
    applicableSourceCount: aggregate.applicableSourceCount,
    updatedAt: "2026-07-25T04:47:00.000Z",
    isPublic: aggregate.isConsensus,
  };
});
