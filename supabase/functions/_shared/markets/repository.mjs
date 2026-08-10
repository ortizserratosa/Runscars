import { createClient } from "@supabase/supabase-js";
import { prepareMarketContracts } from "./core.mjs";

function databaseError(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

export class SupabaseMarketRepository {
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
      .from("market_connectors")
      .select("*")
      .eq("is_active", true)
      .order("id");
    if (selectedIds?.length) query = query.in("id", selectedIds);
    return databaseError(await query, "No se pudieron leer los mercados");
  }

  async candidates(seasonId) {
    const rows =
      databaseError(
        await this.client
          .from("category_candidates")
          .select(
            "id, category_id, display_label, films(title), category_candidate_people(people(name))",
          )
          .eq("season_id", seasonId),
        "No se pudieron leer las candidaturas",
      ) ?? [];
    return rows.map((row) => {
      const film = Array.isArray(row.films) ? row.films[0] : row.films;
      return {
        id: row.id,
        categoryId: row.category_id,
        label: row.display_label,
        filmTitle: film?.title ?? null,
        peopleNames: (row.category_candidate_people ?? []).flatMap((link) => {
          const person = Array.isArray(link.people)
            ? link.people[0]
            : link.people;
          return person?.name ? [person.name] : [];
        }),
      };
    });
  }

  async beginRun(connectorId, extractorVersion, capturedAt) {
    const hourlyBucket = new Date(capturedAt).toISOString().slice(0, 13);
    const baseRunKey = `${connectorId}:${extractorVersion}:${hourlyBucket}`;
    const existing = await this.client
      .from("market_capture_runs")
      .select("id,status")
      .eq("run_key", baseRunKey)
      .maybeSingle();
    if (existing.error) {
      throw new Error(
        `No se pudo buscar la ejecución: ${existing.error.message}`,
      );
    }
    if (existing.data && existing.data.status !== "failed") {
      return { ...existing.data, repeated: true };
    }
    const runKey = existing.data
      ? `${baseRunKey}:retry:${new Date(capturedAt)
          .toISOString()
          .slice(14)
          .replaceAll(/[^0-9]/g, "")}`
      : baseRunKey;
    const data = databaseError(
      await this.client
        .from("market_capture_runs")
        .insert({
          connector_id: connectorId,
          run_key: runKey,
          started_at: capturedAt,
        })
        .select("id,status")
        .single(),
      "No se pudo iniciar la captura de mercados",
    );
    return { ...data, repeated: false };
  }

  async saveContract(contract, runId) {
    const inserted =
      databaseError(
        await this.client
          .from("market_contracts")
          .upsert(
            {
              provider: contract.provider,
              source_id: contract.sourceId,
              external_market_id: contract.externalMarketId,
              external_contract_id: contract.externalContractId,
              season_id: contract.seasonId,
              category_id: contract.categoryId,
              category_candidate_id: contract.categoryCandidateId,
              market_title: contract.marketTitle,
              outcome_label: contract.outcomeLabel,
              source_url: contract.sourceUrl,
              closes_at: contract.closesAt,
              resolved_at: contract.resolvedAt,
              original_data: contract.contractOriginalData,
              captured_at: contract.capturedAt,
            },
            {
              onConflict: "provider,external_market_id,external_contract_id",
              ignoreDuplicates: true,
            },
          )
          .select("id"),
        "No se pudo guardar el contrato",
      ) ?? [];
    let contractId = inserted[0]?.id;
    if (!contractId) {
      contractId = databaseError(
        await this.client
          .from("market_contracts")
          .select("id")
          .eq("provider", contract.provider)
          .eq("external_market_id", contract.externalMarketId)
          .eq("external_contract_id", contract.externalContractId)
          .single(),
        "No se pudo recuperar el contrato",
      ).id;
    }
    const snapshot =
      databaseError(
        await this.client
          .from("market_price_snapshots")
          .upsert(
            {
              contract_id: contractId,
              run_id: runId,
              content_hash: contract.contentHash,
              probability: contract.probability,
              original_price: contract.originalPrice,
              original_currency: contract.originalCurrency,
              volume: contract.volume,
              open_interest: contract.openInterest,
              observed_at: contract.observedAt,
              captured_at: contract.capturedAt,
              original_data: contract.priceOriginalData,
            },
            { onConflict: "contract_id,content_hash", ignoreDuplicates: true },
          )
          .select("id"),
        "No se pudo guardar el precio",
      ) ?? [];
    return snapshot.length > 0;
  }

  async finishRun(runId, values) {
    databaseError(
      await this.client
        .from("market_capture_runs")
        .update({
          status: values.status,
          finished_at: values.finishedAt,
          contracts_seen: values.contractsSeen,
          snapshots_inserted: values.snapshotsInserted,
          snapshots_duplicate: values.snapshotsDuplicate,
          error_summary: values.errorSummary ?? null,
        })
        .eq("id", runId),
      "No se pudo cerrar la captura",
    );
  }

  async markConnector(connectorId, at, error = null) {
    databaseError(
      await this.client
        .from("market_connectors")
        .update(
          error
            ? { last_failure_at: at, last_error: error }
            : { last_success_at: at, last_error: null },
        )
        .eq("id", connectorId),
      "No se pudo actualizar el conector",
    );
  }
}

export async function runMarketConnectors({
  connectors,
  registry,
  repository,
  fetcher = fetch,
  now = () => new Date(),
}) {
  const results = [];
  for (const connector of connectors) {
    const capturedAt = now().toISOString();
    const run = await repository.beginRun(
      connector.id,
      connector.extractor_version,
      capturedAt,
    );
    if (run.repeated && run.status !== "running") {
      results.push({
        connectorId: connector.id,
        status: "unchanged",
        runId: run.id,
      });
      continue;
    }
    let contractsSeen = 0;
    let snapshotsInserted = 0;
    try {
      const adapter = registry[connector.id];
      if (!adapter) {
        throw new Error(`Conector no implementado: ${connector.id}`);
      }
      const contracts = await adapter({ connector, capturedAt, fetcher });
      contractsSeen = contracts.length;
      const candidates = await repository.candidates(
        connector.configuration.season_id,
      );
      const prepared = await prepareMarketContracts(contracts, candidates);
      for (const contract of prepared) {
        if (await repository.saveContract(contract, run.id)) {
          snapshotsInserted += 1;
        }
      }
      const finishedAt = new Date().toISOString();
      await repository.finishRun(run.id, {
        status: "succeeded",
        finishedAt,
        contractsSeen,
        snapshotsInserted,
        snapshotsDuplicate: contractsSeen - snapshotsInserted,
      });
      await repository.markConnector(connector.id, finishedAt);
      results.push({
        connectorId: connector.id,
        status: "succeeded",
        runId: run.id,
        contractsSeen,
        snapshotsInserted,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      const finishedAt = new Date().toISOString();
      await repository.finishRun(run.id, {
        status: "failed",
        finishedAt,
        contractsSeen,
        snapshotsInserted,
        snapshotsDuplicate: contractsSeen - snapshotsInserted,
        errorSummary: message,
      });
      await repository.markConnector(connector.id, finishedAt, message);
      results.push({
        connectorId: connector.id,
        status: "failed",
        runId: run.id,
        error: message,
      });
    }
  }
  return results;
}
