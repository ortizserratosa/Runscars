"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { aggregatePredictionsV2 } from "../../lib/aggregation/v2";
import { requireEditorialAdmin } from "../../lib/admin/auth";
import { sha256 } from "../../lib/snapshots";
import {
  createPredictionSnapshotPayloadV2,
  createOfficialResultsPayloadV2,
  lockPredictionSnapshotV2,
} from "../../lib/snapshots/v2";
import {
  runScheduledSnapshotsV2,
  type SnapshotSchedule,
} from "../../lib/snapshots/scheduler-core";
import { SupabaseSnapshotSchedulerRepository } from "../../lib/snapshots/scheduler";
import { SupabaseOfficialResultsRepository } from "../../lib/snapshots/official-results.mjs";
import {
  importCatalogMatch,
  SupabaseCatalogRepository,
  TmdbClient,
} from "../../lib/tmdb/catalog.mjs";
import { parseManualManifest } from "../../../../supabase/functions/_shared/ingestion/core.mjs";
import {
  persistBatch,
  SupabaseIngestionRepository,
} from "../../../../supabase/functions/_shared/ingestion/repository.mjs";

const identifier = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const positiveInteger = z.coerce.number().int().positive();
const reason = z.string().trim().min(4).max(500);
const operationKey = () => `admin-${crypto.randomUUID()}`;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error editorial inesperado";
}

function finish(tone: "ok" | "error", message: string): never {
  revalidatePath("/admin");
  redirect(`/admin?${tone}=${encodeURIComponent(message.slice(0, 240))}`);
}

async function recordAction(
  client: SupabaseClient,
  userId: string,
  input: {
    actionType: string;
    entityType: string;
    entityId: string;
    reason: string;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
  },
) {
  const { error } = await client.rpc("record_editorial_action", {
    requested_user_id: userId,
    requested_operation_key: operationKey(),
    requested_action_type: input.actionType,
    requested_entity_type: input.entityType,
    requested_entity_id: input.entityId,
    requested_reason: input.reason,
    requested_before_state: input.beforeState ?? null,
    requested_after_state: input.afterState ?? null,
  });
  if (error)
    throw new Error(`No se pudo auditar la operación: ${error.message}`);
}

export async function matchObservationAction(formData: FormData) {
  const parsed = z
    .object({
      observationId: positiveInteger,
      candidateId: identifier,
      matchKind: z.enum(["film", "person", "team", "category"]),
      reason,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    finish("error", "Revisa observación, candidatura, tipo y motivo.");

  try {
    const { admin, user } = await requireEditorialAdmin();
    const client = admin as unknown as SupabaseClient;
    const { error } = await client.rpc("editorial_match_observation", {
      requested_user_id: user.id,
      requested_operation_key: operationKey(),
      requested_observation_id: parsed.data.observationId,
      requested_candidate_id: parsed.data.candidateId,
      requested_match_kind: parsed.data.matchKind,
      requested_reason: parsed.data.reason,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    finish("error", errorMessage(error));
  }
  finish("ok", "Observación vinculada y revisión resuelta.");
}

export async function matchObservationToFilmAction(formData: FormData) {
  const parsed = z
    .object({ observationId: positiveInteger, filmId: identifier, reason })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    finish("error", "Revisa la observación, la película y el motivo.");
  }

  try {
    const { admin, user } = await requireEditorialAdmin();
    const client = admin as unknown as SupabaseClient;
    const { error } = await client.rpc("editorial_match_observation_to_film", {
      requested_user_id: user.id,
      requested_operation_key: operationKey(),
      requested_observation_id: parsed.data.observationId,
      requested_film_id: parsed.data.filmId,
      requested_reason: parsed.data.reason,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    finish("error", errorMessage(error));
  }
  finish("ok", "Observación vinculada a la película y revisión resuelta.");
}

export async function excludeObservationAction(formData: FormData) {
  const parsed = z
    .object({ observationId: positiveInteger, reason })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) finish("error", "Revisa la observación y el motivo.");

  try {
    const { admin, user } = await requireEditorialAdmin();
    const client = admin as unknown as SupabaseClient;
    const { error } = await client.rpc("editorial_exclude_observation", {
      requested_user_id: user.id,
      requested_operation_key: operationKey(),
      requested_observation_id: parsed.data.observationId,
      requested_reason: parsed.data.reason,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    finish("error", errorMessage(error));
  }
  finish("ok", "Observación excluida sin alterar su valor original.");
}

export async function dismissReviewAction(formData: FormData) {
  const parsed = z
    .object({ reviewId: positiveInteger, reason })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) finish("error", "Revisa el elemento y el motivo.");

  try {
    const { admin, user } = await requireEditorialAdmin();
    const client = admin as unknown as SupabaseClient;
    const { error } = await client.rpc("editorial_dismiss_review", {
      requested_user_id: user.id,
      requested_operation_key: operationKey(),
      requested_review_id: parsed.data.reviewId,
      requested_reason: parsed.data.reason,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    finish("error", errorMessage(error));
  }
  finish("ok", "Revisión descartada con motivo registrado.");
}

export async function correctTmdbMatchAction(formData: FormData) {
  const parsed = z
    .object({
      filmId: identifier,
      tmdbId: positiveInteger,
      query: z.string().trim().min(1).max(200),
      reason,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    finish("error", "Revisa la película, el ID de TMDB y el motivo.");
  }

  try {
    const { admin, user } = await requireEditorialAdmin();
    const result = await importCatalogMatch({
      match: {
        filmId: parsed.data.filmId,
        tmdbId: parsed.data.tmdbId,
        query: parsed.data.query,
        method: "correction",
        reason: parsed.data.reason,
        evidenceUrl: `https://www.themoviedb.org/movie/${parsed.data.tmdbId}`,
      },
      locale: "es-ES",
      client: new TmdbClient({ token: process.env.TMDB_READ_ACCESS_TOKEN }),
      repository: new SupabaseCatalogRepository({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      }),
      actor: `admin:${user.id}`,
    });
    await recordAction(admin as unknown as SupabaseClient, user.id, {
      actionType: "tmdb.match-correction",
      entityType: "film",
      entityId: parsed.data.filmId,
      reason: parsed.data.reason,
      afterState: result as Record<string, unknown>,
    });
  } catch (error) {
    finish("error", errorMessage(error));
  }
  finish(
    "ok",
    "Match de TMDB corregido, catálogo actualizado y acción auditada.",
  );
}

export async function updateSourceAction(formData: FormData) {
  const parsed = z
    .object({
      sourceId: identifier,
      editorialStatus: z.enum([
        "candidate",
        "sampled",
        "selected",
        "paused",
        "rejected",
      ]),
      technicalStatus: z.enum([
        "manual",
        "prototype",
        "automated",
        "failing",
        "retired",
      ]),
      publicationStatus: z.enum([
        "not-reviewed",
        "review-before-publish",
        "publishable",
        "replace-before-publish",
      ]),
      notes: z.string().trim().max(2000),
      reason,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    finish("error", "Revisa los estados y el motivo de la fuente.");

  try {
    const { admin, user } = await requireEditorialAdmin();
    const client = admin as unknown as SupabaseClient;
    const { error } = await client.rpc("editorial_update_source", {
      requested_user_id: user.id,
      requested_operation_key: operationKey(),
      requested_source_id: parsed.data.sourceId,
      requested_editorial_status: parsed.data.editorialStatus,
      requested_technical_status: parsed.data.technicalStatus,
      requested_publication_status: parsed.data.publicationStatus,
      requested_notes: parsed.data.notes,
      requested_reason: parsed.data.reason,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    finish("error", errorMessage(error));
  }
  finish("ok", "Fuente actualizada y auditada.");
}

export async function updateConnectorAction(formData: FormData) {
  const parsed = z
    .object({
      connectorId: identifier,
      active: z.enum(["true", "false"]),
      reason,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) finish("error", "Revisa el conector y el motivo.");

  try {
    const { admin, user } = await requireEditorialAdmin();
    const client = admin as unknown as SupabaseClient;
    const { error } = await client.rpc("editorial_update_connector", {
      requested_user_id: user.id,
      requested_operation_key: operationKey(),
      requested_connector_id: parsed.data.connectorId,
      requested_is_active: parsed.data.active === "true",
      requested_reason: parsed.data.reason,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    finish("error", errorMessage(error));
  }
  finish("ok", "Conector actualizado y auditado.");
}

export async function runIngestionAction(formData: FormData) {
  const parsed = z
    .object({ connectorId: z.union([identifier, z.literal("all")]), reason })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) finish("error", "Revisa el conector y el motivo.");

  try {
    const { admin, user } = await requireEditorialAdmin();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.INGESTION_CRON_SECRET;
    if (!url || !secret || secret.startsWith("replace-with-")) {
      throw new Error(
        "La ejecución remota no está configurada en este entorno.",
      );
    }
    const response = await fetch(`${url}/functions/v1/run-ingestion`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-runscars-cron-secret": secret,
      },
      body: JSON.stringify({
        trigger: "manual",
        ...(parsed.data.connectorId === "all"
          ? {}
          : { connectors: [parsed.data.connectorId] }),
      }),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok)
      throw new Error("La función de ingesta rechazó la ejecución.");
    await recordAction(admin as unknown as SupabaseClient, user.id, {
      actionType: "ingestion.run",
      entityType: "source_connector",
      entityId: parsed.data.connectorId,
      reason: parsed.data.reason,
      afterState: body,
    });
  } catch (error) {
    finish("error", errorMessage(error));
  }
  finish("ok", "Ejecución de ingesta completada.");
}

export async function importManualManifestAction(formData: FormData) {
  const parsed = z
    .object({ manifest: z.string().trim().min(2).max(1_000_000), reason })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    finish("error", "El manifiesto o el motivo no son válidos.");

  try {
    const { admin, user } = await requireEditorialAdmin();
    const capturedAt = new Date().toISOString();
    const manifest = JSON.parse(parsed.data.manifest) as unknown;
    const batch = parseManualManifest(manifest, { capturedAt });
    const repository = new SupabaseIngestionRepository({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    const runId = await repository.beginRun({
      connectorId: batch.connectorId,
      trigger: "manual",
      startedAt: capturedAt,
      runKey: `manual-editorial:admin:${user.id}:${capturedAt}`,
    });
    let result;
    try {
      result = await persistBatch({ batch, repository, runId });
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const summary = errorMessage(error);
      const counters =
        error && typeof error === "object" && "ingestionCounters" in error
          ? (error.ingestionCounters as Record<string, number>)
          : {
              publicationsSeen: 0,
              observationsSeen: 0,
              observationsInserted: 0,
              observationsDuplicate: 0,
              reviewItemsCreated: 0,
            };
      await repository.addEvent(runId, "error", "manual.failed", summary);
      await repository.finishRun(runId, {
        ...counters,
        status: "failed",
        finishedAt,
        errorSummary: summary,
      });
      throw error;
    }
    await recordAction(admin as unknown as SupabaseClient, user.id, {
      actionType: "ingestion.manual",
      entityType: "ingestion_run",
      entityId: String(runId),
      reason: parsed.data.reason,
      afterState: result as Record<string, unknown>,
    });
  } catch (error) {
    finish("error", errorMessage(error));
  }
  finish("ok", "Manifiesto importado de forma idempotente.");
}

export async function runPeriodicSnapshotsAction(formData: FormData) {
  const parsed = z.object({ reason }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) finish("error", "Indica el motivo de la ejecución.");

  try {
    const { admin, user } = await requireEditorialAdmin();
    const repository = new SupabaseSnapshotSchedulerRepository();
    const result = await runScheduledSnapshotsV2(repository, new Date());
    if (result.some((item) => item.status === "failed")) {
      throw new Error(
        "Uno o más snapshots fallaron; revisa el historial de ejecución.",
      );
    }
    await recordAction(admin as unknown as SupabaseClient, user.id, {
      actionType: "snapshot.periodic-run",
      entityType: "snapshot_schedule",
      entityId: "active",
      reason: parsed.data.reason,
      afterState: { results: result },
    });
  } catch (error) {
    finish("error", errorMessage(error));
  }
  finish("ok", "Snapshots periódicos procesados.");
}

export async function createFinalSnapshotAction(formData: FormData) {
  const parsed = z
    .object({
      seasonId: identifier,
      categoryId: identifier,
      intention: z.enum(["nomination", "winner"]),
      kind: z.enum(["nomination_final", "winner_final"]),
      selectionSize: positiveInteger,
      correctsSnapshotId: z.string().trim().max(180),
      reason,
    })
    .refine(
      (value) =>
        (value.intention === "nomination" &&
          value.kind === "nomination_final") ||
        (value.intention === "winner" && value.kind === "winner_final"),
      { message: "Intención y tipo de cierre no coinciden" },
    )
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    finish("error", "Revisa el alcance y la selección del cierre.");

  try {
    const { admin, user } = await requireEditorialAdmin();
    const repository = new SupabaseSnapshotSchedulerRepository();
    const schedule: SnapshotSchedule = {
      id: `admin-${parsed.data.seasonId}-${parsed.data.categoryId}-${parsed.data.kind}`,
      seasonId: parsed.data.seasonId,
      categoryId: parsed.data.categoryId,
      intention: parsed.data.intention,
      kind: parsed.data.kind,
      timeZone: "Europe/Madrid",
    };
    const now = new Date().toISOString();
    const observations = await repository.predictionObservationsV2(schedule);
    const aggregate = aggregatePredictionsV2(observations, {
      seasonId: schedule.seasonId,
      categoryId: schedule.categoryId,
      intention: schedule.intention,
      cutoffDate: now,
    });
    const payload = createPredictionSnapshotPayloadV2(aggregate, {
      kind: parsed.data.kind,
      cutoffAt: now,
      timeZone: schedule.timeZone,
      selectionSize:
        parsed.data.kind === "winner_final" ? 1 : parsed.data.selectionSize,
    });
    const snapshot = await lockPredictionSnapshotV2(payload, {
      lockedAt: now,
      lockedBy: `admin:${user.id}`,
      correctsSnapshotId: parsed.data.correctsSnapshotId || null,
      correctionReason: parsed.data.correctsSnapshotId
        ? parsed.data.reason
        : null,
    });
    const created = await repository.lockV2(snapshot);
    await recordAction(admin as unknown as SupabaseClient, user.id, {
      actionType: "snapshot.final-lock",
      entityType: "aggregate_snapshot",
      entityId: snapshot.id,
      reason: parsed.data.reason,
      afterState: {
        created,
        kind: snapshot.payload.kind,
        selectedCandidateIds: snapshot.payload.selectedCandidateIds,
      },
    });
  } catch (error) {
    finish("error", errorMessage(error));
  }
  finish("ok", "Cierre final bloqueado y publicado.");
}

const officialManifestSchema = z.object({
  formatVersion: z.literal(2),
  seasonId: identifier,
  kind: z.enum(["nominations", "winners"]),
  source: z.object({
    sourceId: identifier,
    sourceUrl: z.url().refine((url) => url.startsWith("https://")),
    author: z.string().trim().min(1).max(160).nullable().optional(),
    publishedAt: z.iso.datetime(),
  }),
  entries: z
    .array(
      z.object({
        categoryId: identifier,
        categoryCandidateId: identifier,
        outcome: z.enum(["nominee", "winner"]),
      }),
    )
    .min(1)
    .max(500),
  originalData: z.record(z.string(), z.unknown()).optional(),
  correctsResultSetId: z.string().trim().min(1).max(180).nullable().optional(),
  correctionReason: z.string().trim().min(4).max(500).nullable().optional(),
});

export async function importOfficialResultsAction(formData: FormData) {
  const parsedForm = z
    .object({ manifest: z.string().trim().min(2).max(1_000_000), reason })
    .safeParse(Object.fromEntries(formData));
  if (!parsedForm.success)
    finish("error", "El manifiesto o el motivo no son válidos.");

  try {
    const { admin, user } = await requireEditorialAdmin();
    const manifest = officialManifestSchema.parse(
      JSON.parse(parsedForm.data.manifest),
    );
    const capturedAt = new Date().toISOString();
    const payload = createOfficialResultsPayloadV2({
      seasonId: manifest.seasonId,
      kind: manifest.kind,
      source: {
        ...manifest.source,
        author: manifest.source.author ?? null,
        capturedAt,
      },
      entries: manifest.entries.map((entry) => ({
        categoryId: entry.categoryId,
        candidateId: entry.categoryCandidateId,
        categoryCandidateId: entry.categoryCandidateId,
        outcome: entry.outcome,
      })),
      originalData: manifest.originalData ?? {
        manuallyEntered: true,
        canonicalSourceUrl: manifest.source.sourceUrl,
      },
    });
    const contentHash = await sha256(payload);
    const resultSet = {
      id: [
        payload.kind,
        payload.seasonId,
        payload.source.publishedAt.slice(0, 10),
        contentHash.slice(0, 12),
      ].join("-"),
      contentHash,
      lockedAt: capturedAt,
      lockedBy: `admin:${user.id}`,
      correctsResultSetId: manifest.correctsResultSetId ?? null,
      correctionReason: manifest.correctsResultSetId
        ? (manifest.correctionReason ?? parsedForm.data.reason)
        : null,
      payload,
    };
    const repository = new SupabaseOfficialResultsRepository({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    const created = await repository.lock(resultSet);
    await recordAction(admin as unknown as SupabaseClient, user.id, {
      actionType: "official-results.lock",
      entityType: "official_result_set",
      entityId: resultSet.id,
      reason: parsedForm.data.reason,
      afterState: {
        created,
        kind: payload.kind,
        entries: payload.entries.length,
      },
    });
  } catch (error) {
    finish("error", errorMessage(error));
  }
  finish("ok", "Resultados oficiales bloqueados y publicados.");
}
