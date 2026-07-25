import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { PredictionObservation } from "../aggregation";
import type { LockedPredictionSnapshot } from ".";
import {
  type SnapshotSchedule,
  type SnapshotSchedulerRepository,
} from "./scheduler-core";

export * from "./scheduler-core";

const snapshotEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20)
    .refine((value) => !value.startsWith("replace-with-")),
});

function databaseError<T>(
  result: { data: T | null; error: { message: string } | null },
  action: string,
) {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message}`);
  }
  return result.data;
}

type JsonRecord = Record<string, unknown>;

function numberFromJson(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export class SupabaseSnapshotSchedulerRepository implements SnapshotSchedulerRepository {
  private readonly client: SupabaseClient;

  constructor(environment = process.env) {
    const parsed = snapshotEnvironmentSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: environment.SUPABASE_SERVICE_ROLE_KEY,
    });
    this.client = createClient(
      parsed.NEXT_PUBLIC_SUPABASE_URL,
      parsed.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
  }

  async activeSchedules() {
    const rows =
      databaseError(
        await this.client
          .from("snapshot_schedules")
          .select(
            "id, season_id, category_id, prediction_intention, kind, time_zone",
          )
          .eq("is_active", true)
          .order("id"),
        "No se pudieron cargar las programaciones de snapshots",
      ) ?? [];

    return rows.map((row): SnapshotSchedule => ({
      id: row.id,
      seasonId: row.season_id,
      categoryId: row.category_id,
      intention: row.prediction_intention,
      kind: row.kind,
      timeZone: row.time_zone,
    }));
  }

  async predictionObservations(schedule: SnapshotSchedule) {
    const observations =
      databaseError(
        await this.client
          .from("professional_observations")
          .select(
            "id, source_id, publication_id, film_id, data_type, original_subject, original_value, source_url, author, published_at, captured_at, participates, state",
          )
          .eq("season_id", schedule.seasonId)
          .eq("category_id", schedule.categoryId)
          .eq("prediction_intention", schedule.intention)
          .eq("state", "published")
          .eq("participates", true)
          .in("data_type", ["prediction_ordered", "prediction_selection"]),
        `No se pudieron cargar observaciones para ${schedule.id}`,
      ) ?? [];

    const sourceIds = [...new Set(observations.map((row) => row.source_id))];
    const publicationIds = [
      ...new Set(observations.map((row) => row.publication_id)),
    ];
    const filmIds = [
      ...new Set(
        observations.flatMap((row) => (row.film_id ? [row.film_id] : [])),
      ),
    ];
    if (
      sourceIds.length === 0 ||
      publicationIds.length === 0 ||
      filmIds.length === 0
    ) {
      return [];
    }

    const [sourceResult, publicationResult, filmResult] = await Promise.all([
      this.client
        .from("sources")
        .select("id, name, publication_status")
        .in("id", sourceIds),
      this.client
        .from("source_publications")
        .select("id, external_id, canonical_url")
        .in("id", publicationIds),
      this.client.from("films").select("id, title").in("id", filmIds),
    ]);
    const sources =
      databaseError(sourceResult, "No se pudieron cargar las fuentes") ?? [];
    const publications =
      databaseError(
        publicationResult,
        "No se pudieron cargar las publicaciones",
      ) ?? [];
    const films =
      databaseError(filmResult, "No se pudieron cargar las películas") ?? [];
    const sourceById = new Map(
      sources
        .filter((source) => source.publication_status === "publishable")
        .map((source) => [source.id, source]),
    );
    const publicationById = new Map(
      publications.map((publication) => [publication.id, publication]),
    );
    const filmById = new Map(films.map((film) => [film.id, film]));

    return observations.flatMap((row): PredictionObservation[] => {
      const source = sourceById.get(row.source_id);
      const publication = publicationById.get(row.publication_id);
      const film = row.film_id ? filmById.get(row.film_id) : null;
      const originalValue =
        row.original_value !== null &&
        typeof row.original_value === "object" &&
        !Array.isArray(row.original_value)
          ? (row.original_value as JsonRecord)
          : {};
      if (
        !source ||
        !publication ||
        !film ||
        (row.data_type !== "prediction_ordered" &&
          row.data_type !== "prediction_selection")
      ) {
        return [];
      }

      return [
        {
          id: String(row.id),
          sourceId: source.id,
          sourceName: source.name,
          publicationId: publication.external_id,
          publicationUrl: publication.canonical_url,
          author: row.author,
          publishedAt: row.published_at,
          capturedAt: row.captured_at,
          seasonId: schedule.seasonId,
          filmId: film.id,
          filmTitle: film.title,
          participates: row.participates,
          state: row.state,
          dataType: row.data_type,
          categoryId: schedule.categoryId,
          intention: schedule.intention,
          rank:
            row.data_type === "prediction_ordered"
              ? numberFromJson(originalValue.rank)
              : null,
          listLength:
            row.data_type === "prediction_ordered"
              ? numberFromJson(originalValue.list_length)
              : null,
          originalValue:
            typeof originalValue.raw === "string"
              ? originalValue.raw
              : row.original_subject,
        },
      ];
    });
  }

  async lock(snapshot: LockedPredictionSnapshot) {
    const includedObservationIds =
      snapshot.payload.includedObservationIds.map(Number);
    const excludedObservationIds =
      snapshot.payload.excludedObservationIds.map(Number);
    if (
      [...includedObservationIds, ...excludedObservationIds].some(
        (id) => !Number.isSafeInteger(id) || id <= 0,
      )
    ) {
      throw new Error("El snapshot contiene IDs de observación no persistidos");
    }

    const result = await this.client.rpc("lock_aggregate_snapshot", {
      snapshot_id: snapshot.id,
      snapshot_season_id: snapshot.payload.seasonId,
      snapshot_category_id: snapshot.payload.categoryId,
      snapshot_intention: snapshot.payload.intention,
      snapshot_kind: snapshot.payload.kind,
      snapshot_cutoff_at: snapshot.payload.cutoffAt,
      snapshot_time_zone: snapshot.payload.timeZone,
      snapshot_method_version: snapshot.payload.methodVersion,
      snapshot_schema_version: snapshot.payload.schemaVersion,
      snapshot_content_hash: snapshot.contentHash,
      snapshot_payload: snapshot.payload,
      snapshot_active_source_ids: snapshot.payload.activeSourceIds,
      included_observation_ids: includedObservationIds,
      excluded_observation_ids: excludedObservationIds,
      snapshot_locked_at: snapshot.lockedAt,
      snapshot_locked_by: snapshot.lockedBy,
      corrected_snapshot_id: snapshot.correctsSnapshotId,
      snapshot_correction_reason: snapshot.correctionReason,
    });
    return (
      databaseError(result, `No se pudo bloquear el snapshot ${snapshot.id}`) ??
      false
    );
  }
}
