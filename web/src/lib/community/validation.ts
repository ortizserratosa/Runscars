import { z } from "zod";
import { rankingEntryLimit } from "../categories/config";

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

const candidateIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const tmdbUrlInputSchema = z.string().trim().min(1).max(500);
const optionalTmdbUrlInputSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  tmdbUrlInputSchema.optional(),
);

export const manualTmdbPreviewSchema = z.object({
  tmdbKind: z.enum(["movie", "person"]),
  label: z.string().trim().min(2).max(120),
  tmdbUrl: z.url(),
  tmdbMovieId: z.number().int().positive().nullable(),
  tmdbPersonId: z.number().int().positive().nullable(),
  qualifyingMovieTmdbUrl: z.url().nullable(),
  qualifyingMovieTmdbId: z.number().int().positive().nullable(),
  usTheatricalReleaseDate: z.iso.date(),
  tmdbVerifiedAt: z.iso.datetime(),
});

export type ManualTmdbPreview = z.infer<typeof manualTmdbPreviewSchema>;

export const rankingEntryInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("candidate"),
    candidateId: candidateIdSchema,
  }),
  z.object({
    kind: z.literal("custom"),
    label: z.string().trim().min(2).max(120),
    tmdbUrl: tmdbUrlInputSchema,
    qualifyingMovieTmdbUrl: optionalTmdbUrlInputSchema,
    usTheatricalReleaseDate: z.iso.date().optional(),
    tmdbVerifiedAt: z.iso.datetime().optional(),
  }),
]);

export type RankingEntryInput = z.infer<typeof rankingEntryInputSchema>;

export const rankingSchema = z
  .object({
    seasonId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    categoryId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    entries: z.array(rankingEntryInputSchema).min(1),
    isPublic: z.boolean(),
  })
  .superRefine((ranking, context) => {
    const limit = rankingEntryLimit(ranking.categoryId);
    if (limit === null || ranking.entries.length > limit) {
      context.addIssue({
        code: "too_big",
        maximum: limit ?? 0,
        origin: "array",
        path: ["entries"],
        message: "Ranking exceeds the category limit",
      });
    }

    const candidateIds = ranking.entries.flatMap((entry) =>
      entry.kind === "candidate" ? [entry.candidateId] : [],
    );
    if (new Set(candidateIds).size !== candidateIds.length) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Ranking candidates must be unique",
      });
    }

    if (ranking.entries.filter((entry) => entry.kind === "custom").length > 1) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Only one custom entry is allowed",
      });
    }
  });

export function parseRankingEntries(value: FormDataEntryValue | null) {
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
