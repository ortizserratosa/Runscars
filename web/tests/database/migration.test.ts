import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const migrationsDirectory = path.join(repositoryRoot, "supabase/migrations");
const seedPath = path.join(repositoryRoot, "supabase/seed.sql");

describe("versioned database foundation", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(
      "create role anon; create role authenticated; create role service_role;",
    );

    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const migrationFile of migrationFiles) {
      await database.exec(
        await readFile(path.join(migrationsDirectory, migrationFile), "utf8"),
      );
    }
  });

  afterEach(async () => {
    await database.close();
  });

  it("applies the migration and loads the reproducible fixture", async () => {
    await database.exec(await readFile(seedPath, "utf8"));

    const result = await database.query<{
      seasons: number;
      categories: number;
      films: number;
      sources: number;
    }>(`
      select
        (select count(*)::int from public.seasons) as seasons,
        (select count(*)::int from public.categories) as categories,
        (select count(*)::int from public.films) as films,
        (select count(*)::int from public.sources) as sources
    `);

    expect(result.rows[0]).toEqual({
      seasons: 1,
      categories: 8,
      films: 20,
      sources: 19,
    });
  });

  it("can load the seed twice without duplicating records", async () => {
    const seed = await readFile(seedPath, "utf8");
    await database.exec(seed);
    await database.exec(seed);

    const result = await database.query<{ films: number; links: number }>(`
      select
        (select count(*)::int from public.films) as films,
        (select count(*)::int from public.season_films) as links
    `);

    expect(result.rows[0]).toEqual({ films: 20, links: 20 });
  });

  it("exposes reference data as read-only through the public roles", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    await database.exec("set role anon;");

    const result = await database.query<{ title: string }>(
      "select title from public.films where id = 'the-odyssey'",
    );
    expect(result.rows[0]?.title).toBe("The Odyssey");

    await expect(
      database.exec(`
        insert into public.films (id, title)
        values ('not-authorized', 'Not authorized')
      `),
    ).rejects.toThrow();
  });

  it("keeps a matching audit trail without duplicating repeated imports", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    await database.exec(`
      insert into public.tmdb_movies (tmdb_id, last_checked_at)
      values
        (1368337, '2026-07-24T12:00:00Z'),
        (1698863, '2026-07-24T12:00:00Z');
    `);

    const firstMatch = await database.query<{ changed: boolean }>(`
      select public.record_film_tmdb_match(
        'the-odyssey',
        1368337,
        'manual',
        'The Odyssey',
        'Título, fecha y equipo verificados',
        'database-test'
      ) as changed
    `);
    const repeatedMatch = await database.query<{ changed: boolean }>(`
      select public.record_film_tmdb_match(
        'the-odyssey',
        1368337,
        'manual',
        'The Odyssey',
        'Título, fecha y equipo verificados',
        'database-test'
      ) as changed
    `);

    expect(firstMatch.rows[0]?.changed).toBe(true);
    expect(repeatedMatch.rows[0]?.changed).toBe(false);

    await database.query(`
      select public.record_film_tmdb_match(
        'the-odyssey',
        1698863,
        'correction',
        'The Odyssey',
        'Corrección editorial verificada',
        'database-test'
      )
    `);

    const result = await database.query<{
      current_tmdb_id: number;
      history_entries: number;
    }>(`
      select
        (select tmdb_id from public.films where id = 'the-odyssey')
          as current_tmdb_id,
        (
          select count(*)::int
          from public.film_tmdb_match_history
          where film_id = 'the-odyssey'
        ) as history_entries
    `);

    expect(result.rows[0]).toEqual({
      current_tmdb_id: 1698863,
      history_entries: 2,
    });
  });

  it("does not expose matching writes or their audit log publicly", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    await database.exec(`
      insert into public.tmdb_movies (tmdb_id, last_checked_at)
      values (1368337, '2026-07-24T12:00:00Z');
      set role anon;
    `);

    await expect(
      database.query(`
        select public.record_film_tmdb_match(
          'the-odyssey',
          1368337,
          'manual',
          'The Odyssey',
          'No autorizado',
          'anonymous'
        )
      `),
    ).rejects.toThrow();

    await expect(
      database.query("select * from public.film_tmdb_match_history"),
    ).rejects.toThrow();
  });
});
