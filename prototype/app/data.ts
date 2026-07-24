export type Candidate = {
  id: string;
  title: string;
  score: number;
  coverage: string;
  average: string;
  median: string;
  topFive: number;
  firsts: number;
  movement: number | null;
  sources: Array<{ name: string; rank: number }>;
  tone: string;
};

export type Snapshot = {
  id: string;
  shortDate: string;
  date: string;
  label: string;
  sourceCount: number;
  isConsensus: boolean;
  ranking: Array<{ id: string; title: string; score: number }>;
};

export const sourceNames: Record<string, string> = {
  awardswatch: "AwardsWatch",
  "next-best-picture": "Next Best Picture",
  "awards-daily": "Awards Daily",
  "awards-radar": "Awards Radar",
};

export const candidates: Candidate[] = [
  {
    id: "the-odyssey",
    title: "The Odyssey",
    score: 97.5,
    coverage: "4/4",
    average: "1,25",
    median: "1",
    topFive: 4,
    firsts: 3,
    movement: 0,
    tone: "violet",
    sources: [
      { name: "AwardsWatch", rank: 1 },
      { name: "Next Best Picture", rank: 1 },
      { name: "Awards Daily", rank: 2 },
      { name: "Awards Radar", rank: 1 },
    ],
  },
  {
    id: "project-hail-mary",
    title: "Project Hail Mary",
    score: 80,
    coverage: "4/4",
    average: "3,00",
    median: "3",
    topFive: 4,
    firsts: 1,
    movement: 0,
    tone: "acid",
    sources: [
      { name: "AwardsWatch", rank: 4 },
      { name: "Next Best Picture", rank: 5 },
      { name: "Awards Daily", rank: 1 },
      { name: "Awards Radar", rank: 2 },
    ],
  },
  {
    id: "wild-horse-nine",
    title: "Wild Horse Nine",
    score: 77.5,
    coverage: "4/4",
    average: "3,25",
    median: "3",
    topFive: 4,
    firsts: 0,
    movement: 0,
    tone: "rust",
    sources: [
      { name: "AwardsWatch", rank: 3 },
      { name: "Next Best Picture", rank: 3 },
      { name: "Awards Daily", rank: 4 },
      { name: "Awards Radar", rank: 3 },
    ],
  },
  {
    id: "fjord",
    title: "Fjord",
    score: 65,
    coverage: "4/4",
    average: "4,50",
    median: "4,5",
    topFive: 3,
    firsts: 0,
    movement: 1,
    tone: "blue",
    sources: [
      { name: "AwardsWatch", rank: 6 },
      { name: "Next Best Picture", rank: 4 },
      { name: "Awards Daily", rank: 3 },
      { name: "Awards Radar", rank: 5 },
    ],
  },
  {
    id: "dune-part-three",
    title: "Dune: Part Three",
    score: 65,
    coverage: "4/4",
    average: "4,50",
    median: "5",
    topFive: 2,
    firsts: 0,
    movement: -1,
    tone: "sand",
    sources: [
      { name: "AwardsWatch", rank: 2 },
      { name: "Next Best Picture", rank: 6 },
      { name: "Awards Daily", rank: 6 },
      { name: "Awards Radar", rank: 4 },
    ],
  },
  {
    id: "la-bola-negra",
    title: "La Bola Negra",
    score: 47.5,
    coverage: "3/4",
    average: "4,67",
    median: "5",
    topFive: 2,
    firsts: 0,
    movement: 1,
    tone: "ink",
    sources: [
      { name: "AwardsWatch", rank: 5 },
      { name: "Next Best Picture", rank: 2 },
      { name: "Awards Daily", rank: 7 },
    ],
  },
  {
    id: "digger",
    title: "Digger",
    score: 37.5,
    coverage: "4/4",
    average: "7,25",
    median: "7,5",
    topFive: 0,
    firsts: 0,
    movement: -1,
    tone: "clay",
    sources: [
      { name: "AwardsWatch", rank: 7 },
      { name: "Next Best Picture", rank: 8 },
      { name: "Awards Daily", rank: 8 },
      { name: "Awards Radar", rank: 6 },
    ],
  },
  {
    id: "the-debut",
    title: "The Debut",
    score: 22.5,
    coverage: "4/4",
    average: "8,75",
    median: "8,5",
    topFive: 0,
    firsts: 0,
    movement: 1,
    tone: "rose",
    sources: [
      { name: "AwardsWatch", rank: 8 },
      { name: "Next Best Picture", rank: 9 },
      { name: "Awards Daily", rank: 10 },
      { name: "Awards Radar", rank: 8 },
    ],
  },
  {
    id: "cliff-booth",
    title: "The Adventures of Cliff Booth",
    score: 22.5,
    coverage: "3/4",
    average: "8,00",
    median: "9",
    topFive: 1,
    firsts: 0,
    movement: -1,
    tone: "sun",
    sources: [
      { name: "AwardsWatch", rank: 10 },
      { name: "Awards Daily", rank: 5 },
      { name: "Awards Radar", rank: 9 },
    ],
  },
  {
    id: "behemoth",
    title: "Behemoth!",
    score: 15,
    coverage: "2/4",
    average: "8,00",
    median: "8",
    topFive: 0,
    firsts: 0,
    movement: 1,
    tone: "moss",
    sources: [
      { name: "AwardsWatch", rank: 9 },
      { name: "Next Best Picture", rank: 7 },
    ],
  },
];

export const snapshots: Snapshot[] = [
  {
    id: "2026-07-04",
    shortDate: "04 JUL",
    date: "4 de julio de 2026",
    label: "Señal inicial",
    sourceCount: 1,
    isConsensus: false,
    ranking: [
      { id: "project-hail-mary", title: "Project Hail Mary", score: 100 },
      { id: "the-odyssey", title: "The Odyssey", score: 90 },
      { id: "fjord", title: "Fjord", score: 80 },
      { id: "wild-horse-nine", title: "Wild Horse Nine", score: 70 },
      { id: "cliff-booth", title: "The Adventures of Cliff Booth", score: 60 },
      { id: "dune-part-three", title: "Dune: Part Three", score: 50 },
      { id: "la-bola-negra", title: "La Bola Negra", score: 40 },
      { id: "digger", title: "Digger", score: 30 },
    ],
  },
  {
    id: "2026-07-15",
    shortDate: "15 JUL",
    date: "15 de julio de 2026",
    label: "Segundo corte",
    sourceCount: 2,
    isConsensus: false,
    ranking: [
      { id: "the-odyssey", title: "The Odyssey", score: 95 },
      { id: "project-hail-mary", title: "Project Hail Mary", score: 85 },
      { id: "wild-horse-nine", title: "Wild Horse Nine", score: 75 },
      { id: "dune-part-three", title: "Dune: Part Three", score: 70 },
      { id: "fjord", title: "Fjord", score: 65 },
      { id: "la-bola-negra", title: "La Bola Negra", score: 50 },
      { id: "cliff-booth", title: "The Adventures of Cliff Booth", score: 35 },
      { id: "digger", title: "Digger", score: 35 },
    ],
  },
  {
    id: "2026-07-20",
    shortDate: "20 JUL",
    date: "20 de julio de 2026",
    label: "Primer consenso",
    sourceCount: 3,
    isConsensus: true,
    ranking: [
      { id: "the-odyssey", title: "The Odyssey", score: 96.7 },
      { id: "project-hail-mary", title: "Project Hail Mary", score: 86.7 },
      { id: "wild-horse-nine", title: "Wild Horse Nine", score: 76.7 },
      { id: "dune-part-three", title: "Dune: Part Three", score: 70 },
      { id: "fjord", title: "Fjord", score: 63.3 },
      { id: "digger", title: "Digger", score: 40 },
      { id: "la-bola-negra", title: "La Bola Negra", score: 33.3 },
      { id: "cliff-booth", title: "The Adventures of Cliff Booth", score: 30 },
    ],
  },
  {
    id: "2026-07-23",
    shortDate: "23 JUL",
    date: "23 de julio de 2026",
    label: "Corte actual",
    sourceCount: 4,
    isConsensus: true,
    ranking: candidates.slice(0, 8).map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      score: candidate.score,
    })),
  },
];

export const categories = [
  { name: "Mejor película", count: "20", status: "4 listas activas", featured: true },
  { name: "Dirección", count: "—", status: "Pendiente de ingesta", featured: false },
  { name: "Actor protagonista", count: "—", status: "Pendiente de ingesta", featured: false },
  { name: "Actriz protagonista", count: "—", status: "Pendiente de ingesta", featured: false },
  { name: "Actor de reparto", count: "—", status: "Pendiente de ingesta", featured: false },
  { name: "Actriz de reparto", count: "—", status: "Pendiente de ingesta", featured: false },
  { name: "Guion original", count: "—", status: "Pendiente de ingesta", featured: false },
  { name: "Guion adaptado", count: "—", status: "Pendiente de ingesta", featured: false },
];

export const awardsWatchRanking = [
  "The Odyssey",
  "Dune: Part Three",
  "Wild Horse Nine",
  "Project Hail Mary",
  "La Bola Negra",
  "Fjord",
  "Digger",
  "The Debut",
  "Behemoth!",
  "Untitled Cliff Booth Movie",
];

export const awardsWatchRadar = [
  "The Social Reckoning",
  "Fatherland",
  "Soudain (All of a Sudden)",
  "Being Heumann",
  "Michael",
  "Sense and Sensibility",
  "Saturn Return",
  "Primetime",
];

export const odysseyReviews = [
  {
    source: "The Guardian",
    author: "Peter Bradshaw",
    date: "15 jul 2026",
    value: "5/5",
    normalized: "5,00/5",
    kind: "Puntuación individual",
    href: "https://www.theguardian.com/film/2026/jul/15/the-odyssey-review-christopher-nolan-matt-damon",
  },
  {
    source: "Metacritic",
    author: "Agregado contextual",
    date: "24 jul 2026",
    value: "88/100",
    normalized: "No participa",
    kind: "62 reseñas",
    href: "https://www.metacritic.com/movie/the-odyssey-2026/",
  },
  {
    source: "Rotten Tomatoes",
    author: "Agregado contextual",
    date: "24 jul 2026",
    value: "94%",
    normalized: "No participa",
    kind: "431 reseñas",
    href: "https://www.rottentomatoes.com/m/the_odyssey_2026",
  },
];

export const odysseyReviewLinks = [
  {
    source: "Variety",
    author: "Guy Lodge",
    date: "16 jul 2026",
    href: "https://au.variety.com/2026/film/reviews/the-odyssey-review-christopher-nolan-38603/",
  },
  {
    source: "RogerEbert.com",
    author: "Matt Zoller Seitz",
    date: "15 jul 2026",
    href: "https://www.rogerebert.com/reviews/the-odyssey-christopher-nolan-matt-damon-film-review-2026",
  },
  {
    source: "Los Angeles Times",
    author: "Amy Nicholson",
    date: "15 jul 2026",
    href: "https://www.latimes.com/entertainment-arts/movies/story/2026-07-15/odyssey-review-christopher-nolan-matt-damon-anne-hathaway-tom-holland",
  },
  {
    source: "Little White Lies",
    author: "Hannah Strong",
    date: "15 jul 2026",
    href: "https://lwlies.com/reviews/the-odyssey-2",
  },
  {
    source: "The Film Stage",
    author: "Nick Newman",
    date: "15 jul 2026",
    href: "https://thefilmstage.com/the-odyssey-review-christopher-nolans-journey-of-perpetual-enervating-awe/",
  },
  {
    source: "The Washington Post",
    author: "Gene Park",
    date: "17 jul 2026",
    href: "https://www.washingtonpost.com/entertainment/movies/2026/07/17/every-christopher-nolan-movie-ranked-including-odyssey/",
  },
];
