export type FilmFixture = {
  id: string;
  title: string;
  alternateTitles: string[];
  releaseStatus: "released" | "upcoming";
  releaseDate: string | null;
  verificationUrl: string;
  notes: string | null;
};

export const filmFixtures: FilmFixture[] = [
  {
    id: "the-odyssey",
    title: "The Odyssey",
    alternateTitles: [],
    releaseStatus: "released",
    releaseDate: "2026-07-17",
    verificationUrl:
      "https://www.theguardian.com/film/2026/jul/15/the-odyssey-review-christopher-nolan-matt-damon",
    notes: "Fecha de estreno UK/US indicada en la reseña.",
  },
  {
    id: "dune-part-three",
    title: "Dune: Part Three",
    alternateTitles: ["Dune Part III", "Dune: Messiah"],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl:
      "https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/",
    notes: "Se conservan las variantes publicadas.",
  },
  {
    id: "wild-horse-nine",
    title: "Wild Horse Nine",
    alternateTitles: ["Wild Horse 9"],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl:
      "https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/",
    notes: "La variante numérica queda conservada.",
  },
  {
    id: "project-hail-mary",
    title: "Project Hail Mary",
    alternateTitles: [],
    releaseStatus: "released",
    releaseDate: "2026-03-20",
    verificationUrl:
      "https://www.theguardian.com/film/2026/mar/10/project-hail-mary-review-ryan-goslings-charm-carries-unserious-last-ditch-space-mission",
    notes: "Fecha de estreno US indicada en la reseña.",
  },
  {
    id: "la-bola-negra",
    title: "La Bola Negra",
    alternateTitles: [],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl: "https://predictions.nextbestpicture.com/oscars",
    notes: null,
  },
  {
    id: "fjord",
    title: "Fjord",
    alternateTitles: [],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl: "https://predictions.nextbestpicture.com/oscars",
    notes: null,
  },
  {
    id: "digger",
    title: "Digger",
    alternateTitles: [],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl: "https://awardsradar.com/best-picture/",
    notes: null,
  },
  {
    id: "the-debut",
    title: "The Debut",
    alternateTitles: [],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl: "https://predictions.nextbestpicture.com/oscars",
    notes: null,
  },
  {
    id: "behemoth",
    title: "Behemoth!",
    alternateTitles: [],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl: "https://predictions.nextbestpicture.com/oscars",
    notes: null,
  },
  {
    id: "cliff-booth",
    title: "The Adventures of Cliff Booth",
    alternateTitles: ["Untitled Cliff Booth Movie"],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl:
      "https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/",
    notes: "Se conserva el título provisional usado por la fuente.",
  },
  {
    id: "the-invite",
    title: "The Invite",
    alternateTitles: [],
    releaseStatus: "released",
    releaseDate: null,
    verificationUrl: "https://predictions.nextbestpicture.com/oscars",
    notes: "La muestra no fija fecha de estreno.",
  },
  {
    id: "obsession",
    title: "Obsession",
    alternateTitles: [],
    releaseStatus: "released",
    releaseDate: null,
    verificationUrl: "https://www.metacritic.com/movie/obsession-2025/",
    notes:
      "El slug de la fuente conserva 2025; la muestra corresponde a estreno en 2026.",
  },
  {
    id: "the-social-reckoning",
    title: "The Social Reckoning",
    alternateTitles: [],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl: "https://awardsradar.com/best-picture/",
    notes: null,
  },
  {
    id: "fatherland",
    title: "Fatherland",
    alternateTitles: [],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl:
      "https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/",
    notes: null,
  },
  {
    id: "all-of-a-sudden",
    title: "All of a Sudden",
    alternateTitles: ["Soudain", "Soudain (All of a Sudden)"],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl:
      "https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/",
    notes: "Se conserva el título alternativo publicado.",
  },
  {
    id: "being-heumann",
    title: "Being Heumann",
    alternateTitles: [],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl:
      "https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/",
    notes: null,
  },
  {
    id: "michael",
    title: "Michael",
    alternateTitles: [],
    releaseStatus: "released",
    releaseDate: null,
    verificationUrl:
      "https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/",
    notes: "La muestra no fija fecha de estreno.",
  },
  {
    id: "sense-and-sensibility",
    title: "Sense and Sensibility",
    alternateTitles: [],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl:
      "https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/",
    notes: null,
  },
  {
    id: "saturn-return",
    title: "Saturn Return",
    alternateTitles: [],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl:
      "https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/",
    notes: null,
  },
  {
    id: "primetime",
    title: "Primetime",
    alternateTitles: [],
    releaseStatus: "upcoming",
    releaseDate: null,
    verificationUrl:
      "https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/",
    notes: null,
  },
];

const filmByLabel = new Map(
  filmFixtures.flatMap((film) =>
    [film.title, ...film.alternateTitles].map(
      (label) => [label, film] as const,
    ),
  ),
);

export function findFilmById(id: string) {
  return filmFixtures.find((film) => film.id === id);
}

export function filmHref(id: string) {
  return `/peliculas/${id}`;
}

export function filmHrefForLabel(label: string) {
  const film = filmByLabel.get(label);
  return film ? filmHref(film.id) : null;
}
