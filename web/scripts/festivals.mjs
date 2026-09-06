import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FESTIVAL_CONNECTORS } from "../../supabase/functions/_shared/festivals/connectors.mjs";
import {
  importFestivalManifests,
  runFestivalConnectors,
  SupabaseFestivalRepository,
} from "../../supabase/functions/_shared/festivals/repository.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const environmentPath = path.join(repositoryRoot, "web/.env.local");
const defaultManifest = path.join(
  repositoryRoot,
  "web/data/festivals/2026.json",
);

if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);

function repository() {
  return new SupabaseFestivalRepository({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

async function importManifest(argument) {
  const manifestPath = argument
    ? path.resolve(repositoryRoot, argument)
    : defaultManifest;
  const document = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!Array.isArray(document.sets)) {
    throw new Error("El manifiesto debe contener una lista sets");
  }
  const results = await importFestivalManifests({
    manifests: document.sets,
    repository: repository(),
  });
  const inserted = results.filter((result) => result.status === "inserted");
  console.log(
    `Festivales: ${inserted.length} conjuntos insertados; ${results.length - inserted.length} sin cambios.`,
  );
}

async function refresh(selected) {
  const festivalRepository = repository();
  const connectors = await festivalRepository.activeConnectors(
    selected.length ? selected.map((id) => `festival-${id}`) : null,
  );
  const results = await runFestivalConnectors({
    connectors,
    registry: FESTIVAL_CONNECTORS,
    repository: festivalRepository,
    trigger: "manual",
  });
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => result.status === "failed")) {
    process.exitCode = 1;
  }
}

async function match(entryIdArgument, filmId, args) {
  const entryId = Number(entryIdArgument);
  if (!Number.isSafeInteger(entryId) || entryId < 1 || !filmId) {
    throw new Error("match requiere <entry-id> <film-id>");
  }
  const reasonIndex = args.indexOf("--reason");
  const reason = reasonIndex >= 0 ? args[reasonIndex + 1] : null;
  if (!reason?.trim()) throw new Error("match requiere --reason <motivo>");
  const historyId = await repository().matchEntry(entryId, filmId, reason);
  console.log(
    `Matching festivalero corregido: entrada ${entryId} → ${filmId}; historial ${historyId}.`,
  );
}

function help() {
  console.log(`Uso:
  npm run festivals:import -- [ruta-al-manifiesto.json]
  npm run festivals:refresh -- [sundance cannes ...]
  npm run festivals:match -- <entry-id> <film-id> --reason <motivo>`);
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "import") await importManifest(args[0]);
  else if (command === "refresh") await refresh(args);
  else if (command === "match") await match(args[0], args[1], args.slice(2));
  else if (!command || ["help", "-h", "--help"].includes(command)) help();
  else throw new Error(`Comando desconocido: ${command}`);
} catch (error) {
  console.error(
    `Festivales: ${error instanceof Error ? error.message : "error desconocido"}`,
  );
  process.exitCode = 1;
}
