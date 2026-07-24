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
      connectors: number;
    }>(`
      select
        (select count(*)::int from public.seasons) as seasons,
        (select count(*)::int from public.categories) as categories,
        (select count(*)::int from public.films) as films,
        (select count(*)::int from public.sources) as sources,
        (select count(*)::int from public.source_connectors) as connectors
    `);

    expect(result.rows[0]).toEqual({
      seasons: 1,
      categories: 8,
      films: 20,
      sources: 19,
      connectors: 4,
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

  it("deduplicates original observations and preserves their source URL", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    await database.exec(`
      insert into public.ingestion_runs (
        run_key,
        connector_id,
        trigger,
        started_at
      )
      values (
        'database-test-run',
        'guardian-content-api',
        'fixture',
        '2026-07-24T15:00:00Z'
      );

      insert into public.source_publications (
        source_id,
        external_id,
        canonical_url,
        title,
        author,
        published_at
      )
      values (
        'guardian',
        'guardian-test-publication',
        'https://www.theguardian.com/film/example-review',
        'The Odyssey review',
        'Fixture Critic',
        '2026-07-24T12:00:00Z'
      );

      insert into public.source_publication_captures (
        publication_id,
        content_hash,
        source_url,
        original_data,
        captured_at,
        extractor_version
      )
      select
        id,
        repeat('a', 64),
        canonical_url,
        '{"headline":"The Odyssey review"}'::jsonb,
        '2026-07-24T15:00:00Z',
        'guardian-v1'
      from public.source_publications
      where external_id = 'guardian-test-publication';

      insert into public.professional_observations (
        dedupe_key,
        source_id,
        publication_id,
        capture_id,
        run_id,
        season_id,
        film_id,
        data_type,
        original_subject,
        original_value,
        source_url,
        author,
        published_at,
        captured_at,
        extractor_version,
        state
      )
      select
        repeat('b', 64),
        'guardian',
        publication.id,
        capture.id,
        run.id,
        'oscars-2027',
        'the-odyssey',
        'review',
        'The Odyssey',
        '{"linked_review":true}'::jsonb,
        publication.canonical_url,
        publication.author,
        publication.published_at,
        capture.captured_at,
        'guardian-v1',
        'published'
      from public.source_publications as publication
      join public.source_publication_captures as capture
        on capture.publication_id = publication.id
      cross join public.ingestion_runs as run
      where publication.external_id = 'guardian-test-publication'
        and run.run_key = 'database-test-run'
      on conflict (dedupe_key) do nothing;

      insert into public.professional_observations (
        dedupe_key,
        source_id,
        publication_id,
        capture_id,
        run_id,
        season_id,
        film_id,
        data_type,
        original_subject,
        original_value,
        source_url,
        author,
        published_at,
        captured_at,
        extractor_version,
        state
      )
      select
        dedupe_key,
        source_id,
        publication_id,
        capture_id,
        run_id,
        season_id,
        film_id,
        data_type,
        original_subject,
        original_value,
        source_url,
        author,
        published_at,
        captured_at,
        extractor_version,
        state
      from public.professional_observations
      where dedupe_key = repeat('b', 64)
      on conflict (dedupe_key) do nothing;
    `);

    const result = await database.query<{
      observations: number;
      source_url: string;
    }>(`
      select
        count(*)::int as observations,
        min(source_url) as source_url
      from public.professional_observations
      where dedupe_key = repeat('b', 64)
    `);

    expect(result.rows[0]).toEqual({
      observations: 1,
      source_url: "https://www.theguardian.com/film/example-review",
    });

    await database.exec("set role anon;");
    const publicResult = await database.query<{ observations: number }>(`
      select count(*)::int as observations
      from public.professional_observations
      where source_id = 'guardian'
    `);
    expect(publicResult.rows[0]?.observations).toBe(0);
  });

  it("keeps ingestion logs and the editorial queue private", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    await database.exec("set role anon;");

    await expect(
      database.query("select * from public.ingestion_runs"),
    ).rejects.toThrow();
    await expect(
      database.query("select * from public.ingestion_run_events"),
    ).rejects.toThrow();
    await expect(
      database.query("select * from public.ingestion_review_items"),
    ).rejects.toThrow();
    await expect(
      database.query("select * from public.source_connectors"),
    ).rejects.toThrow();
    await expect(
      database.query("select * from public.source_publication_captures"),
    ).rejects.toThrow();
  });
});
