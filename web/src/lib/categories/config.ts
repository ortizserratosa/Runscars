export const PUBLIC_CATEGORIES = [
  {
    id: "best-picture",
    slug: "mejor-pelicula",
    name: "Mejor película",
    nameEn: "Best Picture",
    shortName: "Película",
    shortNameEn: "Picture",
  },
  {
    id: "directing",
    slug: "direccion",
    name: "Dirección",
    nameEn: "Directing",
    shortName: "Dirección",
    shortNameEn: "Directing",
  },
  {
    id: "actor",
    slug: "actor-protagonista",
    name: "Actor protagonista",
    nameEn: "Actor in a Leading Role",
    shortName: "Actor",
    shortNameEn: "Actor",
  },
  {
    id: "actress",
    slug: "actriz-protagonista",
    name: "Actriz protagonista",
    nameEn: "Actress in a Leading Role",
    shortName: "Actriz",
    shortNameEn: "Actress",
  },
  {
    id: "supporting-actor",
    slug: "actor-de-reparto",
    name: "Actor de reparto",
    nameEn: "Actor in a Supporting Role",
    shortName: "Actor reparto",
    shortNameEn: "Supporting Actor",
  },
  {
    id: "supporting-actress",
    slug: "actriz-de-reparto",
    name: "Actriz de reparto",
    nameEn: "Actress in a Supporting Role",
    shortName: "Actriz reparto",
    shortNameEn: "Supporting Actress",
  },
  {
    id: "original-screenplay",
    slug: "guion-original",
    name: "Guion original",
    nameEn: "Original Screenplay",
    shortName: "Guion original",
    shortNameEn: "Original Screenplay",
  },
  {
    id: "adapted-screenplay",
    slug: "guion-adaptado",
    name: "Guion adaptado",
    nameEn: "Adapted Screenplay",
    shortName: "Guion adaptado",
    shortNameEn: "Adapted Screenplay",
  },
] as const;

export type PublicCategoryId = (typeof PUBLIC_CATEGORIES)[number]["id"];
export type PublicCategorySlug = (typeof PUBLIC_CATEGORIES)[number]["slug"];

export function categoryBySlug(slug: string) {
  return PUBLIC_CATEGORIES.find((category) => category.slug === slug) ?? null;
}

export function categoryById(id: string) {
  return PUBLIC_CATEGORIES.find((category) => category.id === id) ?? null;
}
