import { z } from "zod";

export const filmWatchStateSchema = z.enum([
  "watched",
  "not_watched",
  "unmarked",
]);

export type FilmWatchState = z.infer<typeof filmWatchStateSchema>;

export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  isPublic: z.boolean(),
});

export const rankingSchema = z.object({
  seasonId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  categoryId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  candidateIds: z
    .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
    .min(1)
    .max(50)
    .refine((values) => new Set(values).size === values.length),
  isPublic: z.boolean(),
});

export function parseCandidateIds(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const communityFiltersSchema = z.object({
  seasonId: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .default("oscars-2027"),
  categoryId: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  query: z.string().trim().max(80).default(""),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export function parseCommunityFilters(input: {
  season?: string | string[];
  category?: string | string[];
  q?: string | string[];
  page?: string | string[];
}) {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const parsed = communityFiltersSchema.safeParse({
    seasonId: first(input.season) || "oscars-2027",
    categoryId: first(input.category) || undefined,
    query: first(input.q) || "",
    page: first(input.page) || "1",
  });
  return parsed.success ? parsed.data : communityFiltersSchema.parse({});
}

export const filmStateUpdatesSchema = z
  .array(
    z.object({
      filmId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      state: filmWatchStateSchema,
    }),
  )
  .refine(
    (states) =>
      new Set(states.map((state) => state.filmId)).size === states.length,
  );

export function parseFilmStateUpdates(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    const result = filmStateUpdatesSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}
