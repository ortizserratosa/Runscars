import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeIdentity } from "../../supabase/functions/_shared/ingestion/core.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const localEnvironmentPath = path.join(repositoryRoot, "web/.env.local");
if (existsSync(localEnvironmentPath)) process.loadEnvFile(localEnvironmentPath);

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
}

function required(value, message) {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

async function match(args) {
  const observationId = Number.parseInt(
    required(args[0], "Indica el ID de observación"),
    10,
  );
  if (!Number.isSafeInteger(observationId) || observationId <= 0) {
    throw new Error("El ID de observación debe ser un entero positivo");
  }
  const candidateId = required(args[1], "Indica la candidatura canónica");
  const matchKind = required(
    option(args, "--kind"),
    "Indica --kind film|person|team|category",
  );
  if (!["film", "person", "team", "category"].includes(matchKind)) {
    throw new Error("--kind debe ser film, person, team o category");
  }
  const reason = required(
    option(args, "--reason"),
    "La corrección requiere --reason",
  );
  const actor = option(args, "--actor") ?? "candidate-match-cli";
  const url = required(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "Falta NEXT_PUBLIC_SUPABASE_URL",
  );
  const key = required(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Falta SUPABASE_SERVICE_ROLE_KEY",
  );
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [observationResult, candidateResult] = await Promise.all([
    client
      .from("professional_observations")
      .select("id,source_id,season_id,category_id,original_subject")
      .eq("id", observationId)
      .single(),
    client
      .from("category_candidates")
      .select("id,season_id,category_id,film_id")
      .eq("id", candidateId)
      .single(),
  ]);
  if (observationResult.error) {
    throw new Error(`Observación: ${observationResult.error.message}`);
  }
  if (candidateResult.error) {
    throw new Error(`Candidatura: ${candidateResult.error.message}`);
  }
  const observation = observationResult.data;
  const candidate = candidateResult.data;
  if (observation.season_id !== candidate.season_id) {
    throw new Error("La candidatura pertenece a otra temporada");
  }
  if (
    matchKind !== "category" &&
    observation.category_id !== candidate.category_id
  ) {
    throw new Error("La candidatura pertenece a otra categoría");
  }

  const history = await client.from("category_candidate_match_history").insert({
    source_id: observation.source_id,
    season_id: observation.season_id,
    category_id: candidate.category_id,
    normalized_subject: normalizeIdentity(observation.original_subject),
    category_candidate_id: candidate.id,
    match_kind: matchKind,
    reason,
    actor,
  });
  if (
    history.error &&
    !history.error.message.toLocaleLowerCase("en").includes("duplicate")
  ) {
    throw new Error(`Historial: ${history.error.message}`);
  }

  const update = await client
    .from("professional_observations")
    .update({
      category_id: candidate.category_id,
      category_candidate_id: candidate.id,
      film_id: candidate.film_id,
      person_id: null,
      state: "published",
      participates: true,
    })
    .eq("id", observationId);
  if (update.error) throw new Error(`Observación: ${update.error.message}`);
  const review = await client
    .from("ingestion_review_items")
    .update({
      status: "resolved",
      resolution_note: reason,
      resolved_at: new Date().toISOString(),
      resolved_by: actor,
    })
    .eq("observation_id", observationId)
    .eq("status", "pending");
  if (review.error) throw new Error(`Revisión: ${review.error.message}`);

  console.log(
    `Observación ${observationId} vinculada a ${candidateId}; original preservado`,
  );
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "match") await match(args);
  else {
    console.log(`Uso:
  npm run candidate:match -- <observation-id> <candidate-id> --kind <film|person|team|category> --reason "<motivo>" [--actor "<autor>"]`);
  }
} catch (error) {
  console.error(
    `Candidaturas: ${
      error instanceof Error ? error.message : "error desconocido"
    }`,
  );
  process.exitCode = 1;
}
