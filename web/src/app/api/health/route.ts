import { isSupabaseConfigured } from "../../../lib/environment";

export function GET() {
  return Response.json({
    status: "ok",
    service: "runscars-web",
    databaseConfigured: isSupabaseConfigured(),
  });
}
