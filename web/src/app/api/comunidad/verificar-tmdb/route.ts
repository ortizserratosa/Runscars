import { z } from "zod";
import { getCurrentUser } from "../../../../lib/auth/session";
import {
  ManualTmdbVerificationError,
  verifyManualRankingEntry,
} from "../../../../lib/tmdb/manual-verification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  seasonId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  categoryId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  tmdbUrl: z.string().trim().min(1).max(500),
  qualifyingMovieTmdbUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || undefined),
});

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: season, error: seasonError } = await current.supabase
    .from("seasons")
    .select("eligibility_year")
    .eq("id", parsed.data.seasonId)
    .maybeSingle();
  if (seasonError || !season) {
    return Response.json(
      { error: "verification_unavailable" },
      { status: 503 },
    );
  }

  try {
    const verification = await verifyManualRankingEntry({
      ...parsed.data,
      eligibilityYear: season.eligibility_year,
    });
    const publicVerification = {
      tmdbKind: verification.tmdbKind,
      label: verification.label,
      tmdbUrl: verification.tmdbUrl,
      tmdbMovieId: verification.tmdbMovieId,
      tmdbPersonId: verification.tmdbPersonId,
      qualifyingMovieTmdbUrl: verification.qualifyingMovieTmdbUrl,
      qualifyingMovieTmdbId: verification.qualifyingMovieTmdbId,
      usTheatricalReleaseDate: verification.usTheatricalReleaseDate,
      tmdbVerifiedAt: verification.tmdbVerifiedAt,
    };
    return Response.json({ ok: true, entry: publicVerification });
  } catch (error) {
    if (error instanceof ManualTmdbVerificationError) {
      return Response.json(
        { error: error.code },
        { status: error.code === "tmdb_unavailable" ? 503 : 422 },
      );
    }
    return Response.json(
      { error: "verification_unavailable" },
      { status: 503 },
    );
  }
}
