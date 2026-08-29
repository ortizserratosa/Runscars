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
      `
        create role anon;
        create role authenticated;
        create role service_role;
        create schema auth;
        create table auth.users (
          id uuid primary key,
          email text,
          raw_user_meta_data jsonb not null default '{}'::jsonb
        );
        create function auth.uid()
        returns uuid
        language sql
        stable
        as $$
          select nullif(
            current_setting('request.jwt.claim.sub', true),
            ''
          )::uuid
        $$;
        grant usage on schema auth to anon, authenticated, service_role;
        grant execute on function auth.uid() to anon, authenticated, service_role;
      `,
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
      seasons: 2,
      categories: 21,
      films: 39,
      sources: 24,
      connectors: 11,
    });

    const schedules = await database.query<{
      schedules: number;
      daily_schedules: number;
    }>(`
      select
        count(*)::int as schedules,
        count(*) filter (
          where cron_expression = '47 4 * * *'
        )::int as daily_schedules
      from public.snapshot_schedules
    `);
    expect(schedules.rows[0]).toEqual({
      schedules: 8,
      daily_schedules: 8,
    });

    const awardsDaily = await database.query<{
      extractor_version: string;
      endpoint_url: string;
    }>(`
      select extractor_version, endpoint_url
      from public.source_connectors
      where id = 'awards-daily-predictions'
    `);
    expect(awardsDaily.rows[0]).toEqual({
      extractor_version: "awards-daily-v5",
      endpoint_url:
        "https://www.awardsdaily.com/wp-json/wp/v2/search?search=2027%20Oscar%20Predictions&per_page=20&_fields=id,url,title,subtype",
    });

    const marketVersions = await database.query<{
      id: string;
      extractor_version: string;
    }>(`
      select id, extractor_version
      from public.market_connectors
      order by id
    `);
    expect(marketVersions.rows).toEqual([
      { id: "kalshi-oscars", extractor_version: "kalshi-v3" },
      { id: "polymarket-oscars", extractor_version: "polymarket-v3" },
    ]);
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

    expect(result.rows[0]).toEqual({ films: 39, links: 39 });
  });

  it("allows Google signups and rejects direct email signups", async () => {
    const google = await database.query<{ result: Record<string, never> }>(`
      select public.hook_allow_google_signup_only(
        '{"user":{"app_metadata":{"provider":"google"}}}'::jsonb
      ) as result
    `);
    const email = await database.query<{
      result: { error: { http_code: number; message: string } };
    }>(`
      select public.hook_allow_google_signup_only(
        '{"user":{"app_metadata":{"provider":"email"}}}'::jsonb
      ) as result
    `);

    expect(google.rows[0]?.result).toEqual({});
    expect(email.rows[0]?.result).toEqual({
      error: {
        http_code: 403,
        message:
          "New accounts are available through Google during the public beta.",
      },
    });
  });

  it("keeps content-addressed revisions for a mutable source URL", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    await database.exec(`
      insert into public.source_publications (
        source_id,
        external_id,
        canonical_url,
        title
      )
      values
        (
          'awards-radar',
          'best-picture@aaaaaaaaaaaaaaaa',
          'https://awardsradar.com/best-picture/',
          'Best Picture · revision A'
        ),
        (
          'awards-radar',
          'best-picture@bbbbbbbbbbbbbbbb',
          'https://awardsradar.com/best-picture/',
          'Best Picture · revision B'
        );
    `);

    const result = await database.query<{ revisions: number }>(`
      select count(*)::int as revisions
      from public.source_publications
      where source_id = 'awards-radar'
        and canonical_url = 'https://awardsradar.com/best-picture/'
    `);
    expect(result.rows[0]?.revisions).toBe(2);
  });

  it("models performances, one person across films and an ordered directing team", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    await database.exec(`
      insert into public.tmdb_people (tmdb_id, last_checked_at)
      values
        (900001, '2026-07-25T12:00:00Z'),
        (900002, '2026-07-25T12:00:00Z');

      insert into public.people (id, name, tmdb_id)
      values
        ('fixture-person-one', 'Fixture Person One', 900001),
        ('fixture-person-two', 'Fixture Person Two', 900002);

      insert into public.category_candidates (
        id,
        season_id,
        category_id,
        film_id,
        display_label,
        identity_key
      )
      values
        (
          'candidate-actor-one-odyssey',
          'oscars-2027',
          'actor',
          'the-odyssey',
          'Fixture Person One — The Odyssey',
          repeat('1', 64)
        ),
        (
          'candidate-actor-two-odyssey',
          'oscars-2027',
          'actor',
          'the-odyssey',
          'Fixture Person Two — The Odyssey',
          repeat('2', 64)
        ),
        (
          'candidate-actor-one-dune',
          'oscars-2027',
          'actor',
          'dune-part-three',
          'Fixture Person One — Dune: Part Three',
          repeat('3', 64)
        ),
        (
          'candidate-directing-team',
          'oscars-2027',
          'directing',
          'the-odyssey',
          'Fixture Person One, Fixture Person Two — The Odyssey',
          repeat('4', 64)
        );

      insert into public.category_candidate_people (
        category_candidate_id,
        person_id,
        role,
        display_order
      )
      values
        ('candidate-actor-one-odyssey', 'fixture-person-one', 'Actor', 0),
        ('candidate-actor-two-odyssey', 'fixture-person-two', 'Actor', 0),
        ('candidate-actor-one-dune', 'fixture-person-one', 'Actor', 0),
        ('candidate-directing-team', 'fixture-person-one', 'Director', 0),
        ('candidate-directing-team', 'fixture-person-two', 'Director', 1);
    `);

    const result = await database.query<{
      same_film_candidates: number;
      one_person_films: number;
      team_size: number;
      team_order: string;
    }>(`
      select
        (
          select count(*)::int
          from public.category_candidates
          where category_id = 'actor' and film_id = 'the-odyssey'
        ) as same_film_candidates,
        (
          select count(distinct candidates.film_id)::int
          from public.category_candidate_people as links
          join public.category_candidates as candidates
            on candidates.id = links.category_candidate_id
          where links.person_id = 'fixture-person-one'
            and candidates.category_id = 'actor'
        ) as one_person_films,
        (
          select count(*)::int
          from public.category_candidate_people
          where category_candidate_id = 'candidate-directing-team'
        ) as team_size,
        (
          select string_agg(person_id, ',' order by display_order)
          from public.category_candidate_people
          where category_candidate_id = 'candidate-directing-team'
        ) as team_order
    `);

    expect(result.rows[0]).toEqual({
      same_film_candidates: 2,
      one_person_films: 2,
      team_size: 2,
      team_order: "fixture-person-one,fixture-person-two",
    });
  });

  it("keeps market prices append-only and outside professional observations", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    await database.exec(`
      insert into public.market_capture_runs (
        connector_id,
        run_key,
        status,
        started_at,
        finished_at
      )
      values (
        'kalshi-oscars',
        'kalshi-fixture-run',
        'succeeded',
        '2026-07-25T12:00:00Z',
        '2026-07-25T12:00:01Z'
      );

      insert into public.market_contracts (
        provider,
        source_id,
        external_market_id,
        external_contract_id,
        season_id,
        category_id,
        market_title,
        outcome_label,
        source_url,
        original_data,
        captured_at
      )
      values (
        'kalshi',
        'kalshi',
        'KXOSCARPIC-27',
        'KXOSCARPIC-27-ODYSSEY',
        'oscars-2027',
        'best-picture',
        'Oscar Best Picture winner',
        'The Odyssey',
        'https://kalshi.com/markets/kxoscarpic-27-odyssey',
        '{"last_price_dollars":"0.42"}'::jsonb,
        '2026-07-25T12:00:00Z'
      );

      insert into public.market_price_snapshots (
        contract_id,
        run_id,
        content_hash,
        probability,
        original_price,
        original_currency,
        volume,
        open_interest,
        observed_at,
        captured_at,
        original_data
      )
      select
        contracts.id,
        runs.id,
        repeat('9', 64),
        0.42,
        0.42,
        'USD',
        1200.5,
        320,
        '2026-07-25T12:00:00Z',
        '2026-07-25T12:00:00Z',
        '{"last_price_dollars":"0.42"}'::jsonb
      from public.market_contracts as contracts
      cross join public.market_capture_runs as runs
      where contracts.external_contract_id = 'KXOSCARPIC-27-ODYSSEY'
        and runs.run_key = 'kalshi-fixture-run';
    `);

    await expect(
      database.exec(`
        update public.market_price_snapshots
        set probability = 0.50
        where content_hash = repeat('9', 64)
      `),
    ).rejects.toThrow("immutable");

    await expect(
      database.exec(`
        insert into public.professional_observations (
          dedupe_key,
          source_id,
          season_id,
          data_type,
          original_subject,
          original_value,
          source_url,
          captured_at,
          extractor_version
        )
        values (
          repeat('8', 64),
          'kalshi',
          'oscars-2027',
          'market',
          'The Odyssey',
          '{"probability":0.42}'::jsonb,
          'https://kalshi.com/markets/example',
          '2026-07-25T12:00:00Z',
          'invalid-market-v1'
        )
      `),
    ).rejects.toThrow();
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

  it("exposes only attributed Metascores and keeps other aggregator data private", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    await database.exec(`
      insert into public.ingestion_runs (
        run_key,
        connector_id,
        trigger,
        status,
        started_at,
        finished_at
      ) values (
        'critical-discovery-policy-test',
        'manual-editorial',
        'fixture',
        'succeeded',
        '2026-08-25T12:00:00Z',
        '2026-08-25T12:00:01Z'
      );

      insert into public.source_publications (
        source_id,
        external_id,
        canonical_url,
        title,
        author
      ) values
        (
          'guardian',
          'guardian-discovered-review',
          'https://www.theguardian.com/film/discovered-review',
          'Discovered review',
          'Fixture Critic'
        ),
        (
          'metacritic',
          'metacritic-context',
          'https://www.metacritic.com/movie/the-odyssey-2026/',
          'The Odyssey',
          null
        ),
        (
          'rotten-tomatoes',
          'rotten-tomatoes-context',
          'https://www.rottentomatoes.com/m/the_odyssey_2026',
          'The Odyssey',
          null
        ),
        (
          'rotten-tomatoes',
          'rotten-tomatoes-blocked-review',
          'https://www.rottentomatoes.com/m/the_odyssey_2026/critics',
          'The Odyssey critic reviews',
          null
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
        '{}'::jsonb,
        '2026-08-25T12:00:00Z',
        'database-test'
      from public.source_publications
      where external_id in (
        'guardian-discovered-review',
        'metacritic-context',
        'rotten-tomatoes-context',
        'rotten-tomatoes-blocked-review'
      );

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
        original_scale,
        source_url,
        captured_at,
        extractor_version,
        participates,
        state
      )
      select
        repeat(token, 64),
        source_id,
        publications.id,
        captures.id,
        runs.id,
        'oscars-2027',
        'the-odyssey',
        kind::public.professional_observation_type,
        'The Odyssey',
        value::jsonb,
        nullif(scale, 'null')::jsonb,
        publications.canonical_url,
        '2026-08-25T12:00:00Z',
        'database-test',
        participates,
        'published'
      from (values
        ('guardian-discovered-review', 'review', '{"canonical_review_id":"guardian-discovered-review"}', 'null', 'b', false),
        ('metacritic-context', 'score_aggregate', '{"score":88,"critic_review_count":63}', '{"minimum":0,"maximum":100,"unit":"Metascore","denominator":63}', 'e', false),
        ('rotten-tomatoes-context', 'score_aggregate', '{"score":94}', '{"minimum":0,"maximum":100,"unit":"Tomatometer","denominator":500}', 'c', false),
        ('rotten-tomatoes-blocked-review', 'review', '{"canonical_review_id":"blocked"}', 'null', 'd', false)
      ) as fixtures(external_id, kind, value, scale, token, participates)
      join public.source_publications as publications
        on publications.external_id = fixtures.external_id
      join public.source_publication_captures as captures
        on captures.publication_id = publications.id
      cross join lateral (
        select id
        from public.ingestion_runs
        where run_key = 'critical-discovery-policy-test'
      ) as runs;

      insert into public.source_publication_discoveries (
        publication_id,
        discovery_source_id,
        discovery_url,
        discovered_at
      )
      select
        publications.id,
        'metacritic',
        'https://www.metacritic.com/movie/the-odyssey-2026/critic-reviews/',
        '2026-08-25T12:00:00Z'
      from public.source_publications as publications
      where publications.external_id = 'guardian-discovered-review';

      set role anon;
    `);

    const visible = await database.query<{
      source_id: string;
      data_type: string;
    }>(`
      select source_id, data_type
      from public.professional_observations
      where film_id = 'the-odyssey'
      order by source_id, data_type
    `);
    expect(visible.rows).toEqual([
      { source_id: "metacritic", data_type: "score_aggregate" },
    ]);

    await expect(
      database.query(`
        select discovery_source_id
        from public.source_publication_discoveries
      `),
    ).rejects.toThrow();

    await database.exec("reset role;");
    const statuses = await database.query<{
      id: string;
      editorial_status: string;
      publication_status: string;
    }>(`
      select id, editorial_status, publication_status
      from public.sources
      where id in ('metacritic', 'rotten-tomatoes', 'filmaffinity')
      order by id
    `);
    expect(statuses.rows).toEqual([
      {
        id: "filmaffinity",
        editorial_status: "paused",
        publication_status: "review-before-publish",
      },
      {
        id: "metacritic",
        editorial_status: "selected",
        publication_status: "review-before-publish",
      },
      {
        id: "rotten-tomatoes",
        editorial_status: "paused",
        publication_status: "review-before-publish",
      },
    ]);
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

  it("exposes only sanitized source freshness to public roles", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    await database.exec(`
      update public.source_connectors
      set
        last_success_at = '2026-08-10T04:17:00Z',
        last_failure_at = '2026-08-09T04:17:00Z',
        last_error = 'private diagnostic detail'
      where source_id = 'awardswatch';
      set role anon;
    `);

    const result = await database.query<{
      source_id: string;
      last_successful_check_at: string | Date;
      last_failure_at: string | Date;
    }>(`
      select source_id, last_successful_check_at, last_failure_at
      from public.public_source_freshness
      where source_id = 'awardswatch'
    `);
    expect(result.rows[0]?.source_id).toBe("awardswatch");
    expect(
      new Date(result.rows[0]!.last_successful_check_at).toISOString(),
    ).toBe("2026-08-10T04:17:00.000Z");
    expect(new Date(result.rows[0]!.last_failure_at).toISOString()).toBe(
      "2026-08-09T04:17:00.000Z",
    );
    await expect(
      database.query("select last_error from public.public_source_freshness"),
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

  it("isolates private community data and exposes only explicitly public rows", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    await database.exec(`
      insert into auth.users (id, email, raw_user_meta_data)
      values
        (
          '11111111-1111-4111-8111-111111111111',
          'one@example.test',
          '{"display_name":"Usuario Uno"}'::jsonb
        ),
        (
          '22222222-2222-4222-8222-222222222222',
          'two@example.test',
          '{"display_name":"Usuario Dos"}'::jsonb
        );

      insert into public.category_candidates (
        id,
        season_id,
        category_id,
        film_id,
        display_label,
        identity_key
      )
      values (
        'phase-8-the-odyssey',
        'oscars-2027',
        'best-picture',
        'the-odyssey',
        'The Odyssey',
        repeat('8', 64)
      );

      set role authenticated;
      select set_config(
        'request.jwt.claim.sub',
        '11111111-1111-4111-8111-111111111111',
        false
      );
      select public.save_my_ranking(
        'oscars-2027',
        'best-picture',
        array['phase-8-the-odyssey'],
        false
      );
      insert into public.user_film_states (user_id, film_id, status, watched_at)
      values
        (
          '11111111-1111-4111-8111-111111111111',
          'the-odyssey',
          'watched',
          '2026-08-07T12:00:00Z'
        ),
        (
          '11111111-1111-4111-8111-111111111111',
          'project-hail-mary',
          'not_watched',
          null
        );
    `);

    await database.exec(`
      select set_config(
        'request.jwt.claim.sub',
        '22222222-2222-4222-8222-222222222222',
        false
      );
    `);
    const privateRows = await database.query<{
      profiles: number;
      rankings: number;
      entries: number;
      watched: number;
      unranked: number;
    }>(`
      select
        (
          select count(*)::int
          from public.user_profiles
          where user_id = '11111111-1111-4111-8111-111111111111'
        ) as profiles,
        (
          select count(*)::int
          from public.user_rankings
          where user_id = '11111111-1111-4111-8111-111111111111'
        ) as rankings,
        (
          select count(*)::int
          from public.user_ranking_entries
          where user_id = '11111111-1111-4111-8111-111111111111'
        ) as entries,
        (
          select count(*)::int
          from public.user_film_states
          where user_id = '11111111-1111-4111-8111-111111111111'
        ) as watched
        ,(
          select count(*)::int
          from public.user_film_states
          where user_id = '11111111-1111-4111-8111-111111111111'
            and film_id = 'project-hail-mary'
        ) as unranked
    `);
    expect(privateRows.rows[0]).toEqual({
      profiles: 0,
      rankings: 0,
      entries: 0,
      watched: 0,
      unranked: 0,
    });

    const forbiddenUpdate = await database.query<{ changed: number }>(`
      with changed as (
        update public.user_rankings
        set is_public = true
        where user_id = '11111111-1111-4111-8111-111111111111'
        returning 1
      )
      select count(*)::int as changed from changed
    `);
    expect(forbiddenUpdate.rows[0]?.changed).toBe(0);

    await database.exec(`
      select set_config(
        'request.jwt.claim.sub',
        '11111111-1111-4111-8111-111111111111',
        false
      );
      update public.user_profiles
      set is_public = true
      where user_id = '11111111-1111-4111-8111-111111111111';
      update public.user_rankings
      set is_public = true
      where user_id = '11111111-1111-4111-8111-111111111111';
      select set_config(
        'request.jwt.claim.sub',
        '22222222-2222-4222-8222-222222222222',
        false
      );
    `);

    const publicRows = await database.query<{
      profiles: number;
      rankings: number;
      entries: number;
      watched: number;
      unranked: number;
    }>(`
      select
        (
          select count(*)::int
          from public.user_profiles
          where user_id = '11111111-1111-4111-8111-111111111111'
        ) as profiles,
        (
          select count(*)::int
          from public.user_rankings
          where user_id = '11111111-1111-4111-8111-111111111111'
        ) as rankings,
        (
          select count(*)::int
          from public.user_ranking_entries
          where user_id = '11111111-1111-4111-8111-111111111111'
        ) as entries,
        (
          select count(*)::int
          from public.user_film_states
          where user_id = '11111111-1111-4111-8111-111111111111'
        ) as watched
        ,(
          select count(*)::int
          from public.user_film_states
          where user_id = '11111111-1111-4111-8111-111111111111'
            and film_id = 'project-hail-mary'
        ) as unranked
    `);
    expect(publicRows.rows[0]).toEqual({
      profiles: 1,
      rankings: 1,
      entries: 1,
      watched: 1,
      unranked: 0,
    });

    await expect(
      database.exec(`
        insert into public.user_ranking_entries (
          ranking_id,
          user_id,
          season_id,
          category_id,
          category_candidate_id,
          position
        )
        select
          id,
          '22222222-2222-4222-8222-222222222222',
          season_id,
          category_id,
          'phase-8-the-odyssey',
          2
        from public.user_rankings
        where user_id = '11111111-1111-4111-8111-111111111111'
      `),
    ).rejects.toThrow();
  });

  it("restricts editorial administration and keeps an immutable idempotent audit", async () => {
    await database.exec(await readFile(seedPath, "utf8"));
    await database.exec(`
      insert into auth.users (id, email)
      values
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin@example.test'),
        ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'user@example.test');

      insert into public.editorial_admins (user_id, note)
      values (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Administrador de prueba'
      );

      set role service_role;
    `);

    const updated = await database.query<{ state: unknown }>(`
      select public.editorial_update_source(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'test-source-operation-0001',
        'academy',
        'selected',
        'automated',
        'publishable',
        'Fuente oficial comprobada',
        'Revisión editorial de prueba'
      ) as state
    `);
    expect(updated.rows[0]?.state).toMatchObject({
      id: "academy",
      publication_status: "publishable",
      notes: "Fuente oficial comprobada",
    });

    const firstAudit = await database.query<{ id: number }>(`
      select public.record_editorial_action(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'test-idempotent-operation-0001',
        'test.action',
        'source',
        'academy',
        'Motivo de prueba',
        null,
        '{"ok":true}'::jsonb
      ) as id
    `);
    const repeatedAudit = await database.query<{ id: number }>(`
      select public.record_editorial_action(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'test-idempotent-operation-0001',
        'test.action',
        'source',
        'academy',
        'Motivo de prueba',
        null,
        '{"ok":true}'::jsonb
      ) as id
    `);
    expect(repeatedAudit.rows[0]?.id).toBe(firstAudit.rows[0]?.id);

    await database.exec("reset role;");
    const actionCount = await database.query<{ actions: number }>(`
      select count(*)::int as actions
      from public.editorial_actions
      where operation_key = 'test-idempotent-operation-0001'
    `);
    expect(actionCount.rows[0]?.actions).toBe(1);

    await database.exec("set role service_role;");
    await expect(
      database.query(`
        select public.editorial_update_source(
          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          'test-source-operation-0002',
          'academy',
          'selected',
          'automated',
          'publishable',
          null,
          'Intento no autorizado'
        )
      `),
    ).rejects.toThrow("editorial administrator required");

    await database.exec("reset role;");
    await expect(
      database.exec(`
        update public.editorial_actions
        set reason = 'Motivo alterado'
        where operation_key = 'test-idempotent-operation-0001'
      `),
    ).rejects.toThrow("immutable");

    await database.exec("set role anon;");
    await expect(
      database.query("select * from public.editorial_admins"),
    ).rejects.toThrow();
    await expect(
      database.query("select * from public.editorial_actions"),
    ).rejects.toThrow();
    await expect(
      database.query(
        "select public.is_editorial_admin('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",
      ),
    ).rejects.toThrow();
  });
});
