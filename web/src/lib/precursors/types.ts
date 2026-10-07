export type PrecursorEntryView = {
  id: string;
  order: number;
  originalCategory: string;
  originalTitle: string;
  originalRecipient: string | null;
  categoryId: string | null;
  categoryRelation: "corresponding" | "related" | "none";
  filmId: string | null;
  filmTitle: string | null;
};

export type PrecursorSetView = {
  id: string;
  kind: "schedule" | "nominations" | "winners";
  version: number;
  sourceUrl: string;
  sourceTitle: string;
  sourceAuthor: string | null;
  publishedAt: string | null;
  capturedAt: string;
  ceremonyOn: string | null;
  nominationsOn: string | null;
  milestones: { name: string; date: string }[];
  coverage: { es: string; en: string };
  entries: PrecursorEntryView[];
};

export type PrecursorEditionView = {
  id: string;
  organizationId: string;
  name: string;
  nameEn: string;
  organizationKind: "guild" | "critics" | "academy";
  homepageUrl: string;
  notes: { es: string; en: string };
  seasonId: string;
  ceremonyYear: number;
  editionNumber: number | null;
  schedule: PrecursorSetView | null;
  nominations: PrecursorSetView | null;
  winners: PrecursorSetView | null;
};
