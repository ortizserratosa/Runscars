import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { CONNECTORS } from "../../supabase/functions/_shared/ingestion/connectors.mjs";
import {
  validateOrderedPredictionLists,
  validateRequiredPredictionCategories,
} from "../../supabase/functions/_shared/ingestion/core.mjs";
import { MARKET_CONNECTORS } from "../../supabase/functions/_shared/markets/connectors.mjs";
import { ceremonyYearConflict } from "../../supabase/functions/_shared/markets/core.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const localEnvironmentPath = path.join(repositoryRoot, "web/.env.local");
if (existsSync(localEnvironmentPath)) process.loadEnvFile(localEnvironmentPath);

const baseUrl = new URL(
  process.env.RUNSCARS_AUDIT_BASE_URL ?? "https://runscars.app",
);
const predictionsOnly = process.argv.includes("--predictions");
const failures = [];
const warnings = [];

async function auditPublicGraph() {
  try {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [path.join(scriptDirectory, "audit-public.mjs")],
      {
        env: { ...process.env, RUNSCARS_AUDIT_BASE_URL: baseUrl.href },
        maxBuffer: 1024 * 1024,
      },
    );
    console.log(stdout.trim());
  } catch (error) {
    failures.push(`Grafo público: ${error.stdout ?? error.message}`);
  }
}

const publicPredictionCategories = [
  "best-picture",
  "directing",
  "actor",
  "actress",
  "supporting-actor",
  "supporting-actress",
  "original-screenplay",
  "adapted-screenplay",
];

const predictionConnectors = [
  {
    id: "awardswatch-predictions",
    endpoint_url: "https://awardswatch.com/oscar-predictions-hq/",
    extractor_version: "awardswatch-multicategory-v7",
    configuration: {
      season_id: "oscars-2027",
      ceremony_year: 2027,
      archive_url:
        "https://awardswatch.com/category/predictions/film-predictions/oscars-predictions/2027-oscar-predictions/",
      panel_author: "Erik Anderson",
      required_category_ids: publicPredictionCategories,
    },
  },
  {
    id: "awards-daily-predictions",
    endpoint_url:
      "https://www.awardsdaily.com/wp-json/wp/v2/search?search=2027%20Oscar%20Predictions&per_page=20&_fields=id,url,title,subtype",
    extractor_version: "awards-daily-v9",
    configuration: {
      season_id: "oscars-2027",
      ceremony_year: 2027,
      discovery_limit: 12,
      required_category_ids: publicPredictionCategories,
    },
  },
  {
    id: "awards-radar-predictions",
    endpoint_url: "https://awardsradar.com/predictions/",
    extractor_version: "awards-radar-v6",
    configuration: {
      season_id: "oscars-2027",
      ceremony_year: 2027,
      required_category_ids: publicPredictionCategories,
    },
  },
  {
    id: "next-best-picture-predictions",
    endpoint_url:
      "https://predictions.nextbestpicture.com/u/655756da85df4c0efaa10bd2/oscars",
    extractor_version: "next-best-picture-v3",
    configuration: {
      season_id: "oscars-2027",
      ceremony_year: 2027,
      required_category_ids: publicPredictionCategories,
    },
  },
  {
    id: "midnight-critics-predictions",
    endpoint_url:
      "https://www.midnightcritics.com/predictions/2027-oscar-predictions",
    extractor_version: "midnight-critics-v2",
    configuration: {
      season_id: "oscars-2027",
      ceremony_year: 2027,
      required_category_ids: publicPredictionCategories,
    },
  },
  {
    id: "movie-state-predictions",
    endpoint_url:
      "https://themoviestate.com/the-movie-state/features/award-predictions/",
    extractor_version: "movie-state-v1",
    configuration: {
      season_id: "oscars-2027",
      ceremony_year: 2027,
      required_category_ids: publicPredictionCategories,
    },
  },
  {
    id: "ringer-best-picture",
    endpoint_url: "https://www.theringer.com/topic/oscars",
    extractor_version: "the-ringer-v2",
    configuration: {
      season_id: "oscars-2027",
      ceremony_year: 2027,
      required_category_ids: ["best-picture"],
      article_fallback_url:
        "https://www.theringer.com/2026/03/20/oscars/oscars-2027-predictions-best-picture-movies-contenders",
    },
  },
  ...publicPredictionCategories.map((categoryId) => ({
    id: `variety-${categoryId}-predictions`,
    endpoint_url: "https://variety.com/lists/2027-oscars-predictions/",
    extractor_version: "variety-datawrapper-v1",
    configuration: {
      season_id: "oscars-2027",
      ceremony_year: 2027,
      category_id: categoryId,
      discovery_url: "https://variety.com/lists/2027-oscars-predictions/",
      required_category_ids: [categoryId],
    },
  })),
];

async function auditPredictionParsers() {
  let connectors = predictionConnectors;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const client = createClient(url, key, { auth: { persistSession: false } });
    const result = await client
      .from("source_connectors")
      .select("id,endpoint_url,extractor_version,configuration")
      .eq("is_active", true);
    if (result.error) {
      failures.push(`Configuración profesional: ${result.error.message}`);
      return;
    }
    const knownPredictions = new Set(
      predictionConnectors.map((connector) => connector.id),
    );
    for (const connector of result.data) {
      if (
        knownPredictions.has(connector.id) &&
        (!Array.isArray(connector.configuration?.required_category_ids) ||
          connector.configuration.required_category_ids.length === 0)
      ) {
        failures.push(
          `${connector.id}: falta configuración de categorías requeridas`,
        );
      }
    }
    connectors = result.data.filter(
      (connector) =>
        Array.isArray(connector.configuration?.required_category_ids) &&
        connector.configuration.required_category_ids.length > 0,
    );
    if (!connectors.length) {
      failures.push("Sin conectores profesionales con cobertura requerida");
      return;
    }
  } else {
    warnings.push(
      "Parsers comprobados con configuración versionada; sin verificar configuración remota",
    );
  }
  const capturedAt = new Date().toISOString();
  for (const connector of connectors) {
    try {
      const batch = await CONNECTORS[connector.id]({ connector, capturedAt });
      validateOrderedPredictionLists(batch);
      validateRequiredPredictionCategories(
        batch,
        connector.configuration.required_category_ids,
      );
      if (!batch.publications.length)
        throw new Error("sin publicaciones reconocibles");
      console.log(
        `${connector.id}: ${batch.publications.length} publicaciones; ${batch.publications.reduce((sum, item) => sum + item.observations.length, 0)} observaciones; cobertura requerida completa.`,
      );
    } catch (error) {
      failures.push(
        `${connector.id}: ${error instanceof Error ? error.message : "error"}`,
      );
    }
  }
}

async function auditMarkets() {
  const capturedAt = new Date().toISOString();
  const connectors = [
    {
      id: "kalshi-oscars",
      endpoint_url: "https://external-api.kalshi.com/trade-api/v2/markets",
      configuration: {
        season_id: "oscars-2027",
        ceremony_year: 2027,
        series_tickers: ["KXOSCARNOMPIC", "KXOSCARPIC"],
      },
    },
    {
      id: "polymarket-oscars",
      endpoint_url: "https://gamma-api.polymarket.com/markets",
      configuration: {
        season_id: "oscars-2027",
        ceremony_year: 2027,
        query: "Oscars 2027",
      },
    },
  ];
  for (const connector of connectors) {
    try {
      const contracts = await MARKET_CONNECTORS[connector.id]({
        connector,
        capturedAt,
      });
      const contaminated = contracts.filter((contract) =>
        ceremonyYearConflict(
          [
            contract.marketTitle,
            contract.sourceUrl,
            contract.externalMarketId,
            contract.externalContractId,
          ],
          2027,
        ),
      );
      if (contaminated.length)
        throw new Error(`${contaminated.length} contratos de otra ceremonia`);
      console.log(
        `${connector.id}: ${contracts.length} contratos 2027 válidos.`,
      );
    } catch (error) {
      failures.push(
        `${connector.id}: ${error instanceof Error ? error.message : "error"}`,
      );
    }
  }
}

async function auditCronFreshness() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    warnings.push(
      "Sin credenciales de servidor: no se auditó la frescura interna de cron",
    );
    return;
  }
  const client = createClient(url, key, { auth: { persistSession: false } });
  for (const table of predictionsOnly
    ? ["source_connectors"]
    : ["source_connectors", "market_connectors", "festival_connectors"]) {
    const result = await client
      .from(table)
      .select(
        "id,is_active,last_success_at,last_failure_at,last_error,configuration",
      )
      .eq("is_active", true);
    if (result.error) {
      failures.push(`${table}: ${result.error.message}`);
      continue;
    }
    for (const connector of result.data ?? []) {
      if (
        predictionsOnly &&
        !Array.isArray(connector.configuration?.required_category_ids)
      )
        continue;
      if (!connector.last_success_at) {
        failures.push(`${connector.id}: aún sin ejecución correcta`);
      } else if (
        Date.now() - Date.parse(connector.last_success_at) >
        (table === "market_connectors" ? 2 : 36) * 60 * 60 * 1000
      ) {
        failures.push(
          `${connector.id}: última ejecución correcta fuera de la ventana operativa`,
        );
      }
      if (
        connector.last_failure_at &&
        (!connector.last_success_at ||
          Date.parse(connector.last_failure_at) >
            Date.parse(connector.last_success_at))
      ) {
        failures.push(
          `${connector.id}: incidencia vigente (${connector.last_error ?? "sin detalle"})`,
        );
      }
    }
  }
  const refresh = await client
    .from("snapshot_refresh_runs")
    .select("status,started_at,finished_at,schedules_failed")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (refresh.error) {
    failures.push(`Refresco de predicciones: ${refresh.error.message}`);
  } else if (
    !refresh.data ||
    refresh.data.status !== "succeeded" ||
    Date.now() -
      Date.parse(refresh.data.finished_at ?? refresh.data.started_at) >
      36 * 60 * 60 * 1000
  ) {
    failures.push(
      "Refresco de predicciones sin éxito completo en las últimas 36 horas",
    );
  }
}

if (!predictionsOnly && process.env.RUNSCARS_AUDIT_SKIP_PUBLIC !== "true")
  await auditPublicGraph();
await auditPredictionParsers();
if (!predictionsOnly) await auditMarkets();
await auditCronFreshness();

for (const warning of warnings) console.warn(`AVISO: ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`FALLO: ${failure}`);
  console.error(
    `Auditoría de producción fallida: ${failures.length} incidencias.`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Auditoría de producción correcta${warnings.length ? ` con ${warnings.length} avisos` : ""}.`,
  );
}
