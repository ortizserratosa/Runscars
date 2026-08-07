export const PUBLIC_CATEGORIES = [
  {
    id: "best-picture",
    slug: "mejor-pelicula",
    name: "Mejor película",
    shortName: "Película",
  },
  {
    id: "directing",
    slug: "direccion",
    name: "Dirección",
    shortName: "Dirección",
  },
  {
    id: "actor",
    slug: "actor-protagonista",
    name: "Actor protagonista",
    shortName: "Actor",
  },
  {
    id: "actress",
    slug: "actriz-protagonista",
    name: "Actriz protagonista",
    shortName: "Actriz",
  },
  {
    id: "supporting-actor",
    slug: "actor-de-reparto",
    name: "Actor de reparto",
    shortName: "Actor reparto",
  },
  {
    id: "supporting-actress",
    slug: "actriz-de-reparto",
    name: "Actriz de reparto",
    shortName: "Actriz reparto",
  },
  {
    id: "original-screenplay",
    slug: "guion-original",
    name: "Guion original",
    shortName: "Guion original",
  },
  {
    id: "adapted-screenplay",
    slug: "guion-adaptado",
    name: "Guion adaptado",
    shortName: "Guion adaptado",
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
