import { createClient } from "@supabase/supabase-js";
import { prepareBatch } from "./core.mjs";

function databaseError(result, action) {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message}`);
  }
  return result.data;
}

export class SupabaseIngestionRepository {
  constructor({ supabaseUrl, serviceRoleKey }) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    }
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async activeConnectors(selectedIds = null) {
    let query = this.client
      .from("source_connectors")
      .select("*")
      .eq("is_active", true)
      .order("id");
    if (selectedIds?.length) query = query.in("id", selectedIds);
    return databaseError(await query, "No se pudieron leer los conectores");
  }

  async filmIdentities(seasonId) {
    const links = databaseError(
      await this.client
        .from("season_films")
        .select("films(id,title,alternate_titles)")
        .eq("season_id", seasonId),
      "No se pudo cargar el catálogo de matching",
    );
    return links.map((link) => link.films).filter(Boolean);
  }

  async beginRun({ connectorId, trigger, startedAt, runKey }) {
    const data = databaseError(
      await this.client
        .from("ingestion_runs")
        .insert({
          connector_id: connectorId,
          trigger,
          started_at: startedAt,
          run_key: runKey,
        })
        .select("id")
        .single(),
      "No se pudo iniciar la ejecución",
    );
    return data.id;
  }

  async addEvent(runId, level, code, message, context = {}) {
    databaseError(
      await this.client.from("ingestion_run_events").insert({
        run_id: runId,
        level,
        code,
        message,
        context,
      }),
      "No se pudo guardar el evento",
    );
  }

  async savePublication(batch, publication) {
    const data = databaseError(
      await this.client
        .from("source_publications")
        .upsert(
          {
            source_id: batch.sourceId,
            external_id: publication.externalId,
            canonical_url: publication.canonicalUrl,
            title: publication.title,
            author: publication.author,
            published_at: publication.publishedAt,
          },
          { onConflict: "source_id,external_id" },
        )
        .select("id")
        .single(),
      "No se pudo guardar la publicación",
    );
    return data.id;
  }

  async saveCapture(batch, publicationId, publication) {
    const data = databaseError(
      await this.client
        .from("source_publication_captures")
        .upsert(
          {
            publication_id: publicationId,
            content_hash: publication.contentHash,
            source_url: publication.canonicalUrl,
            original_data: publication.originalData,
            captured_at: batch.capturedAt,
            extractor_version: batch.extractorVersion,
          },
          {
            onConflict: "publication_id,content_hash",
            ignoreDuplicates: true,
          },
        )
        .select("id"),
      "No se pudo guardar la captura",
    );
    if (data.length) return data[0].id;
    const existing = databaseError(
      await this.client
        .from("source_publication_captures")
        .select("id")
        .eq("publication_id", publicationId)
        .eq("content_hash", publication.contentHash)
        .single(),
      "No se pudo recuperar la captura existente",
    );
    return existing.id;
  }

  async saveObservation({
    batch,
    publication,
    publicationId,
    captureId,
    runId,
    observation,
  }) {
    const data = databaseError(
      await this.client
        .from("professional_observations")
        .upsert(
          {
            dedupe_key: observation.dedupeKey,
            source_id: batch.sourceId,
            publication_id: publicationId,
            capture_id: captureId,
            run_id: runId,
            season_id: batch.seasonId,
            film_id: observation.filmId,
            person_id: observation.personId,
            category_id: observation.categoryId,
            data_type: observation.dataType,
            prediction_intention: observation.predictionIntention,
            original_subject: observation.subject,
            original_value: observation.originalValue,
            original_scale: observation.originalScale,
            source_url: publication.canonicalUrl,
            author: publication.author,
            published_at: publication.publishedAt,
            captured_at: batch.capturedAt,
            extractor_version: batch.extractorVersion,
            participates: observation.participates,
            state: observation.state,
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true },
        )
        .select("id"),
      "No se pudo guardar la observación",
    );
    if (data.length) return { id: data[0].id, inserted: true };
    const existing = databaseError(
      await this.client
        .from("professional_observations")
        .select("id")
        .eq("dedupe_key", observation.dedupeKey)
        .single(),
      "No se pudo recuperar la observación existente",
    );
    return { id: existing.id, inserted: false };
  }

  async saveReviewItem({ connectorId, runId, observationId, observation }) {
    const data = databaseError(
      await this.client
        .from("ingestion_review_items")
        .upsert(
          {
            queue_key: observation.review.queueKey,
            run_id: runId,
            connector_id: connectorId,
            observation_id: observationId,
            kind: observation.review.kind,
            subject_label: observation.review.subjectLabel,
            candidate_film_ids: observation.review.candidateFilmIds,
            context: {
              observation_dedupe_key: observation.dedupeKey,
            },
          },
          { onConflict: "queue_key", ignoreDuplicates: true },
        )
        .select("id"),
      "No se pudo guardar la revisión",
    );
    return data.length > 0;
  }

  async finishRun(runId, result) {
    databaseError(
      await this.client
        .from("ingestion_runs")
        .update({
          status: result.status,
          finished_at: result.finishedAt,
          publications_seen: result.publicationsSeen,
          observations_seen: result.observationsSeen,
          observations_inserted: result.observationsInserted,
          observations_duplicate: result.observationsDuplicate,
          review_items_created: result.reviewItemsCreated,
          error_summary: result.errorSummary ?? null,
        })
        .eq("id", runId),
      "No se pudo cerrar la ejecución",
    );
  }

  async markConnector(connectorId, succeededAt, errorSummary = null) {
    const values = errorSummary
      ? { last_failure_at: succeededAt, last_error: errorSummary }
      : { last_success_at: succeededAt, last_error: null };
    databaseError(
      await this.client
        .from("source_connectors")
        .update(values)
        .eq("id", connectorId),
      "No se pudo actualizar el estado del conector",
    );
  }
}

export async function persistBatch({ batch, repository, runId }) {
  const counters = {
    publicationsSeen: batch.publications.length,
    observationsSeen: 0,
    observationsInserted: 0,
    observationsDuplicate: 0,
    reviewItemsCreated: 0,
  };

  try {
    const films = await repository.filmIdentities(batch.seasonId);
    const prepared = await prepareBatch(batch, films);

    for (const publication of prepared.publications) {
      const publicationId = await repository.savePublication(
        prepared,
        publication,
      );
      const captureId = await repository.saveCapture(
        prepared,
        publicationId,
        publication,
      );

      for (const observation of publication.observations) {
        counters.observationsSeen += 1;
        const saved = await repository.saveObservation({
          batch: prepared,
          publication,
          publicationId,
          captureId,
          runId,
          observation,
        });
        if (saved.inserted) counters.observationsInserted += 1;
        else counters.observationsDuplicate += 1;

        if (observation.review) {
          const created = await repository.saveReviewItem({
            connectorId: prepared.connectorId,
            runId,
            observationId: saved.id,
            observation,
          });
          if (created) counters.reviewItemsCreated += 1;
        }
      }
    }

    const finishedAt = new Date().toISOString();
    await repository.addEvent(
      runId,
      "info",
      "connector.completed",
      "Importación completada",
      counters,
    );
    await repository.finishRun(runId, {
      ...counters,
      status: "succeeded",
      finishedAt,
    });
    await repository.markConnector(batch.connectorId, finishedAt);
    return {
      connectorId: batch.connectorId,
      runId,
      status: "succeeded",
      ...counters,
    };
  } catch (error) {
    if (error && typeof error === "object") {
      error.ingestionCounters = counters;
    }
    throw error;
  }
}

export async function runConnectorSet({
  connectors,
  registry,
  repository,
  trigger,
  fetcher = fetch,
  secrets = {},
  now = () => new Date(),
}) {
  const results = [];

  for (const connector of connectors) {
    const capturedAt = now().toISOString();
    const runKey = `${connector.id}:${trigger}:${capturedAt}`;
    let runId = null;
    try {
      runId = await repository.beginRun({
        connectorId: connector.id,
        trigger,
        startedAt: capturedAt,
        runKey,
      });
      const adapter = registry[connector.id];
      if (!adapter)
        throw new Error(`Conector no implementado: ${connector.id}`);
      const batch = await adapter({
        connector,
        capturedAt,
        fetcher,
        secrets,
      });
      results.push(await persistBatch({ batch, repository, runId }));
    } catch (error) {
      const errorSummary =
        error instanceof Error ? error.message : "Error desconocido";
      const counters = error?.ingestionCounters ?? {
        publicationsSeen: 0,
        observationsSeen: 0,
        observationsInserted: 0,
        observationsDuplicate: 0,
        reviewItemsCreated: 0,
      };
      const finishedAt = new Date().toISOString();
      if (runId !== null) {
        await repository.addEvent(
          runId,
          "error",
          "connector.failed",
          errorSummary,
        );
        await repository.finishRun(runId, {
          ...counters,
          status: "failed",
          finishedAt,
          errorSummary,
        });
        await repository.markConnector(connector.id, finishedAt, errorSummary);
      }
      results.push({
        connectorId: connector.id,
        runId,
        status: "failed",
        error: errorSummary,
      });
    }
  }

  return results;
}
