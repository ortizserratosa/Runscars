import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { PredictionObservation } from "../aggregation";
import type {
  CategoryCandidatePerson,
  PredictionAggregateV2,
  PredictionObservationV2,
} from "../aggregation/v2";
import type { LockedPredictionSnapshot } from ".";
import type { LockedPredictionSnapshotV2 } from "./v2";
import {
  CATEGORY_FRESHNESS_SOURCE_IDS,
  categoryEvidenceFreshness,
  type CategoryEvidenceCapture,
} from "./category-evidence-freshness";
import {
  type SnapshotSchedule,
  type SnapshotSchedulerRepository,
  type SnapshotSchedulerRepositoryV2,
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

const OBSERVATION_PAGE_SIZE = 500;
const REFERENCE_BATCH_SIZE = 200;

async function allDatabaseRows<T>(
  readPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  action: string,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += OBSERVATION_PAGE_SIZE) {
    const page =
      databaseError(
        await readPage(offset, offset + OBSERVATION_PAGE_SIZE - 1),
        action,
      ) ?? [];
    rows.push(...page);
    if (page.length < OBSERVATION_PAGE_SIZE) return rows;
  }
}

async function databaseRowsByIds<T>(
  ids: (string | number)[],
  readBatch: (ids: (string | number)[]) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  action: string,
) {
  const rows: T[] = [];
  for (let offset = 0; offset < ids.length; offset += REFERENCE_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + REFERENCE_BATCH_SIZE);
    rows.push(...(databaseError(await readBatch(batch), action) ?? []));
  }
  return rows;
}

async function pagedDatabaseRowsByIds<T>(
  ids: (string | number)[],
  readPage: (
    ids: (string | number)[],
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  action: string,
) {
  const rows: T[] = [];
  for (let offset = 0; offset < ids.length; offset += REFERENCE_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + REFERENCE_BATCH_SIZE);
    rows.push(
      ...(await allDatabaseRows(
        (from, to) => readPage(batch, from, to),
        action,
      )),
    );
  }
  return rows;
}

function numberFromJson(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export class SupabaseSnapshotSchedulerRepository
  implements SnapshotSchedulerRepository, SnapshotSchedulerRepositoryV2
{
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

  async beginRefreshRun(startedAt: string, trigger: "scheduled" | "manual") {
    const staleBefore = new Date(
      Date.parse(startedAt) - 15 * 60 * 1000,
    ).toISOString();
    databaseError(
      await this.client
        .from("snapshot_refresh_runs")
        .update({
          status: "failed",
          finished_at: startedAt,
          error_summary:
            "Ejecución abandonada; recuperada antes de iniciar un nuevo refresco",
        })
        .eq("status", "running")
        .lt("started_at", staleBefore),
      "No se pudieron recuperar refrescos de snapshots abandonados",
    );
    const run = databaseError<{ id: number }>(
      await this.client
        .from("snapshot_refresh_runs")
        .insert({ trigger, started_at: startedAt })
        .select("id")
        .single(),
      "No se pudo iniciar el refresco de snapshots",
    );
    return run!.id;
  }

  async finishRefreshRun(
    runId: number,
    values: {
      status: "succeeded" | "partial" | "failed";
      finishedAt: string;
      schedulesSeen: number;
      snapshotsCreated: number;
      snapshotsUnchanged: number;
      schedulesSkipped: number;
      schedulesFailed: number;
      errorSummary?: string | null;
      details: unknown[];
    },
  ) {
    databaseError(
      await this.client
        .from("snapshot_refresh_runs")
        .update({
          status: values.status,
          finished_at: values.finishedAt,
          schedules_seen: values.schedulesSeen,
          snapshots_created: values.snapshotsCreated,
          snapshots_unchanged: values.snapshotsUnchanged,
          schedules_skipped: values.schedulesSkipped,
          schedules_failed: values.schedulesFailed,
          error_summary: values.errorSummary ?? null,
          details: values.details,
        })
        .eq("id", runId),
      "No se pudo cerrar el refresco de snapshots",
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

  async predictionObservationsV2(schedule: SnapshotSchedule) {
    // The append-only history quickly exceeds the API's 1,000-row cap.
    // Page in stable ID order so every revision reaches source selection.
    const observations = await allDatabaseRows(
      (from, to) =>
        this.client
          .from("professional_observations")
          .select(
            "id, source_id, publication_id, capture_id, category_candidate_id, data_type, original_subject, original_value, author, published_at, captured_at, participates, state",
          )
          .eq("season_id", schedule.seasonId)
          .eq("category_id", schedule.categoryId)
          .eq("prediction_intention", schedule.intention)
          .eq("state", "published")
          .eq("participates", true)
          .not("category_candidate_id", "is", null)
          .in("data_type", ["prediction_ordered", "prediction_selection"])
          .order("id", { ascending: true })
          .range(from, to),
      `No se pudieron cargar observaciones v2 para ${schedule.id}`,
    );
    const sourceIds = [...new Set(observations.map((row) => row.source_id))];
    const publicationIds = [
      ...new Set(observations.map((row) => row.publication_id)),
    ];
    const candidateIds = [
      ...new Set(
        observations.flatMap((row) =>
          row.category_candidate_id ? [row.category_candidate_id] : [],
        ),
      ),
    ];
    if (
      sourceIds.length === 0 ||
      publicationIds.length === 0 ||
      candidateIds.length === 0
    ) {
      return [];
    }

    const [sources, publications, candidates] = await Promise.all([
      databaseRowsByIds(
        sourceIds,
        (ids) =>
          this.client
            .from("sources")
            .select("id, name, publication_status")
            .in("id", ids),
        "No se pudieron cargar las fuentes",
      ),
      databaseRowsByIds(
        publicationIds,
        (ids) =>
          this.client
            .from("source_publications")
            .select("id, external_id, canonical_url")
            .in("id", ids),
        "No se pudieron cargar las publicaciones",
      ),
      databaseRowsByIds(
        candidateIds,
        (ids) =>
          this.client
            .from("category_candidates")
            .select(
              "id, season_id, category_id, display_label, work_title, films(id,title), category_candidate_people(person_id,role,display_order,people(id,name))",
            )
            .in("id", ids),
        "No se pudieron cargar las candidaturas",
      ),
    ]);
    const sourceById = new Map(
      sources
        .filter((source) => source.publication_status === "publishable")
        .map((source) => [source.id, source]),
    );
    const publicationById = new Map(
      publications.map((publication) => [publication.id, publication]),
    );
    const candidateById = new Map(
      candidates.map((candidate) => [candidate.id, candidate]),
    );
    const undatedPages = observations.flatMap((row) => {
      const publication = publicationById.get(row.publication_id);
      return row.published_at === null &&
        CATEGORY_FRESHNESS_SOURCE_IDS.some((id) => id === row.source_id) &&
        publication
        ? [{ sourceId: row.source_id, url: publication.canonical_url }]
        : [];
    });
    const freshnessByCapture = await this.categoryFreshness(
      undatedPages,
      schedule.categoryId,
    );

    return observations.flatMap((row): PredictionObservationV2[] => {
      const source = sourceById.get(row.source_id);
      const publication = publicationById.get(row.publication_id);
      const candidate = row.category_candidate_id
        ? candidateById.get(row.category_candidate_id)
        : null;
      const originalValue =
        row.original_value !== null &&
        typeof row.original_value === "object" &&
        !Array.isArray(row.original_value)
          ? (row.original_value as JsonRecord)
          : {};
      if (
        !source ||
        !publication ||
        !candidate ||
        (row.data_type !== "prediction_ordered" &&
          row.data_type !== "prediction_selection")
      ) {
        return [];
      }
      const film = Array.isArray(candidate.films)
        ? candidate.films[0]
        : candidate.films;
      const people = (candidate.category_candidate_people ?? []).flatMap(
        (link): CategoryCandidatePerson[] => {
          const person = Array.isArray(link.people)
            ? link.people[0]
            : link.people;
          return person
            ? [
                {
                  id: person.id,
                  name: person.name,
                  role: link.role,
                  displayOrder: link.display_order,
                },
              ]
            : [];
        },
      );
      people.sort((left, right) => left.displayOrder - right.displayOrder);

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
          ...(freshnessByCapture.has(String(row.capture_id))
            ? { freshnessAt: freshnessByCapture.get(String(row.capture_id)) }
            : {}),
          seasonId: schedule.seasonId,
          categoryId: schedule.categoryId,
          intention: schedule.intention,
          candidate: {
            id: candidate.id,
            seasonId: candidate.season_id,
            categoryId: candidate.category_id,
            label: candidate.display_label,
            film: film ? { id: film.id, title: film.title } : null,
            workTitle: candidate.work_title,
            people,
          },
          participates: row.participates,
          state: row.state,
          dataType: row.data_type,
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

  private async categoryFreshness(
    pages: { sourceId: string; url: string }[],
    categoryId: string,
  ) {
    if (pages.length === 0) return new Map<string, string>();
    const urls = [...new Set(pages.map((page) => page.url))];
    const sourceIds = [...new Set(pages.map((page) => page.sourceId))];
    const pageKeys = new Set(
      pages.map((page) => JSON.stringify([page.sourceId, page.url])),
    );
    // Include revisions with missing categories or no matched candidates. Their
    // complete captures, saved before observation writes, delimit the sequence.
    const publications = await pagedDatabaseRowsByIds(
      urls,
      (batch, from, to) =>
        this.client
          .from("source_publications")
          .select("id, source_id, canonical_url")
          .in("source_id", sourceIds)
          .in("canonical_url", batch)
          .order("id", { ascending: true })
          .range(from, to),
      "No se pudo cargar el historial de páginas sin fecha",
    );
    const publicationById = new Map(
      publications
        .filter((publication) =>
          pageKeys.has(
            JSON.stringify([publication.source_id, publication.canonical_url]),
          ),
        )
        .map((publication) => [publication.id, publication]),
    );
    const captures = await pagedDatabaseRowsByIds(
      [...publicationById.keys()],
      (batch, from, to) =>
        this.client
          .from("source_publication_captures")
          .select("id, publication_id, original_data, captured_at")
          .in("publication_id", batch)
          .order("id", { ascending: true })
          .range(from, to),
      "No se pudieron cargar las evidencias completas de categorías sin fecha",
    );
    return categoryEvidenceFreshness(
      captures.flatMap((capture): CategoryEvidenceCapture[] => {
        const publication = publicationById.get(capture.publication_id);
        return publication
          ? [
              {
                id: String(capture.id),
                sourceId: publication.source_id,
                publicationUrl: publication.canonical_url,
                capturedAt: capture.captured_at,
                originalData: capture.original_data,
              },
            ]
          : [];
      }),
      categoryId,
    );
  }

  async currentSnapshotV2(schedule: SnapshotSchedule) {
    const pointer = databaseError(
      await this.client
        .from("current_aggregate_snapshots")
        .select("snapshot_id")
        .eq("season_id", schedule.seasonId)
        .eq("category_id", schedule.categoryId)
        .eq("prediction_intention", schedule.intention)
        .eq("kind", schedule.kind)
        .maybeSingle(),
      `No se pudo cargar el corte vigente de ${schedule.id}`,
    ) as { snapshot_id: string } | null;
    if (!pointer) return null;

    const snapshot = databaseError(
      await this.client
        .from("aggregate_snapshots")
        .select("id, content_hash, schema_version, payload")
        .eq("id", pointer.snapshot_id)
        .maybeSingle(),
      `No se pudo cargar el snapshot vigente de ${schedule.id}`,
    ) as {
      id: string;
      content_hash: string;
      schema_version: string;
      payload: unknown;
    } | null;
    if (!snapshot || snapshot.schema_version !== "runscars-snapshot-v2") {
      return null;
    }
    const payload = snapshot.payload as unknown as {
      aggregate?: PredictionAggregateV2;
    };
    if (
      !payload.aggregate ||
      !["runscars-aggregation-v2", "runscars-aggregation-v3"].includes(
        payload.aggregate.methodVersion,
      )
    ) {
      return null;
    }
    return {
      snapshotId: snapshot.id,
      contentHash: snapshot.content_hash,
      aggregate: payload.aggregate,
    };
  }

  async lockV2(snapshot: LockedPredictionSnapshotV2) {
    const includedObservationIds =
      snapshot.payload.includedObservationIds.map(Number);
    const excludedObservationIds =
      snapshot.payload.excludedObservationIds.map(Number);
    if (
      [...includedObservationIds, ...excludedObservationIds].some(
        (id) => !Number.isSafeInteger(id) || id <= 0,
      )
    ) {
      throw new Error("El snapshot v2 contiene IDs no persistidos");
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
      databaseError(
        result,
        `No se pudo bloquear el snapshot v2 ${snapshot.id}`,
      ) ?? false
    );
  }
}
