import {
  enrichFestivalLinks,
  FestivalTmdbResolver,
} from "../_shared/festivals/external-links.mjs";
import { SupabaseFestivalExternalLinksRepository } from "../_shared/festivals/external-links-repository.mjs";
import { FESTIVAL_IDENTITY_EVIDENCE } from "../_shared/festivals/identity-evidence.mjs";
import { FESTIVAL_CONNECTORS } from "../_shared/festivals/connectors.mjs";
import {
  runFestivalConnectors,
  SupabaseFestivalRepository,
} from "../_shared/festivals/repository.mjs";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function secretsEqual(received: string, expected: string) {
  const left = new TextEncoder().encode(received);
  const right = new TextEncoder().encode(expected);
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
  const expected = Deno.env.get("INGESTION_CRON_SECRET") ?? "";
  const received = request.headers.get("x-runscars-cron-secret") ?? "";
  if (!expected || !received || !secretsEqual(received, expected)) {
    return json({ error: "No autorizado" }, 401);
  }
  try {
    const payload = await request.json().catch(() => ({}));
    const selected = Array.isArray(payload.connectors)
      ? payload.connectors.filter((value: unknown) => typeof value === "string")
      : null;
    const repository = new SupabaseFestivalRepository({
      supabaseUrl: Deno.env.get("SUPABASE_URL"),
      serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    });
    const connectors =
      payload.linksOnly === true
        ? []
        : await repository.activeConnectors(selected);
    const results = await runFestivalConnectors({
      connectors,
      registry: FESTIVAL_CONNECTORS,
      repository,
      trigger: payload.trigger === "manual" ? "manual" : "scheduled",
    });
    const links =
      payload.enrichLinks === true || payload.linksOnly === true
        ? await (async () => {
            const linkRepository = new SupabaseFestivalExternalLinksRepository({
              supabaseUrl: Deno.env.get("SUPABASE_URL"),
              serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
            });
            const resolver = new FestivalTmdbResolver({
              token: Deno.env.get("TMDB_READ_ACCESS_TOKEN"),
              cachedMovies: await linkRepository.cachedMovies(),
            });
            return enrichFestivalLinks({
              repository: linkRepository,
              resolver,
              apply: true,
              limit: payload.linkLimit ?? 25,
              afterEntryId: payload.afterEntryId ?? 0,
              reviewedEvidence: FESTIVAL_IDENTITY_EVIDENCE,
            });
          })()
        : null;
    const failed =
      (links?.failed ?? 0) +
      results.filter((result) => result.status === "failed").length;
    return json({
      status: failed === 0 ? "succeeded" : "partial",
      connectors: results.length,
      failed,
      results,
      links,
    });
  } catch (error) {
    return json(
      {
        status: "failed",
        error: error instanceof Error ? error.message : "Error interno",
      },
      500,
    );
  }
});
