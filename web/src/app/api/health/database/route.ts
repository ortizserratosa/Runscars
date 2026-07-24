import { isSupabaseConfigured } from "../../../../lib/environment";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json(
      {
        status: "degraded",
        database: "not-configured",
      },
      { status: 503 },
    );
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("seasons")
    .select("id", { count: "exact", head: true });

  if (error) {
    return Response.json(
      {
        status: "degraded",
        database: "unreachable",
      },
      { status: 503 },
    );
  }

  return Response.json({
    status: "ok",
    database: "reachable",
  });
}
