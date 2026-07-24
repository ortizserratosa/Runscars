import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnvironment } from "../environment";
import type { Database } from "../../types/database.generated";

export function createSupabaseServerClient() {
  const environment = getSupabaseEnvironment();

  return createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
