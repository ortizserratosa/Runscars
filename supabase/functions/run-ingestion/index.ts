import { CONNECTORS } from "../_shared/ingestion/connectors.mjs";
import {
  runConnectorSet,
  SupabaseIngestionRepository,
} from "../_shared/ingestion/repository.mjs";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function secretsEqual(received: string, expected: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(received);
  const right = encoder.encode(expected);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Método no admitido" }, 405);
  }

  const expectedSecret = Deno.env.get("INGESTION_CRON_SECRET") ?? "";
  const receivedSecret = request.headers.get("x-runscars-cron-secret") ?? "";
  if (
    !expectedSecret ||
    !receivedSecret ||
    !secretsEqual(receivedSecret, expectedSecret)
  ) {
    return json({ error: "No autorizado" }, 401);
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const selectedConnectors = Array.isArray(payload.connectors)
      ? payload.connectors.filter((value: unknown) => typeof value === "string")
      : null;
    const repository = new SupabaseIngestionRepository({
      supabaseUrl: Deno.env.get("SUPABASE_URL"),
      serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    });
    const connectors = await repository.activeConnectors(selectedConnectors);
    const results = await runConnectorSet({
      connectors,
      registry: CONNECTORS,
      repository,
      trigger: payload.trigger === "manual" ? "manual" : "scheduled",
      secrets: {
        GUARDIAN_CONTENT_API_KEY: Deno.env.get("GUARDIAN_CONTENT_API_KEY"),
        TMDB_READ_ACCESS_TOKEN: Deno.env.get("TMDB_READ_ACCESS_TOKEN"),
      },
    });
    const failed = results.filter(
      (result) => result.status === "failed",
    ).length;

    return json({
      status: failed === 0 ? "succeeded" : "partial",
      connectors: results.length,
      failed,
      results,
    });
  } catch (error) {
    return json(
      {
        status: "failed",
        error:
          error instanceof Error ? error.message : "Error interno de ingesta",
      },
      500,
    );
  }
});
