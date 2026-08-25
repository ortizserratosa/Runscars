import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.generated";

function rows<T>(
  result: { data: T[] | null; error: { message: string } | null },
  label: string,
) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
}

export async function getEditorialDashboard(
  typedClient: SupabaseClient<Database>,
) {
  const client = typedClient as unknown as SupabaseClient;
  const [
    reviewsResult,
    candidatesResult,
    sourcesResult,
    connectorsResult,
    runsResult,
    snapshotsResult,
    resultsResult,
    actionsResult,
    seasonsResult,
    categoriesResult,
    seasonFilmsResult,
  ] = await Promise.all([
    client
      .from("ingestion_review_items")
      .select(
        "id,kind,status,subject_label,context,created_at,observation_id,connector_id,professional_observations(id,season_id,category_id,source_id,original_subject,original_value,state,participates,source_url),source_connectors(name)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(60),
    client
      .from("category_candidates")
      .select("id,season_id,category_id,display_label")
      .order("season_id", { ascending: false })
      .order("category_id")
      .order("display_label")
      .limit(1000),
    client
      .from("sources")
      .select(
        "id,name,editorial_status,technical_status,publication_status,last_reviewed_on,notes,updated_at",
      )
      .order("name"),
    client
      .from("source_connectors")
      .select(
        "id,source_id,name,kind,is_active,last_success_at,last_failure_at,last_error,updated_at",
      )
      .order("name"),
    client
      .from("ingestion_runs")
      .select(
        "id,connector_id,trigger,status,started_at,finished_at,observations_inserted,observations_duplicate,review_items_created,error_summary",
      )
      .order("started_at", { ascending: false })
      .limit(30),
    client
      .from("aggregate_snapshots")
      .select(
        "id,season_id,category_id,prediction_intention,kind,locked_at,locked_by,corrects_snapshot_id",
      )
      .order("locked_at", { ascending: false })
      .limit(40),
    client
      .from("official_result_sets")
      .select(
        "id,season_id,kind,source_url,published_at,captured_at,locked_at,locked_by,corrects_result_set_id",
      )
      .order("locked_at", { ascending: false })
      .limit(30),
    client
      .from("editorial_actions")
      .select(
        "id,admin_user_id,action_type,entity_type,entity_id,reason,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(80),
    client
      .from("seasons")
      .select("id,ceremony_year,status")
      .order("ceremony_year", { ascending: false }),
    client
      .from("categories")
      .select("id,name,is_public,is_active")
      .eq("is_active", true)
      .order("display_order"),
    client
      .from("season_films")
      .select("season_id,film_id,films(id,title)")
      .order("season_id", { ascending: false })
      .limit(1000),
  ]);

  return {
    reviews: rows(reviewsResult, "Revisiones"),
    candidates: rows(candidatesResult, "Candidaturas"),
    sources: rows(sourcesResult, "Fuentes"),
    connectors: rows(connectorsResult, "Conectores"),
    runs: rows(runsResult, "Ejecuciones"),
    snapshots: rows(snapshotsResult, "Snapshots"),
    resultSets: rows(resultsResult, "Resultados"),
    actions: rows(actionsResult, "Historial editorial"),
    seasons: rows(seasonsResult, "Temporadas"),
    categories: rows(categoriesResult, "Categorías"),
    seasonFilms: rows(seasonFilmsResult, "Películas por temporada"),
  };
}
