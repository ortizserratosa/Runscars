import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  prepareOfficialResultsManifest,
  SupabaseOfficialResultsRepository,
} from "../src/lib/snapshots/official-results.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const localEnvironmentPath = path.join(repositoryRoot, "web/.env.local");

if (existsSync(localEnvironmentPath)) {
  process.loadEnvFile(localEnvironmentPath);
}

async function importResults(manifestArgument) {
  if (!manifestArgument) {
    throw new Error("Indica la ruta al manifiesto JSON");
  }
  const manifestPath = path.resolve(repositoryRoot, manifestArgument);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const resultSet = await prepareOfficialResultsManifest(manifest, {
    capturedAt: new Date().toISOString(),
    lockedBy: "official-results-cli-v1",
  });
  const repository = new SupabaseOfficialResultsRepository({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const inserted = await repository.lock(resultSet);
  console.log(
    inserted
      ? `Resultados bloqueados: ${resultSet.id}`
      : `Resultados ya existentes: ${resultSet.id}`,
  );
}

function help() {
  console.log(`Uso:
  npm run results:import -- <ruta-al-manifiesto.json>`);
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === "import") await importResults(args[0]);
  else if (!command || ["help", "-h", "--help"].includes(command)) help();
  else throw new Error(`Comando desconocido: ${command}`);
} catch (error) {
  console.error(
    `Resultados: ${
      error instanceof Error ? error.message : "error desconocido"
    }`,
  );
  process.exitCode = 1;
}
