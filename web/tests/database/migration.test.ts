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

    const schedules = await database.query<{ schedules: number }>(`
      select count(*)::int as schedules
      from public.snapshot_schedules
    `);
    expect(schedules.rows[0]?.schedules).toBe(1);
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

  it("keeps locked snapshots identical after later imports and links corrections", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    await database.exec(`
      update public.sources
      set publication_status = 'publishable'
      where id = 'awardswatch';

      insert into public.ingestion_runs (
        run_key,
        connector_id,
        trigger,
        status,
        started_at,
        finished_at
      )
      values (
        'snapshot-database-test',
        'awardswatch-best-picture',
        'fixture',
        'succeeded',
        '2026-07-24T15:00:00Z',
        '2026-07-24T15:01:00Z'
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
        'awardswatch',
        'snapshot-test-publication',
        'https://awardswatch.com/snapshot-test',
        'Snapshot test list',
        'Fixture Editor',
        '2026-07-23T12:00:00Z'
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
        '{"rows":[{"rank":1,"title":"The Odyssey"}]}'::jsonb,
        '2026-07-24T15:00:00Z',
        'snapshot-test-v1'
      from public.source_publications
      where external_id = 'snapshot-test-publication';

      insert into public.professional_observations (
        dedupe_key,
        source_id,
        publication_id,
        capture_id,
        run_id,
        season_id,
        film_id,
        category_id,
        data_type,
        prediction_intention,
        original_subject,
        original_value,
        source_url,
        author,
        published_at,
        captured_at,
        extractor_version,
        participates,
        state
      )
      select
        repeat('b', 64),
        'awardswatch',
        publication.id,
        capture.id,
        run.id,
        'oscars-2027',
        'the-odyssey',
        'best-picture',
        'prediction_ordered',
        'nomination',
        'The Odyssey',
        '{"rank":1,"list_length":1}'::jsonb,
        publication.canonical_url,
        publication.author,
        publication.published_at,
        capture.captured_at,
        'snapshot-test-v1',
        true,
        'published'
      from public.source_publications as publication
      join public.source_publication_captures as capture
        on capture.publication_id = publication.id
      cross join public.ingestion_runs as run
      where publication.external_id = 'snapshot-test-publication'
        and run.run_key = 'snapshot-database-test';
    `);

    const firstLock = await database.query<{ inserted: boolean }>(`
      select public.lock_aggregate_snapshot(
        snapshot_id => 'periodic-database-reference',
        snapshot_season_id => 'oscars-2027',
        snapshot_category_id => 'best-picture',
        snapshot_intention => 'nomination',
        snapshot_kind => 'periodic',
        snapshot_cutoff_at => '2026-07-23T23:59:59Z',
        snapshot_time_zone => 'Europe/Madrid',
        snapshot_method_version => 'runscars-aggregation-v1',
        snapshot_schema_version => 'runscars-snapshot-v1',
        snapshot_content_hash => repeat('c', 64),
        snapshot_payload => '{
          "schemaVersion":"runscars-snapshot-v1",
          "kind":"periodic",
          "seasonId":"oscars-2027",
          "categoryId":"best-picture",
          "intention":"nomination",
          "methodVersion":"runscars-aggregation-v1",
          "aggregate":{},
          "includedObservationIds":["1"],
          "excludedObservationIds":[],
          "activeSourceIds":["awardswatch"],
          "selectedCandidateIds":[]
        }'::jsonb,
        snapshot_active_source_ids => array['awardswatch'],
        included_observation_ids => array[
          (select id from public.professional_observations
           where dedupe_key = repeat('b', 64))
        ],
        excluded_observation_ids => '{}'::bigint[],
        snapshot_locked_at => '2026-07-24T15:02:00Z',
        snapshot_locked_by => 'database-test'
      ) as inserted
    `);
    expect(firstLock.rows[0]?.inserted).toBe(true);

    const beforeImport = await database.query<{ payload: unknown }>(`
      select payload
      from public.aggregate_snapshots
      where id = 'periodic-database-reference'
    `);

    await database.exec(`
      insert into public.professional_observations (
        dedupe_key,
        source_id,
        publication_id,
        capture_id,
        run_id,
        season_id,
        film_id,
        category_id,
        data_type,
        prediction_intention,
        original_subject,
        original_value,
        source_url,
        author,
        published_at,
        captured_at,
        extractor_version,
        participates,
        state
      )
      select
        repeat('d', 64),
        source_id,
        publication_id,
        capture_id,
        run_id,
        season_id,
        'project-hail-mary',
        category_id,
        data_type,
        prediction_intention,
        'Project Hail Mary',
        '{"rank":2,"list_length":2}'::jsonb,
        source_url,
        author,
        published_at,
        '2026-07-25T10:00:00Z',
        extractor_version,
        participates,
        state
      from public.professional_observations
      where dedupe_key = repeat('b', 64);
    `);

    const afterImport = await database.query<{
      payload: unknown;
      linked_observations: number;
    }>(`
      select
        snapshot.payload,
        count(link.observation_id)::int as linked_observations
      from public.aggregate_snapshots as snapshot
      join public.snapshot_observations as link
        on link.snapshot_id = snapshot.id
      where snapshot.id = 'periodic-database-reference'
      group by snapshot.id
    `);
    expect(afterImport.rows[0]).toEqual({
      payload: beforeImport.rows[0]?.payload,
      linked_observations: 1,
    });

    await expect(
      database.exec(`
        update public.aggregate_snapshots
        set payload = '{"mutated":true}'::jsonb
        where id = 'periodic-database-reference'
      `),
    ).rejects.toThrow("immutable");
    await expect(
      database.exec(`
        delete from public.snapshot_observations
        where snapshot_id = 'periodic-database-reference'
      `),
    ).rejects.toThrow("immutable");

    const repeatedLock = await database.query<{ inserted: boolean }>(`
      select public.lock_aggregate_snapshot(
        snapshot_id => 'periodic-database-reference',
        snapshot_season_id => 'oscars-2027',
        snapshot_category_id => 'best-picture',
        snapshot_intention => 'nomination',
        snapshot_kind => 'periodic',
        snapshot_cutoff_at => '2026-07-23T23:59:59Z',
        snapshot_time_zone => 'Europe/Madrid',
        snapshot_method_version => 'runscars-aggregation-v1',
        snapshot_schema_version => 'runscars-snapshot-v1',
        snapshot_content_hash => repeat('c', 64),
        snapshot_payload => '{}'::jsonb,
        snapshot_active_source_ids => array['awardswatch'],
        included_observation_ids => array[1]::bigint[],
        excluded_observation_ids => '{}'::bigint[],
        snapshot_locked_at => '2026-07-24T15:02:00Z',
        snapshot_locked_by => 'database-test'
      ) as inserted
    `);
    expect(repeatedLock.rows[0]?.inserted).toBe(false);

    const correction = await database.query<{ inserted: boolean }>(`
      select public.lock_aggregate_snapshot(
        snapshot_id => 'periodic-database-correction',
        snapshot_season_id => 'oscars-2027',
        snapshot_category_id => 'best-picture',
        snapshot_intention => 'nomination',
        snapshot_kind => 'periodic',
        snapshot_cutoff_at => '2026-07-23T23:59:59Z',
        snapshot_time_zone => 'Europe/Madrid',
        snapshot_method_version => 'runscars-aggregation-v1',
        snapshot_schema_version => 'runscars-snapshot-v1',
        snapshot_content_hash => repeat('e', 64),
        snapshot_payload => '{
          "schemaVersion":"runscars-snapshot-v1",
          "kind":"periodic",
          "seasonId":"oscars-2027",
          "categoryId":"best-picture",
          "intention":"nomination",
          "methodVersion":"runscars-aggregation-v1",
          "aggregate":{},
          "includedObservationIds":["1"],
          "excludedObservationIds":[],
          "activeSourceIds":["awardswatch"],
          "selectedCandidateIds":[]
        }'::jsonb,
        snapshot_active_source_ids => array['awardswatch'],
        included_observation_ids => array[
          (select id from public.professional_observations
           where dedupe_key = repeat('b', 64))
        ],
        excluded_observation_ids => '{}'::bigint[],
        snapshot_locked_at => '2026-07-25T11:00:00Z',
        snapshot_locked_by => 'database-test',
        corrected_snapshot_id => 'periodic-database-reference',
        snapshot_correction_reason => 'Se excluyó una observación mal asignada'
      ) as inserted
    `);
    expect(correction.rows[0]?.inserted).toBe(true);

    const history = await database.query<{
      snapshots: number;
      current_snapshot: string;
      corrected_snapshot: string;
    }>(`
      select
        (select count(*)::int from public.aggregate_snapshots) as snapshots,
        (
          select snapshot_id
          from public.current_aggregate_snapshots
          where season_id = 'oscars-2027'
            and category_id = 'best-picture'
            and prediction_intention = 'nomination'
            and kind = 'periodic'
        ) as current_snapshot,
        (
          select corrects_snapshot_id
          from public.aggregate_snapshots
          where id = 'periodic-database-correction'
        ) as corrected_snapshot
    `);
    expect(history.rows[0]).toEqual({
      snapshots: 2,
      current_snapshot: "periodic-database-correction",
      corrected_snapshot: "periodic-database-reference",
    });
  });

  it("stores official results with provenance and blocks public writes", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    const inserted = await database.query<{ inserted: boolean }>(`
      select public.lock_official_result_set(
        result_set_id => 'official-nominations-reference',
        result_season_id => 'oscars-2027',
        result_kind => 'nominations',
        result_source_id => 'academy',
        result_source_url => 'https://www.oscars.org/reference',
        result_author => null,
        result_published_at => '2027-01-22T13:30:00Z',
        result_captured_at => '2027-01-22T13:45:00Z',
        result_schema_version => 'runscars-snapshot-v1',
        result_content_hash => repeat('f', 64),
        result_payload => '{
          "schemaVersion":"runscars-snapshot-v1",
          "seasonId":"oscars-2027",
          "kind":"nominations",
          "source":{
            "sourceId":"academy",
            "sourceUrl":"https://www.oscars.org/reference"
          },
          "entries":[{
            "categoryId":"best-picture",
            "candidateId":"the-odyssey",
            "filmId":"the-odyssey",
            "personId":null,
            "outcome":"nominee"
          }],
          "originalData":{"fixture":true}
        }'::jsonb,
        result_locked_at => '2027-01-22T13:45:00Z',
        result_locked_by => 'database-test'
      ) as inserted
    `);
    expect(inserted.rows[0]?.inserted).toBe(true);

    await expect(
      database.exec(`
        update public.official_result_sets
        set source_url = 'https://example.com/mutated'
        where id = 'official-nominations-reference'
      `),
    ).rejects.toThrow("immutable");

    await database.exec("set role anon;");
    const publicResult = await database.query<{
      result_sets: number;
      entries: number;
    }>(`
      select
        (select count(*)::int from public.official_result_sets)
          as result_sets,
        (select count(*)::int from public.official_result_entries)
          as entries
    `);
    expect(publicResult.rows[0]).toEqual({ result_sets: 1, entries: 1 });

    await expect(
      database.query(`
        select public.lock_official_result_set(
          'unauthorized',
          'oscars-2027',
          'nominations',
          'academy',
          'https://www.oscars.org/reference',
          null,
          '2027-01-22T13:30:00Z',
          '2027-01-22T13:45:00Z',
          'runscars-snapshot-v1',
          repeat('a', 64),
          '{}'::jsonb,
          '2027-01-22T13:45:00Z',
          'anonymous'
        )
      `),
    ).rejects.toThrow();
  });
});
