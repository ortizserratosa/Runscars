export const PUBLIC_CATEGORIES = [
  {
    id: "best-picture",
    slug: "mejor-pelicula",
    name: "Mejor película",
    nameEn: "Best Picture",
    shortName: "Película",
    shortNameEn: "Picture",
    nomineeSlots: 10,
  },
  {
    id: "directing",
    slug: "direccion",
    name: "Dirección",
    nameEn: "Directing",
    shortName: "Dirección",
    shortNameEn: "Directing",
    nomineeSlots: 5,
  },
  {
    id: "actor",
    slug: "actor-protagonista",
    name: "Actor protagonista",
    nameEn: "Actor in a Leading Role",
    shortName: "Actor",
    shortNameEn: "Actor",
    nomineeSlots: 5,
  },
  {
    id: "actress",
    slug: "actriz-protagonista",
    name: "Actriz protagonista",
    nameEn: "Actress in a Leading Role",
    shortName: "Actriz",
    shortNameEn: "Actress",
    nomineeSlots: 5,
  },
  {
    id: "supporting-actor",
    slug: "actor-de-reparto",
    name: "Actor de reparto",
    nameEn: "Actor in a Supporting Role",
    shortName: "Actor reparto",
    shortNameEn: "Supporting Actor",
    nomineeSlots: 5,
  },
  {
    id: "supporting-actress",
    slug: "actriz-de-reparto",
    name: "Actriz de reparto",
    nameEn: "Actress in a Supporting Role",
    shortName: "Actriz reparto",
    shortNameEn: "Supporting Actress",
    nomineeSlots: 5,
  },
  {
    id: "original-screenplay",
    slug: "guion-original",
    name: "Guion original",
    nameEn: "Original Screenplay",
    shortName: "Guion original",
    shortNameEn: "Original Screenplay",
    nomineeSlots: 5,
  },
  {
    id: "adapted-screenplay",
    slug: "guion-adaptado",
    name: "Guion adaptado",
    nameEn: "Adapted Screenplay",
    shortName: "Guion adaptado",
    shortNameEn: "Adapted Screenplay",
    nomineeSlots: 5,
  },
] as const;

export type PublicCategoryId = (typeof PUBLIC_CATEGORIES)[number]["id"];
export type PublicCategorySlug = (typeof PUBLIC_CATEGORIES)[number]["slug"];

export const RANKING_ALTERNATE_SLOTS = 1;

export const PERSON_RANKING_CATEGORY_IDS = [
  "directing",
  "actor",
  "actress",
  "supporting-actor",
  "supporting-actress",
] as const;

export function rankingRequiresPersonEntry(categoryId: string) {
  return PERSON_RANKING_CATEGORY_IDS.includes(
    categoryId as (typeof PERSON_RANKING_CATEGORY_IDS)[number],
  );
}

export function categoryBySlug(slug: string) {
  return PUBLIC_CATEGORIES.find((category) => category.slug === slug) ?? null;
}

export function categoryById(id: string) {
  return PUBLIC_CATEGORIES.find((category) => category.id === id) ?? null;
}

export function rankingEntryLimit(categoryId: string) {
  const category = categoryById(categoryId);
  return category ? category.nomineeSlots + RANKING_ALTERNATE_SLOTS : null;
}
