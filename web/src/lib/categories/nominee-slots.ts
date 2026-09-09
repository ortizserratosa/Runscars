import "server-only";
import { categoryById } from "./config";
import { isSupabaseConfigured } from "../environment";
import { createSupabaseServerClient } from "../supabase/server";

export type NomineeSlots = {
  count: number;
  sourceUrl: string | null;
  verifiedOn: string | null;
  dataState: "database" | "fixture";
};

export async function getNomineeSlots(
  seasonId: string,
  categoryId: string,
): Promise<NomineeSlots | null> {
  const fallback = categoryById(categoryId);
  if (!isSupabaseConfigured()) {
    return fallback
      ? {
          count: fallback.nomineeSlots,
          sourceUrl: null,
          verifiedOn: null,
          dataState: "fixture",
        }
      : null;
  }
  const { data, error } = await createSupabaseServerClient()
    .from("season_categories")
    .select("nominee_slots,nominee_slots_source_url,nominee_slots_verified_on")
    .eq("season_id", seasonId)
    .eq("category_id", categoryId)
    .eq("is_enabled", true)
    .maybeSingle();
  if (error) {
    throw new Error(
      `No se pudieron consultar las plazas oficiales: ${error.message}`,
    );
  }
  return data
    ? {
        count: data.nominee_slots,
        sourceUrl: data.nominee_slots_source_url,
        verifiedOn: data.nominee_slots_verified_on,
        dataState: "database",
      }
    : null;
}
