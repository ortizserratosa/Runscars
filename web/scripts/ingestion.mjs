import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseManualManifest } from "../../supabase/functions/_shared/ingestion/core.mjs";
import {
  persistBatch,
  SupabaseIngestionRepository,
} from "../../supabase/functions/_shared/ingestion/repository.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const localEnvironmentPath = path.join(repositoryRoot, "web/.env.local");

if (existsSync(localEnvironmentPath)) {
  process.loadEnvFile(localEnvironmentPath);
}

function repository() {
  return new SupabaseIngestionRepository({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

async function importManual(manifestPathArgument) {
  if (!manifestPathArgument) {
    throw new Error("Indica la ruta al manifiesto JSON");
  }
  const manifestPath = path.resolve(repositoryRoot, manifestPathArgument);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const capturedAt = new Date().toISOString();
  const batch = parseManualManifest(manifest, { capturedAt });
  const ingestionRepository = repository();
  const runKey = `manual-editorial:manual:${capturedAt}`;
  const runId = await ingestionRepository.beginRun({
    connectorId: batch.connectorId,
    trigger: "manual",
    startedAt: capturedAt,
    runKey,
  });

  try {
    const result = await persistBatch({
      batch,
      repository: ingestionRepository,
      runId,
    });
    console.log(
      `Importadas ${result.observationsInserted}; repetidas ${result.observationsDuplicate}; a revisión ${result.reviewItemsCreated}.`,
    );
  } catch (error) {
    const errorSummary =
      error instanceof Error ? error.message : "Error de importación";
    const finishedAt = new Date().toISOString();
    const counters = error?.ingestionCounters ?? {
      publicationsSeen: 0,
      observationsSeen: 0,
      observationsInserted: 0,
      observationsDuplicate: 0,
      reviewItemsCreated: 0,
    };
    await ingestionRepository.addEvent(
      runId,
      "error",
      "manual.failed",
      errorSummary,
    );
    await ingestionRepository.finishRun(runId, {
      ...counters,
      status: "failed",
      finishedAt,
      errorSummary,
    });
    throw error;
  }
}

function help() {
  console.log(`Uso:
  npm run ingest:manual -- <ruta-al-manifiesto.json>`);
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === "manual") await importManual(args[0]);
  else if (!command || ["help", "-h", "--help"].includes(command)) help();
  else throw new Error(`Comando desconocido: ${command}`);
} catch (error) {
  console.error(
    `Ingesta: ${error instanceof Error ? error.message : "error desconocido"}`,
  );
  process.exitCode = 1;
}
