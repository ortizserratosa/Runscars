import { createClient } from "@supabase/supabase-js";
import { preparePrecursorSet } from "./core.mjs";

function checked(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

export class SupabasePrecursorRepository {
  constructor({ supabaseUrl, serviceRoleKey }) {
    if (!supabaseUrl || !serviceRoleKey)
      throw new Error(
        "Faltan credenciales de servidor para importar precursores",
      );
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async catalogue(seasonId) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const page = checked(
        await this.client
          .from("season_films")
          .select("film_id,films(id,title,alternate_titles)")
          .eq("season_id", seasonId)
          .order("film_id")
          .range(offset, offset + 499),
        "No se pudo leer el catálogo precursor",
      );
      rows.push(...page);
      if (page.length < 500) break;
    }
    return rows.flatMap((row) => {
      const film = Array.isArray(row.films) ? row.films[0] : row.films;
      return film
        ? [
            {
              id: film.id,
              title: film.title,
              alternateTitles: film.alternate_titles,
              seasonIds: [seasonId],
            },
          ]
        : [];
    });
  }

  async persistPreparedSet(prepared, actor) {
    return checked(
      await this.client.rpc("persist_precursor_set", {
        payload: prepared,
        matching_actor: actor,
      }),
      "No se pudo importar el conjunto precursor",
    );
  }

  async matchEntry(entryId, filmId, reason, actor = "cli:precursors-match") {
    return checked(
      await this.client.rpc("match_precursor_entry", {
        target_entry_id: entryId,
        target_film_id: filmId,
        correction_reason: reason,
        correction_actor: actor,
      }),
      "No se pudo corregir el matching precursor",
    );
  }
}

export async function importPrecursorManifests({
  manifests,
  repository,
  actor = "manual-official-import",
}) {
  const catalogues = new Map();
  const results = [];
  for (const manifest of manifests) {
    try {
      if (!catalogues.has(manifest.seasonId))
        catalogues.set(
          manifest.seasonId,
          await repository.catalogue(manifest.seasonId),
        );
      const prepared = await preparePrecursorSet(
        manifest,
        catalogues.get(manifest.seasonId),
      );
      const result = await repository.persistPreparedSet(prepared, actor);
      results.push({
        ...result,
        editionId: prepared.editionId,
        kind: prepared.kind,
      });
    } catch (error) {
      results.push({
        editionId: manifest.editionId,
        kind: manifest.kind,
        status: "failed",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
  return results;
}
