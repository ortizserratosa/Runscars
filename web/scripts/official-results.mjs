import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPersonSnapshot,
  SupabaseCatalogRepository,
  TmdbClient,
} from "../src/lib/tmdb/catalog.mjs";
import {
  prepareOfficialArchiveV2,
  prepareOfficialResultsManifest,
  SupabaseOfficialResultsRepository,
} from "../src/lib/snapshots/official-results.mjs";
import { SupabaseIngestionRepository } from "../../supabase/functions/_shared/ingestion/repository.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const localEnvironmentPath = path.join(repositoryRoot, "web/.env.local");

if (existsSync(localEnvironmentPath)) {
  process.loadEnvFile(localEnvironmentPath);
}

function normalizedName(value) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
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

async function importArchive(manifestArgument) {
  const manifestPath = path.resolve(
    repositoryRoot,
    manifestArgument ?? "web/data/phase-7/oscars-2026.json",
  );
  const archive = JSON.parse(await readFile(manifestPath, "utf8"));
  const catalogRepository = new SupabaseCatalogRepository({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const tmdbClient = new TmdbClient({
    token: process.env.TMDB_READ_ACCESS_TOKEN,
  });
  for (const correction of archive.creditCorrections ?? []) {
    const matches = (await tmdbClient.searchPeople(correction.name)).filter(
      (person) =>
        normalizedName(person.name) === normalizedName(correction.name),
    );
    if (matches.length !== 1 || matches[0].id !== correction.tmdbPersonId) {
      throw new Error(
        `La corrección de ${correction.name} no es una coincidencia TMDB única`,
      );
    }
    const rawPerson = await tmdbClient.fetchPerson(
      correction.tmdbPersonId,
      "es-ES",
    );
    const personSnapshot = buildPersonSnapshot(rawPerson, {
      locale: "es-ES",
      fetchedAt: new Date(archive.capturedAt),
    });
    personSnapshot.person.name = correction.name;
    const credit = {
      tmdbPersonId: correction.tmdbPersonId,
      personId: `tmdb-${correction.tmdbPersonId}`,
      name: correction.name,
    };
    await catalogRepository.savePerson(credit, personSnapshot);
    await catalogRepository.addEditorialCredit({
      filmId: correction.filmId,
      personId: credit.personId,
      tmdbCreditId: `editorial:academy-2026:${correction.filmId}:${correction.tmdbPersonId}`,
      role: correction.role,
      department: correction.department,
      sourceUrl: correction.sourceUrl,
      reason: correction.reason,
      actor: "academy-archive-connector-v1",
    });
  }
  const ingestionRepository = new SupabaseIngestionRepository({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const films = await ingestionRepository.filmIdentities(archive.seasonId);
  const prepared = await prepareOfficialArchiveV2(archive, films, {
    lockedBy: "academy-archive-connector-v1",
  });
  for (const candidate of prepared.candidates) {
    try {
      await ingestionRepository.ensureCandidate(candidate);
    } catch (error) {
      throw new Error(
        `Candidatura ${candidate.id}: ${
          error instanceof Error ? error.message : "error desconocido"
        }`,
      );
    }
  }
  const officialRepository = new SupabaseOfficialResultsRepository({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  for (const resultSet of prepared.resultSets) {
    const inserted = await officialRepository.lock(resultSet);
    console.log(
      inserted
        ? `Archivo bloqueado: ${resultSet.id}`
        : `Archivo ya existente: ${resultSet.id}`,
    );
  }
}

function help() {
  console.log(`Uso:
  npm run results:import -- <ruta-al-manifiesto.json>
  npm run results:archive -- [ruta-al-archivo-2026.json]`);
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === "import") await importResults(args[0]);
  else if (command === "archive") await importArchive(args[0]);
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
