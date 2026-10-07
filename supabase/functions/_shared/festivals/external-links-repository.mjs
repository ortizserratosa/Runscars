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
        .select(
          "tmdb_id,original_data,source_url,fetched_at,last_verified_at,expires_at",
        )
        .eq("locale", "en-US")
        .gt("expires_at", new Date().toISOString())
        .order("tmdb_id")
        .order("last_verified_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
    const movies = new Map();
    for (const row of rows) {
      if (movies.has(row.tmdb_id)) continue;
      movies.set(row.tmdb_id, {
        originalData: row.original_data,
        sourceUrl: row.source_url,
        capturedAt: row.last_verified_at ?? row.fetched_at,
      });
    }
    return [...movies.values()];
  }

  async confirmedMovieIds() {
    const rows = await allRows((from, to) =>
      this.client
        .from("public_festival_external_links")
        .select("entry_id,tmdb_id")
        .order("entry_id")
        .range(from, to),
    );
    return [...new Set(rows.map((row) => row.tmdb_id))]
      .filter((id) => Number.isSafeInteger(id) && id > 0)
      .sort((a, b) => a - b);
  }

  async retryEntriesWithoutImdb() {
    const entries = await this.currentEntries();
    const reviews = await allRows((from, to) =>
      this.client
        .from("festival_entry_external_link_history")
        .select("entry_id")
        .eq("status", "pending_review")
        .eq("method", "unique-identity-without-valid-imdb-id")
        .order("id")
        .range(from, to),
    );
    const confirmed = await allRows((from, to) =>
      this.client
        .from("public_festival_external_links")
        .select("entry_id")
        .order("entry_id")
        .range(from, to),
    );
    const confirmedIds = new Set(confirmed.map((row) => row.entry_id));
    const reviewIds = new Set(reviews.map((row) => row.entry_id));
    return entries.filter(
      (entry) =>
        reviewIds.has(entry.entryId) && !confirmedIds.has(entry.entryId),
    );
  }

  async saveMetadata(prepared) {
    const result = await this.client.rpc("persist_festival_tmdb_metadata", {
      payload: prepared,
    });
    if (result.error)
      throw new Error(`Metadatos festivaleros TMDB: ${result.error.message}`);
    return result.data;
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
