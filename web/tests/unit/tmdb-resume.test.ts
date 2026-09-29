import { describe, expect, it, vi } from "vitest";
import { SupabaseIngestionRepository } from "../../../supabase/functions/_shared/ingestion/repository.mjs";
import {
  expandCatalogFromBatch,
  verifiedAutomaticCredits,
} from "../../../supabase/functions/_shared/ingestion/tmdb-expansion.mjs";

type Row = Record<string, unknown>;

function contains(value: unknown, expected: unknown): boolean {
  if (expected && typeof expected === "object") {
    if (!value || typeof value !== "object") return false;
    return Object.entries(expected).every(([key, entry]) =>
      contains((value as Row)[key], entry),
    );
  }
  return value === expected;
}

function fixture() {
  const tables: Record<string, Row[]> = {
    films: [],
    season_films: [],
    film_tmdb_match_history: [],
    tmdb_movies: [],
    tmdb_movie_snapshots: [],
    tmdb_people: [],
    people: [{ id: "canonical-actor", tmdb_id: 20, name: "Canonical Actor" }],
    film_credits: [],
  };
  const state = {
    failCreditsOnce: false,
    failMatchingOnce: false,
    creditWrites: 0,
  };
  const client = {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      let ordering: { column: string; ascending: boolean } | null = null;
      let limit = Infinity;
      let single = false;
      let write: {
        payload: Row[];
        conflict: string[];
        ignore: boolean;
      } | null = null;
      const query = {
        select: () => query,
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return query;
        },
        in(column: string, values: unknown[]) {
          filters.push((row) => values.includes(row[column]));
          return query;
        },
        contains(column: string, value: unknown) {
          filters.push((row) => contains(row[column], value));
          return query;
        },
        order(column: string, options: { ascending: boolean }) {
          ordering = { column, ascending: options.ascending };
          return query;
        },
        limit(value: number) {
          limit = value;
          return query;
        },
        maybeSingle() {
          single = true;
          return query;
        },
        upsert(
          value: Row | Row[],
          options: { onConflict: string; ignoreDuplicates?: boolean },
        ) {
          write = {
            payload: Array.isArray(value) ? value : [value],
            conflict: options.onConflict.split(","),
            ignore: options.ignoreDuplicates === true,
          };
          return query;
        },
        insert(value: Row) {
          write = { payload: [value], conflict: ["id"], ignore: false };
          return query;
        },
        then(resolve: (value: unknown) => unknown) {
          if (write && table === "film_credits") {
            state.creditWrites += 1;
            if (state.failCreditsOnce) {
              state.failCreditsOnce = false;
              return Promise.resolve(
                resolve({ data: null, error: { message: "Interrupted" } }),
              );
            }
          }
          if (write) {
            for (const value of write.payload) {
              const existing = tables[table].find((row) =>
                write!.conflict.every(
                  (column) => row[column] === value[column],
                ),
              );
              if (!existing) tables[table].push(structuredClone(value));
              else if (!write.ignore) Object.assign(existing, value);
            }
          }
          let rows = tables[table].filter((row) =>
            filters.every((filter) => filter(row)),
          );
          if (ordering) {
            const { column, ascending } = ordering;
            rows = [...rows].sort(
              (left, right) =>
                String(left[column]).localeCompare(String(right[column])) *
                (ascending ? 1 : -1),
            );
          }
          rows = rows.slice(0, limit).map((row) =>
            table === "films"
              ? {
                  ...row,
                  film_credits: tables.film_credits.filter(
                    (credit) => credit.film_id === row.id,
                  ),
                }
              : row,
          );
          return Promise.resolve(
            resolve({ data: single ? (rows[0] ?? null) : rows, error: null }),
          );
        },
      };
      return query;
    },
    async rpc(_name: string, args: Row) {
      if (state.failMatchingOnce) {
        state.failMatchingOnce = false;
        return {
          data: null,
          error: { message: "Interrupted before matching" },
        };
      }
      const film = tables.films.find((row) => row.id === args.target_film_id)!;
      film.tmdb_id = args.target_tmdb_id;
      tables.film_tmdb_match_history.push({
        id: tables.film_tmdb_match_history.length + 1,
        film_id: film.id,
        tmdb_id: film.tmdb_id,
        actor: args.match_actor,
        method: args.match_method,
        reason: args.match_reason,
      });
      return { data: true, error: null };
    },
  };
  const repository = new SupabaseIngestionRepository({
    supabaseUrl: "https://fixture.supabase.co",
    serviceRoleKey: "offline-fixture-key",
  });
  repository.client = client as never;
  const raw = {
    id: 100,
    title: "A Film",
    original_title: "A Film",
    release_date: "2026-10-01",
    credits: {
      cast: [
        {
          id: 20,
          name: "Actor",
          credit_id: "cast-20",
          character: "Lead",
          order: 0,
        },
      ],
      crew: [
        { id: 10, name: "Director", credit_id: "crew-10", job: "Director" },
      ],
    },
    automatic_match: {
      match_rule: "unique-title-year-and-credits-v1",
      unique_exact_match: true,
      eligibility_year: 2026,
      people_evidence: [
        { source_name: "Actor", tmdb_person_id: 20, role: "Acting" },
      ],
    },
  };
  const snapshot = {
    tmdb_id: 100,
    locale: "en-US",
    content_hash: "a".repeat(64),
    fetched_at: "2026-09-29T12:00:00Z",
    original_data: raw,
  };
  const film = {
    tmdb_id: raw.id,
    title: raw.title,
    alternate_titles: [],
    eligibility_year: 2026,
  };
  const args = {
    filmIdBase: "a-film",
    seasonId: "oscars-2027",
    eligibilityYear: 2026,
    raw,
    snapshot,
    credits: verifiedAutomaticCredits(snapshot, film)!,
    query: raw.title,
  };
  return { repository, tables, state, args, film };
}

describe("resuming interrupted automatic TMDB imports", () => {
  it("does not create a second film after interruption before durable identity approval", async () => {
    const { repository, tables, state, args } = fixture();
    state.failMatchingOnce = true;
    await expect(repository.saveAutomaticTmdbFilm(args)).rejects.toThrow(
      "Interrupted before matching",
    );
    await expect(repository.saveAutomaticTmdbFilm(args)).rejects.toThrow(
      "requiere revisión antes de reanudar",
    );
    expect(tables.films).toHaveLength(1);
    expect(tables.films[0].tmdb_id).toBeUndefined();
    expect(tables.film_tmdb_match_history).toHaveLength(0);
    expect(tables.season_films).toHaveLength(0);
    expect(tables.film_credits).toHaveLength(0);
  });

  it("retries after matching without exposing an unfinished season film or changing canonical person IDs", async () => {
    const { repository, tables, state, args } = fixture();
    state.failCreditsOnce = true;
    await expect(repository.saveAutomaticTmdbFilm(args)).rejects.toThrow(
      "Interrupted",
    );
    expect(tables.films).toHaveLength(1);
    expect(tables.films[0].release_status).toBe("upcoming");
    expect(tables.film_tmdb_match_history).toHaveLength(1);
    expect(tables.season_films).toHaveLength(0);
    expect(tables.film_credits).toHaveLength(0);
    expect(await repository.saveAutomaticTmdbFilm(args)).toBe("a-film");
    expect(await repository.saveAutomaticTmdbFilm(args)).toBe("a-film");
    expect(tables.films).toHaveLength(1);
    expect(tables.film_tmdb_match_history).toHaveLength(1);
    expect(tables.tmdb_movie_snapshots).toHaveLength(1);
    expect(tables.season_films).toHaveLength(1);
    expect(tables.people).toHaveLength(2);
    expect(tables.people.find((person) => person.tmdb_id === 20)).toEqual({
      id: "canonical-actor",
      name: "Canonical Actor",
      tmdb_id: 20,
    });
    expect(tables.film_credits).toHaveLength(2);
    expect(
      tables.film_credits.find((credit) => credit.tmdb_credit_id === "cast-20")
        ?.person_id,
    ).toBe("canonical-actor");
    expect(state.creditWrites).toBe(2);
  });

  it("marks release dates on or before the actual capture day as released", async () => {
    const { repository, tables, args } = fixture();
    args.raw.release_date = "2026-09-29";
    await repository.saveAutomaticTmdbFilm(args);
    expect(tables.films[0].release_status).toBe("released");
  });

  it("repairs a previously linked empty film from durable proof before skipping its existing title", async () => {
    const { repository, tables, state, args } = fixture();
    state.failCreditsOnce = true;
    await expect(repository.saveAutomaticTmdbFilm(args)).rejects.toThrow();
    tables.season_films.push({ film_id: "a-film", season_id: "oscars-2027" });
    repository.seasonIdentity = async () => ({ eligibilityYear: 2026 });
    repository.filmIdentities = async () => [
      { id: "a-film", title: "A Film", credits: [] },
    ];
    const fetcher = vi.fn<typeof fetch>();
    const result = await expandCatalogFromBatch({
      repository,
      token: "offline",
      fetcher,
      batch: {
        seasonId: "oscars-2027",
        publications: [
          {
            observations: [
              {
                filmSubject: "A Film",
                dataType: "prediction_ordered",
                categoryId: "best-picture",
              },
            ],
          },
        ],
      },
    });
    expect(result.imported).toEqual([
      { title: "A Film", filmId: "a-film", tmdbId: 100, resumed: true },
    ]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(tables.film_credits).toHaveLength(2);
    expect(tables.film_tmdb_match_history).toHaveLength(1);
  });

  it.each(["manual", "correction"])(
    "does not resume after an editorial %s match",
    async (method) => {
      const { repository, tables, state, args } = fixture();
      state.failCreditsOnce = true;
      await expect(repository.saveAutomaticTmdbFilm(args)).rejects.toThrow();
      tables.film_tmdb_match_history.push({
        id: 2,
        film_id: "a-film",
        tmdb_id: 100,
        method,
        actor: "editorial-cli",
      });
      expect(await repository.resumeAutomaticTmdbFilm("a-film")).toBeNull();
      expect(tables.film_credits).toEqual([]);
      expect(state.creditWrites).toBe(1);
    },
  );

  it.each(["wrong-id", "unproved-person", "legacy-rule"])(
    "rejects %s durable evidence",
    async (kind) => {
      const { repository, tables, state, args } = fixture();
      state.failCreditsOnce = true;
      await expect(repository.saveAutomaticTmdbFilm(args)).rejects.toThrow();
      const raw = tables.tmdb_movie_snapshots[0].original_data as Row;
      const proof = raw.automatic_match as Row;
      if (kind === "wrong-id") raw.id = 200;
      if (kind === "unproved-person")
        proof.people_evidence = [
          { source_name: "Other", tmdb_person_id: 20, role: "Acting" },
        ];
      if (kind === "legacy-rule") proof.match_rule = "title-only";
      expect(await repository.resumeAutomaticTmdbFilm("a-film")).toBeNull();
      expect(tables.film_credits).toEqual([]);
      await expect(repository.saveAutomaticTmdbFilm(args)).rejects.toThrow(
        "no tiene evidencia válida",
      );
      expect(tables.season_films).toEqual([]);
    },
  );
});
