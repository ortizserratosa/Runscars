import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  importPrecursorManifests,
  SupabasePrecursorRepository,
} from "../../supabase/functions/_shared/precursors/repository.mjs";
import { preparePrecursorSet } from "../../supabase/functions/_shared/precursors/core.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const environmentPath = path.join(root, "web/.env.local");
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);
const repository = () =>
  new SupabasePrecursorRepository({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

async function manifest(argument) {
  const document = JSON.parse(
    await readFile(
      path.resolve(root, argument ?? "web/data/precursors/2026-2027.json"),
      "utf8",
    ),
  );
  if (!Array.isArray(document.sets) || !document.sets.length)
    throw new Error("El manifiesto debe contener conjuntos oficiales");
  return document.sets;
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "validate") {
    const sets = await manifest(args[0]);
    for (const set of sets) await preparePrecursorSet(set);
    console.log(
      `Precursores: ${sets.length} conjuntos válidos; no se ha escrito en la base de datos.`,
    );
  } else if (command === "import") {
    const results = await importPrecursorManifests({
      manifests: await manifest(args[0]),
      repository: repository(),
    });
    console.log(JSON.stringify(results, null, 2));
    if (results.some((result) => result.status === "failed"))
      process.exitCode = 1;
  } else if (command === "match") {
    const entryId = Number(args[0]);
    const filmId = args[1];
    const reason = args[args.indexOf("--reason") + 1];
    if (
      !Number.isSafeInteger(entryId) ||
      entryId < 1 ||
      !filmId ||
      !args.includes("--reason") ||
      !reason?.trim()
    )
      throw new Error("match requiere <entry-id> <film-id> --reason <motivo>");
    console.log(
      `Historial de matching precursor: ${await repository().matchEntry(entryId, filmId, reason)}`,
    );
  } else {
    console.log(
      "Uso: node web/scripts/precursors.mjs validate|import [manifiesto.json]\n     node web/scripts/precursors.mjs match <entry-id> <film-id> --reason <motivo>",
    );
    if (command && !["help", "--help", "-h"].includes(command))
      process.exitCode = 1;
  }
} catch (error) {
  console.error(
    `Precursores: ${error instanceof Error ? error.message : "Error desconocido"}`,
  );
  process.exitCode = 1;
}
