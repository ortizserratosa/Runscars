import archive2026 from "../../../data/phase-7/oscars-2026.json";
import historicalArchive from "../../../data/phase-9-5/academy-archive-2022-2025.json";
import { PUBLIC_CATEGORIES, type PublicCategoryId } from "../categories/config";

export type HistoricalNominee = {
  film: string;
  people: string[];
  winner: boolean;
};

export type HistoricalCategory = {
  id: PublicCategoryId;
  name: string;
  nominees: HistoricalNominee[];
};

export type HistoricalEdition = {
  ceremonyYear: number;
  eligibilityYear: number;
  ceremonyOn: string;
  capturedAt: string;
  sourceUrl: string;
  sourceAuthor: string;
  categories: HistoricalCategory[];
};

function categoryName(categoryId: string) {
  return PUBLIC_CATEGORIES.find((category) => category.id === categoryId)?.name;
}

function categoryOrder(categoryId: string) {
  return PUBLIC_CATEGORIES.findIndex((category) => category.id === categoryId);
}

const olderEditions: HistoricalEdition[] = historicalArchive.editions.map(
  (edition) => ({
    ceremonyYear: edition.ceremonyYear,
    eligibilityYear: edition.eligibilityYear,
    ceremonyOn: edition.ceremonyOn,
    capturedAt: historicalArchive.capturedAt,
    sourceUrl: historicalArchive.source.urlTemplate.replace(
      "{year}",
      String(edition.ceremonyYear),
    ),
    sourceAuthor: historicalArchive.source.author,
    categories: edition.categories
      .map((category) => ({
        id: category.categoryId as PublicCategoryId,
        name: categoryName(category.categoryId) ?? category.categoryId,
        nominees: category.nominees.map((nominee) => ({
          film: nominee.film,
          people: "people" in nominee ? [...nominee.people] : [],
          winner: "winner" in nominee && nominee.winner === true,
        })),
      }))
      .sort((left, right) => categoryOrder(left.id) - categoryOrder(right.id)),
  }),
);

const edition2026: HistoricalEdition = {
  ceremonyYear: 2026,
  eligibilityYear: 2025,
  ceremonyOn: "2026-03-15",
  capturedAt: archive2026.capturedAt,
  sourceUrl: archive2026.source.sourceUrl,
  sourceAuthor: archive2026.source.author,
  categories: archive2026.categories
    .map((category) => ({
      id: category.categoryId as PublicCategoryId,
      name: categoryName(category.categoryId) ?? category.categoryId,
      nominees: category.candidates.map((candidate) => ({
        film: candidate.filmTitle,
        people: "people" in candidate ? [...(candidate.people ?? [])] : [],
        winner: "winner" in candidate && candidate.winner === true,
      })),
    }))
    .sort((left, right) => categoryOrder(left.id) - categoryOrder(right.id)),
};

export const HISTORICAL_EDITIONS = [edition2026, ...olderEditions].sort(
  (left, right) => right.ceremonyYear - left.ceremonyYear,
);

export function historicalEdition(year: number) {
  return (
    HISTORICAL_EDITIONS.find((edition) => edition.ceremonyYear === year) ?? null
  );
}
