import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "../supabase/server";
import { fetchAllRows } from "../supabase/pagination";
import type { PredictionEvidenceRow } from "./source-evidence";

export type PredictionSourceStatus = {
  source_id: string;
  source_name: string;
  category_id: string;
  publication_url: string;
  published_at: string | null;
  captured_at: string;
  freshness_at: string;
  original_count: number;
  matched_count: number;
  ordered: boolean;
};

function client() {
  return createSupabaseServerClient() as unknown as SupabaseClient;
}
const environment = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "unconfigured";

// Share one anonymous status read across all eight categories and the source
// index. A per-category cache misses eight times during a season-page render.
const cachedStatuses = unstable_cache(
  async (): Promise<PredictionSourceStatus[]> =>
    fetchAllRows((from, to) =>
      client()
        .from("public_prediction_source_status")
        .select("*")
        .eq("season_id", "oscars-2027")
        .eq("prediction_intention", "nomination")
        .order("source_id")
        .order("category_id")
        .range(from, to),
    ),
  ["public-prediction-source-status-v2", environment],
  { revalidate: 60 },
);
export const getPredictionSourceStatuses = cache(cachedStatuses);

const cachedEvidence = unstable_cache(
  async (sourceId: string): Promise<PredictionEvidenceRow[]> =>
    fetchAllRows((from, to) =>
      client()
        .from("public_prediction_source_evidence")
        .select("*")
        .eq("source_id", sourceId)
        .eq("season_id", "oscars-2027")
        .eq("prediction_intention", "nomination")
        .order("id")
        .range(from, to),
    ),
  ["public-prediction-source-facts-v2", environment],
  { revalidate: 60 },
);
export const getPredictionSourceEvidence = cache(cachedEvidence);
