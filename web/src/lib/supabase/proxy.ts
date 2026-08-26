import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../../types/database.generated";

export async function updateSupabaseSession(request: NextRequest) {
  return updateSupabaseSessionWithResponse(request);
}

export async function updateSupabaseSessionWithResponse(
  request: NextRequest,
  options: { requestHeaders?: Headers; rewriteUrl?: URL } = {},
) {
  const createResponse = () =>
    options.rewriteUrl
      ? NextResponse.rewrite(options.rewriteUrl, {
          request: { headers: options.requestHeaders ?? request.headers },
        })
      : NextResponse.next({
          request: { headers: options.requestHeaders ?? request.headers },
        });
  let response = createResponse();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = createResponse();
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}
