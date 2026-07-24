import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  importCatalogMatch,
  SupabaseCatalogRepository,
  TmdbClient,
  tmdbManifestSchema,
} from "../src/lib/tmdb/catalog.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const localEnvironmentPath = path.join(repositoryRoot, "web/.env.local");
const defaultManifestPath = path.join(
  repositoryRoot,
  "data/phase-4/tmdb-matches.json",
);

if (existsSync(localEnvironmentPath)) {
  process.loadEnvFile(localEnvironmentPath);
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
}

function required(value, message) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function client() {
  return new TmdbClient({
    token: process.env.TMDB_READ_ACCESS_TOKEN,
  });
}

function repository() {
  return new SupabaseCatalogRepository({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

async function readManifest(manifestPath) {
  const rawManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return tmdbManifestSchema.parse(rawManifest);
}

async function search(args) {
  const query = required(args[0], "Indica un título para buscar");
  const yearValue = option(args, "--year");
  const year = yearValue ? Number.parseInt(yearValue, 10) : undefined;
  if (yearValue && !Number.isInteger(year)) {
    throw new Error("--year debe ser un año entero");
  }

  const results = await client().searchMovies(query, year);
  console.log(JSON.stringify(results, null, 2));
}

async function importManifest(args) {
  const manifestPath = path.resolve(
    repositoryRoot,
    args[0] ?? defaultManifestPath,
  );
  const manifest = await readManifest(manifestPath);
  const tmdbClient = client();
  const catalogRepository = repository();
  const failures = [];

  for (const match of manifest.matches) {
    try {
      const result = await importCatalogMatch({
        match,
        locale: manifest.locale,
        client: tmdbClient,
        repository: catalogRepository,
        actor: `manifest-v${manifest.version}`,
        onWarning: (warning) => console.warn(`Aviso: ${warning}`),
      });
      console.log(
        `${result.changed ? "Emparejada" : "Actualizada"} ${result.filmId} → TMDB ${result.tmdbId} (${result.people} personas)`,
      );
    } catch (error) {
      failures.push(match.filmId);
      console.error(
        `Falló ${match.filmId}: ${
          error instanceof Error ? error.message : "error desconocido"
        }`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `La importación terminó con ${failures.length} fallo(s): ${failures.join(", ")}`,
    );
  }
}

async function correctMatch(args) {
  const filmId = required(args[0], "Indica el ID interno de la película");
  const tmdbId = Number.parseInt(required(args[1], "Indica el ID de TMDB"), 10);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new Error("El ID de TMDB debe ser un entero positivo");
  }

  const reason = required(
    option(args, "--reason"),
    "Una corrección requiere --reason",
  );
  const query = option(args, "--query") ?? filmId;
  const locale = option(args, "--locale") ?? "es-ES";
  const result = await importCatalogMatch({
    match: {
      filmId,
      tmdbId,
      query,
      method: "correction",
      reason,
      evidenceUrl: `https://www.themoviedb.org/movie/${tmdbId}`,
    },
    locale,
    client: client(),
    repository: repository(),
    actor: "manual-correction-cli",
    onWarning: (warning) => console.warn(`Aviso: ${warning}`),
  });

  console.log(
    `${result.changed ? "Corregida" : "Sin cambios"} ${filmId} → TMDB ${tmdbId}`,
  );
}

function printHelp() {
  console.log(`Uso:
  npm run tmdb:search -- "<título>" [--year 2026]
  npm run tmdb:import -- [ruta-al-manifiesto]
  npm run tmdb:match -- <film-id> <tmdb-id> --reason "<motivo>" [--query "<consulta>"]`);
}

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case "search":
      await search(args);
      break;
    case "import":
      await importManifest(args);
      break;
    case "match":
      await correctMatch(args);
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;
    default:
      throw new Error(`Comando desconocido: ${command}`);
  }
} catch (error) {
  console.error(
    `Catálogo TMDB: ${
      error instanceof Error ? error.message : "error desconocido"
    }`,
  );
  process.exitCode = 1;
}
