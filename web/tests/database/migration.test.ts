import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const migrationPath = path.join(
  repositoryRoot,
  "supabase/migrations/20260724130000_phase_3_foundation.sql",
);
const seedPath = path.join(repositoryRoot, "supabase/seed.sql");

describe("phase 3 database foundation", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec("create role anon; create role authenticated;");
    await database.exec(await readFile(migrationPath, "utf8"));
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
});
