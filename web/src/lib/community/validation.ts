import { z } from "zod";

export const profileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(60),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(48)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    isPublic: z.boolean(),
    watchedIsPublic: z.boolean(),
  })
  .refine((profile) => !profile.watchedIsPublic || profile.isPublic, {
    path: ["watchedIsPublic"],
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
