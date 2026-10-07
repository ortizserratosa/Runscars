import { createClient } from "@supabase/supabase-js";

function checked(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data ?? [];
}

async function allRows(readPage) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const page = checked(
      await readPage(offset, offset + 499),
      "Lectura de identidad festivalera",
    );
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

export class SupabaseFestivalExternalLinksRepository {
  constructor({ supabaseUrl, serviceRoleKey, client }) {
    if (!client && (!supabaseUrl || !serviceRoleKey))
      throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    this.client =
      client ??
      createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    this.entries = null;
  }

  async currentEntries() {
    if (this.entries) return this.entries;
    const current = checked(
      await this.client
        .from("current_festival_sets")
        .select("set_id,edition_id,kind")
        .order("edition_id")
        .order("kind"),
      "Conjuntos festivaleros vigentes",
    );
    const setIds = current.map((row) => row.set_id);
    if (!setIds.length) return [];
    const sets = checked(
      await this.client
        .from("festival_sets")
        .select("id,source_url,captured_at")
        .in("id", setIds),
      "Recibos de los conjuntos vigentes",
    );
    const rows = await allRows((from, to) =>
      this.client
        .from("festival_entries")
        .select("id,set_id,original_title,original_recipient,original_data")
        .in("set_id", setIds)
        .eq("is_feature", true)
        .order("id")
        .range(from, to),
    );
    this.entries = rows.map((entry) => {
      const context = current.find((row) => row.set_id === entry.set_id);
      const set = sets.find((row) => row.id === entry.set_id);
      return {
        entryId: entry.id,
        editionId: context.edition_id,
        kind: context.kind,
        originalTitle: entry.original_title,
        originalRecipient: entry.original_recipient,
        originalData: entry.original_data,
        originalSourceUrl: set.source_url,
        originalCapturedAt: set.captured_at,
      };
    });
    return this.entries;
  }

  async cachedMovies() {
    const rows = await allRows((from, to) =>
      this.client
        .from("tmdb_movie_snapshots")
        .select("tmdb_id,original_data,source_url,fetched_at")
        .eq("locale", "en-US")
        .order("tmdb_id")
        .order("fetched_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
    const movies = new Map();
    for (const row of rows) {
      if (
        movies.has(row.tmdb_id) ||
        !/^tt\d{7,10}$/.test(row.original_data?.imdb_id ?? "")
      )
        continue;
      movies.set(row.tmdb_id, {
        originalData: row.original_data,
        sourceUrl: row.source_url,
        capturedAt: row.fetched_at,
      });
    }
    return [...movies.values()];
  }

  async persist(payload) {
    const result = await this.client.rpc("persist_festival_external_link", {
      payload,
    });
    if (result.error)
      throw new Error(
        `Persistencia de identidad festivalera: ${result.error.message}`,
      );
    return result.data;
  }
}
