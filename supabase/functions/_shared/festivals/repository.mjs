import { createClient } from "@supabase/supabase-js";
import { awardsPublicationIncident, prepareFestivalSet } from "./core.mjs";

function databaseError(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

export class SupabaseFestivalRepository {
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
      .from("festival_connectors")
      .select("*")
      .eq("is_active", true)
      .order("id");
    if (selectedIds?.length) query = query.in("id", selectedIds);
    const connectors = databaseError(
      await query,
      "No se pudieron leer los conectores de festivales",
    );
    const editionIds = connectors.map(
      (connector) => connector.configuration.edition_id,
    );
    const editions = editionIds.length
      ? databaseError(
          await this.client
            .from("festival_editions")
            .select("*")
            .in("id", editionIds),
          "No se pudieron leer las ediciones festivaleras",
        )
      : [];
    return connectors.map((connector) => ({
      ...connector,
      edition:
        editions.find(
          (edition) => edition.id === connector.configuration.edition_id,
        ) ?? null,
    }));
  }

  async catalogue() {
    const rows = databaseError(
      await this.client
        .from("films")
        .select("id,title,alternate_titles")
        .order("id"),
      "No se pudo leer el catálogo para matching festivalero",
    );
    return rows.map((film) => ({
      id: film.id,
      title: film.title,
      alternateTitles: film.alternate_titles ?? [],
    }));
  }

  async beginRun(connector, trigger, capturedAt) {
    const bucket = new Date(capturedAt).toISOString().slice(0, 10);
    const baseKey = `${connector.id}:${connector.extractor_version}:${bucket}`;
    const existing = databaseError(
      await this.client
        .from("festival_capture_runs")
        .select("id,status")
        .eq("run_key", baseKey)
        .maybeSingle(),
      "No se pudo resolver la ejecución festivalera",
    );
    if (existing && existing.status !== "failed") {
      return { ...existing, repeated: true };
    }
    const runKey = existing
      ? `${baseKey}:retry:${new Date(capturedAt).toISOString().replaceAll(/\D/g, "")}`
      : baseKey;
    const run = databaseError(
      await this.client
        .from("festival_capture_runs")
        .insert({
          connector_id: connector.id,
          run_key: runKey,
          trigger,
          started_at: capturedAt,
        })
        .select("id,status")
        .single(),
      "No se pudo iniciar la ejecución festivalera",
    );
    return { ...run, repeated: false };
  }

  async persistPreparedSet(prepared, actor = "automatic-exact-title") {
    return databaseError(
      await this.client.rpc("persist_festival_set", {
        payload: prepared,
        matching_actor: actor,
      }),
      "No se pudo persistir el conjunto festivalero",
    );
  }

  async matchEntry(entryId, filmId, reason, actor = "cli:festivals-match") {
    return databaseError(
      await this.client.rpc("match_festival_entry", {
        target_entry_id: entryId,
        target_film_id: filmId,
        correction_reason: reason,
        correction_actor: actor,
      }),
      "No se pudo corregir el matching festivalero",
    );
  }

  async finishRun(runId, result) {
    databaseError(
      await this.client
        .from("festival_capture_runs")
        .update({
          status: result.status,
          finished_at: result.finishedAt,
          editions_seen: result.editionsSeen,
          sets_inserted: result.setsInserted,
          sets_duplicate: result.setsDuplicate,
          review_items_created: result.reviewItemsCreated,
          error_summary: result.errorSummary ?? null,
          details: result.details ?? {},
        })
        .eq("id", runId),
      "No se pudo cerrar la ejecución festivalera",
    );
  }

  async markConnector(connectorId, at, error = null) {
    databaseError(
      await this.client
        .from("festival_connectors")
        .update(
          error
            ? { last_failure_at: at, last_error: error }
            : { last_success_at: at, last_error: null },
        )
        .eq("id", connectorId),
      "No se pudo actualizar el conector festivalero",
    );
  }
}

export async function importFestivalManifests({
  manifests,
  repository,
  actor = "manual-import",
}) {
  const catalogue = await repository.catalogue();
  const results = [];
  for (const manifest of manifests) {
    const prepared = await prepareFestivalSet(manifest, catalogue);
    const persisted = await repository.persistPreparedSet(prepared, actor);
    results.push({
      ...persisted,
      editionId: prepared.editionId,
      kind: prepared.kind,
    });
  }
  return results;
}

export async function runFestivalConnectors({
  connectors,
  registry,
  repository,
  trigger = "scheduled",
  fetcher = fetch,
  now = () => new Date(),
}) {
  const catalogue = await repository.catalogue();
  return Promise.all(
    connectors.map(async (connector) => {
      const capturedAt = now().toISOString();
      const run = await repository.beginRun(connector, trigger, capturedAt);
      if (run.repeated) {
        return {
          connectorId: connector.id,
          status: "unchanged",
          runId: run.id,
        };
      }
      try {
        const adapter = registry[connector.id];
        if (!adapter)
          throw new Error(`Conector no implementado: ${connector.id}`);
        const manifests = await adapter({ connector, capturedAt, fetcher });
        if (!manifests.length) {
          throw new Error(
            "No se reconocieron selecciones ni premios oficiales; se conserva el último conjunto verificado",
          );
        }
        const persisted = [];
        const preparedSets = [];
        for (const manifest of manifests) {
          const prepared = await prepareFestivalSet(manifest, catalogue);
          preparedSets.push(prepared);
          persisted.push(await repository.persistPreparedSet(prepared));
        }
        if (
          awardsPublicationIncident(connector.edition, now()) &&
          !manifests.some((manifest) => manifest.kind === "awards")
        ) {
          throw new Error(
            "El palmarés sigue ausente más de 24 horas después del cierre",
          );
        }
        const finishedAt = now().toISOString();
        const reviewItemsCreated = preparedSets.reduce(
          (count, prepared) =>
            count +
            prepared.entries.filter((entry) => entry.status !== "matched")
              .length,
          0,
        );
        await repository.finishRun(run.id, {
          status: "succeeded",
          finishedAt,
          editionsSeen: 1,
          setsInserted: persisted.filter((item) => item.status === "inserted")
            .length,
          setsDuplicate: persisted.filter((item) => item.status === "duplicate")
            .length,
          reviewItemsCreated,
          details: { sets: persisted },
        });
        await repository.markConnector(connector.id, finishedAt);
        return {
          connectorId: connector.id,
          status: "succeeded",
          runId: run.id,
          sets: persisted,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error desconocido";
        const finishedAt = now().toISOString();
        await repository.finishRun(run.id, {
          status: "failed",
          finishedAt,
          editionsSeen: 1,
          setsInserted: 0,
          setsDuplicate: 0,
          reviewItemsCreated: 0,
          errorSummary: message,
        });
        await repository.markConnector(connector.id, finishedAt, message);
        return {
          connectorId: connector.id,
          status: "failed",
          runId: run.id,
          error: message,
        };
      }
    }),
  );
}
