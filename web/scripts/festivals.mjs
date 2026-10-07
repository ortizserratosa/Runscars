import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import {
  enrichFestivalLinks,
  FestivalTmdbResolver,
} from "../../supabase/functions/_shared/festivals/external-links.mjs";
import { SupabaseFestivalExternalLinksRepository } from "../../supabase/functions/_shared/festivals/external-links-repository.mjs";
import { FESTIVAL_IDENTITY_EVIDENCE } from "../../supabase/functions/_shared/festivals/identity-evidence.mjs";
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
  const failed = results.filter((result) => result.status === "failed");
  const unchanged = results.filter((result) => result.status === "duplicate");
  console.log(
    `Festivales: ${inserted.length} conjuntos insertados; ${unchanged.length} sin cambios; ${failed.length} fallidos.`,
  );
  if (failed.length) {
    console.error(JSON.stringify(failed, null, 2));
    process.exitCode = 1;
  }
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

async function enrichLinks(args) {
  const allowed = new Set([
    "--apply",
    "--all",
    "--limit",
    "--after",
    "--env-file",
    "--report",
  ]);
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!allowed.has(key)) throw new Error(`Opción desconocida: ${key}`);
    if (["--apply", "--all"].includes(key)) options[key] = true;
    else {
      const value = args[++index];
      if (!value || value.startsWith("--"))
        throw new Error(`${key} requiere un valor`);
      options[key] = value;
    }
  }
  const environment = { ...process.env };
  if (options["--env-file"])
    Object.assign(
      environment,
      parseEnv(await readFile(path.resolve(options["--env-file"]), "utf8")),
    );
  const linkRepository = new SupabaseFestivalExternalLinksRepository({
    supabaseUrl:
      environment.NEXT_PUBLIC_SUPABASE_URL ?? environment.SUPABASE_URL,
    serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
  });
  const resolver = new FestivalTmdbResolver({
    token: environment.TMDB_READ_ACCESS_TOKEN,
    cachedMovies: await linkRepository.cachedMovies(),
  });
  let afterEntryId = Number(options["--after"] ?? 0);
  const reports = [];
  do {
    const report = await enrichFestivalLinks({
      repository: linkRepository,
      resolver,
      afterEntryId,
      limit: Number(options["--limit"] ?? 25),
      apply: options["--apply"] === true,
      reviewedEvidence: FESTIVAL_IDENTITY_EVIDENCE,
    });
    reports.push(report);
    console.log(JSON.stringify(report));
    afterEntryId = report.nextEntryId;
    if (options["--report"])
      await writeFile(
        path.resolve(options["--report"]),
        JSON.stringify(
          {
            schemaVersion: 1,
            reports,
            nextEntryId: afterEntryId,
            hasMore: report.hasMore,
          },
          null,
          2,
        ) + "\n",
      );
    if (report.failed) process.exitCode = 1;
    if (!options["--all"] || !report.hasMore) break;
  } while (true);
}

function help() {
  console.log(`Uso:
  npm run festivals:import -- [ruta-al-manifiesto.json]
  npm run festivals:refresh -- [sundance cannes ...]
  npm run festivals:match -- <entry-id> <film-id> --reason <motivo>
  npm run festivals:links -- [--apply] [--all] [--limit 25] [--after 0] [--env-file ruta] [--report ruta]`);
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "import") await importManifest(args[0]);
  else if (command === "refresh") await refresh(args);
  else if (command === "match") await match(args[0], args[1], args.slice(2));
  else if (command === "enrich-links") await enrichLinks(args);
  else if (!command || ["help", "-h", "--help"].includes(command)) help();
  else throw new Error(`Comando desconocido: ${command}`);
} catch (error) {
  console.error(
    `Festivales: ${error instanceof Error ? error.message : "error desconocido"}`,
  );
  process.exitCode = 1;
}
