import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categoryById } from "../categories/config";
import { isSupabaseConfigured } from "../environment";
import {
  evaluateNominationsV2,
  evaluateWinnerV2,
} from "../snapshots/evaluation-v2";
import type {
  LockedPredictionSnapshotV2,
  OfficialResultsPayloadV2,
  PredictionSnapshotPayloadV2,
} from "../snapshots/v2";
import { createSupabaseServerClient } from "../supabase/server";

type NominationMetric = ReturnType<typeof evaluateNominationsV2> & {
  snapshotLockedAt: string;
  sourceUrl: string;
};
type WinnerMetric = ReturnType<typeof evaluateWinnerV2> & {
  snapshotLockedAt: string;
  sourceUrl: string;
};

export type PublicEvaluationCategory = {
  categoryId: string;
  categoryName: string;
  nominations: NominationMetric | null;
  winner: WinnerMetric | null;
};

export type PublicEvaluationSeason = {
  seasonId: string;
  ceremonyYear: number;
  categories: PublicEvaluationCategory[];
  totals: {
    nominationHits: number;
    nominationPredictions: number;
    officialNominees: number;
    winnerHits: number;
    winnerEvaluations: number;
  };
};

export type PublicEvaluationReport = {
  state: "database" | "unavailable";
  seasons: PublicEvaluationSeason[];
  activeSeason: { id: string; ceremonyYear: number } | null;
};

type LooseRow = Record<string, unknown>;

function asPayload<T>(value: unknown): T | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : null;
}

export async function getPublicEvaluationReport(): Promise<PublicEvaluationReport> {
  if (!isSupabaseConfigured()) {
    return { state: "unavailable", seasons: [], activeSeason: null };
  }

  const client = createSupabaseServerClient() as unknown as SupabaseClient;
  const [seasonResult, snapshotPointerResult, resultPointerResult] =
    await Promise.all([
      client
        .from("seasons")
        .select("id,ceremony_year,status")
        .order("ceremony_year", { ascending: false }),
      client
        .from("current_aggregate_snapshots")
        .select("season_id,category_id,prediction_intention,kind,snapshot_id")
        .in("kind", ["nomination_final", "winner_final"]),
      client
        .from("current_official_result_sets")
        .select("season_id,kind,result_set_id"),
    ]);

  if (
    seasonResult.error ||
    snapshotPointerResult.error ||
    resultPointerResult.error
  ) {
    return { state: "unavailable", seasons: [], activeSeason: null };
  }

  const seasons = (seasonResult.data ?? []) as Array<{
    id: string;
    ceremony_year: number;
    status: string;
  }>;
  const active = seasons.find((season) => season.status === "active") ?? null;
  const snapshotPointers = (snapshotPointerResult.data ?? []) as Array<{
    season_id: string;
    category_id: string;
    prediction_intention: "nomination" | "winner";
    kind: "nomination_final" | "winner_final";
    snapshot_id: string;
  }>;
  const resultPointers = (resultPointerResult.data ?? []) as Array<{
    season_id: string;
    kind: "nominations" | "winners";
    result_set_id: string;
  }>;
  const snapshotIds = snapshotPointers.map((pointer) => pointer.snapshot_id);
  const resultIds = resultPointers.map((pointer) => pointer.result_set_id);

  const [snapshotResult, officialResult] = await Promise.all([
    snapshotIds.length
      ? client
          .from("aggregate_snapshots")
          .select(
            "id,content_hash,locked_at,locked_by,corrects_snapshot_id,correction_reason,payload,schema_version",
          )
          .in("id", snapshotIds)
          .eq("schema_version", "runscars-snapshot-v2")
      : Promise.resolve({ data: [] as LooseRow[], error: null }),
    resultIds.length
      ? client
          .from("official_result_sets")
          .select("id,payload,source_url,schema_version")
          .in("id", resultIds)
          .eq("schema_version", "runscars-snapshot-v2")
      : Promise.resolve({ data: [] as LooseRow[], error: null }),
  ]);
  if (snapshotResult.error || officialResult.error) {
    return {
      state: "unavailable",
      seasons: [],
      activeSeason: active
        ? { id: active.id, ceremonyYear: active.ceremony_year }
        : null,
    };
  }

  const snapshots = new Map(
    ((snapshotResult.data ?? []) as LooseRow[]).map((row) => [row.id, row]),
  );
  const results = new Map(
    ((officialResult.data ?? []) as LooseRow[]).map((row) => [row.id, row]),
  );
  const reports = new Map<string, Map<string, PublicEvaluationCategory>>();

  for (const pointer of snapshotPointers) {
    const snapshotRow = snapshots.get(pointer.snapshot_id);
    const resultPointer = resultPointers.find(
      (candidate) =>
        candidate.season_id === pointer.season_id &&
        candidate.kind ===
          (pointer.kind === "nomination_final" ? "nominations" : "winners"),
    );
    const resultRow = resultPointer
      ? results.get(resultPointer.result_set_id)
      : null;
    if (!snapshotRow || !resultRow || !resultPointer) continue;

    const snapshotPayload = asPayload<PredictionSnapshotPayloadV2>(
      snapshotRow.payload,
    );
    const resultPayload = asPayload<OfficialResultsPayloadV2>(
      resultRow.payload,
    );
    if (!snapshotPayload || !resultPayload) continue;
    const snapshot: LockedPredictionSnapshotV2 = {
      id: String(snapshotRow.id),
      contentHash: String(snapshotRow.content_hash),
      lockedAt: String(snapshotRow.locked_at),
      lockedBy: String(snapshotRow.locked_by),
      correctsSnapshotId: snapshotRow.corrects_snapshot_id
        ? String(snapshotRow.corrects_snapshot_id)
        : null,
      correctionReason: snapshotRow.correction_reason
        ? String(snapshotRow.correction_reason)
        : null,
      payload: snapshotPayload,
    };
    const official = {
      id: resultPointer.result_set_id,
      payload: resultPayload,
    };
    const seasonReport = reports.get(pointer.season_id) ?? new Map();
    const categoryReport = seasonReport.get(pointer.category_id) ?? {
      categoryId: pointer.category_id,
      categoryName:
        categoryById(pointer.category_id)?.name ?? pointer.category_id,
      nominations: null,
      winner: null,
    };
    try {
      if (pointer.kind === "nomination_final") {
        categoryReport.nominations = {
          ...evaluateNominationsV2(snapshot, official),
          snapshotLockedAt: snapshot.lockedAt,
          sourceUrl: String(resultRow.source_url),
        };
      } else {
        categoryReport.winner = {
          ...evaluateWinnerV2(snapshot, official),
          snapshotLockedAt: snapshot.lockedAt,
          sourceUrl: String(resultRow.source_url),
        };
      }
    } catch {
      continue;
    }
    seasonReport.set(pointer.category_id, categoryReport);
    reports.set(pointer.season_id, seasonReport);
  }

  const evaluatedSeasons = seasons.flatMap(
    (season): PublicEvaluationSeason[] => {
      const categories = [...(reports.get(season.id)?.values() ?? [])].sort(
        (left, right) =>
          left.categoryName.localeCompare(right.categoryName, "es"),
      );
      if (!categories.length) return [];
      return [
        {
          seasonId: season.id,
          ceremonyYear: season.ceremony_year,
          categories,
          totals: categories.reduce(
            (totals, category) => ({
              nominationHits:
                totals.nominationHits + (category.nominations?.hits ?? 0),
              nominationPredictions:
                totals.nominationPredictions +
                (category.nominations?.predictedCandidateIds.length ?? 0),
              officialNominees:
                totals.officialNominees +
                (category.nominations?.officialNomineeIds.length ?? 0),
              winnerHits:
                totals.winnerHits + (category.winner?.winnerWasFirst ? 1 : 0),
              winnerEvaluations:
                totals.winnerEvaluations + (category.winner ? 1 : 0),
            }),
            {
              nominationHits: 0,
              nominationPredictions: 0,
              officialNominees: 0,
              winnerHits: 0,
              winnerEvaluations: 0,
            },
          ),
        },
      ];
    },
  );

  return {
    state: "database",
    seasons: evaluatedSeasons,
    activeSeason: active
      ? { id: active.id, ceremonyYear: active.ceremony_year }
      : null,
  };
}
