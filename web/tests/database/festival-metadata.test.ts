import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import manifest from "../../data/festivals/2026-supplement-2026-10-07.json";
import { prepareFestivalSet } from "../../../supabase/functions/_shared/festivals/core.mjs";
import { prepareFestivalMovieMetadata } from "../../../supabase/functions/_shared/festivals/metadata.mjs";
import { buildMovieSnapshot } from "../../src/lib/tmdb/catalog.mjs";

const root = path.resolve(import.meta.dirname, "../../..");
type MetadataCaptureRow = {
  id: number;
  content_hash: string;
  original_data: unknown;
  source_url: string;
  fetched_at: Date;
  expires_at: Date;
};
const raw = {
  id: 1470198,
  title: "Bedford Park",
  original_title: "Bedford Park",
  overview: "Original overview",
  release_date: "2026-01-24",
  runtime: 121,
  poster_path: "/poster.jpg",
  credits: {
    crew: [
      {
        id: 10,
        name: "Stephanie Ahn",
        job: "Director",
        credit_id: "directed-by",
      },
    ],
  },
};

describe("festival metadata cache without Oscar eligibility", () => {
  let database: PGlite;
  let baseline: unknown;
  const persist = async (value: unknown) =>
    database.query<{ result: { status: string } }>(
      "select public.persist_festival_tmdb_metadata($1::jsonb) result",
      [JSON.stringify(value)],
    );
  const capture = (locale: string, at: string, overview = raw.overview) =>
    prepareFestivalMovieMetadata(
      { ...raw, overview },
      locale,
      at,
      buildMovieSnapshot,
    );
  const counts = () =>
    database.query(
      "select (select count(*)::int from public.films) films,(select count(*)::int from public.season_films) season_films,(select count(*)::int from public.category_candidates) candidates",
    );

  beforeAll(async () => {
    database = new PGlite();
    await database.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;`);
    const files = (await readdir(path.join(root, "supabase/migrations")))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files.filter(
      (file) => !file.startsWith("20261007150000"),
    ))
      await database.exec(
        await readFile(path.join(root, "supabase/migrations", file), "utf8"),
      );
    const legacy = buildMovieSnapshot(
      { ...raw, id: 770003 },
      { locale: "en-US", fetchedAt: new Date("2020-01-01T00:00:00Z") },
    );
    await database.query(
      "insert into public.tmdb_movies(tmdb_id,last_checked_at) values(770003,$1)",
      [legacy.identity.last_checked_at],
    );
    await database.query(
      "insert into public.tmdb_movie_snapshots(tmdb_id,locale,content_hash,title,original_title,original_data,source_url,fetched_at,expires_at) values(770003,'en-US',$1,$2,$2,$3::jsonb,$4,$5,$6)",
      [
        legacy.snapshot.content_hash,
        legacy.snapshot.title,
        JSON.stringify(legacy.snapshot.original_data),
        legacy.snapshot.source_url,
        legacy.snapshot.fetched_at,
        legacy.snapshot.expires_at,
      ],
    );
    await database.exec(
      await readFile(
        path.join(
          root,
          "supabase/migrations/20261007150000_festival_tmdb_metadata.sql",
        ),
        "utf8",
      ),
    );
    const source = manifest.sets.find(
      (set) => set.editionId === "sundance-2026" && set.kind === "selection",
    )!;
    await database.query("select public.persist_festival_set($1::jsonb)", [
      JSON.stringify(
        await prepareFestivalSet(
          { ...source, entries: source.entries.slice(0, 1) },
          [],
        ),
      ),
    ]);
    const stored = (
      await database.query<{ id: number; source_url: string }>(
        "select e.id,s.source_url from public.festival_entries e join public.festival_sets s on s.id=e.set_id where s.edition_id='sundance-2026' limit 1",
      )
    ).rows[0];
    await database.query(
      "select public.persist_festival_external_link($1::jsonb)",
      [
        JSON.stringify({
          entryId: stored.id,
          status: "confirmed",
          tmdbId: raw.id,
          imdbId: null,
          sourceUrl: "https://api.themoviedb.org/3/movie/1470198",
          originalSourceUrl: stored.source_url,
          capturedAt: "2026-10-07T08:00:00Z",
          method: "exact-source-title-director-tmdb-identity",
          contentHash: "a".repeat(64),
          evidence: {
            claim: { directors: ["Stephanie Ahn"] },
            matchedTitle: "Bedford Park",
            matchedDirectors: ["Stephanie Ahn"],
          },
          originalData: { id: raw.id, imdb_id: "invalid-provider-IMDb-value" },
        }),
      ],
    );
    baseline = (await counts()).rows;
  }, 120_000);
  afterAll(async () => {
    await database?.close();
  });

  it("does not rejuvenate legacy metadata and accepts confirmed TMDB with optional IMDb", async () => {
    const legacy = (
      await database.query<{
        fetched_at: Date;
        last_verified_at: Date;
        expires_at: Date;
      }>(
        "select fetched_at,last_verified_at,expires_at from public.tmdb_movie_snapshots where tmdb_id=770003",
      )
    ).rows[0];
    expect(legacy.last_verified_at).toEqual(legacy.fetched_at);
    expect(new Date(legacy.expires_at).getFullYear()).toBe(2020);
    expect(
      (
        await database.query(
          "select tmdb_id,imdb_id from public.public_festival_external_links",
        )
      ).rows,
    ).toEqual([{ tmdb_id: raw.id, imdb_id: null }]);
  });

  it("stores two locale captures through the service role without creating films/candidates", async () => {
    await database.exec("set role service_role");
    try {
      expect(
        (await persist(await capture("es-ES", "2026-10-07T08:00:00Z"))).rows[0]
          .result.status,
      ).toBe("inserted");
      expect(
        (await persist(await capture("en-US", "2026-10-07T08:00:00Z"))).rows[0]
          .result.status,
      ).toBe("inserted");
    } finally {
      await database.exec("reset role");
    }
    expect((await counts()).rows).toEqual(baseline);
    expect(
      (
        await database.query(
          "select count(*)::int count from public.tmdb_movie_snapshots where tmdb_id=1470198",
        )
      ).rows[0],
    ).toEqual({ count: 2 });
  });

  it("renews only the verified locale and preserves original capture/hash/body/URL idempotently", async () => {
    const before = (
      await database.query<MetadataCaptureRow>(
        "select id,content_hash,original_data,source_url,fetched_at,expires_at from public.tmdb_movie_snapshots where tmdb_id=1470198 and locale='es-ES'",
      )
    ).rows[0];
    const refreshed = await capture("es-ES", "2026-10-08T08:00:00Z");
    expect((await persist(refreshed)).rows[0].result.status).toBe("refreshed");
    expect((await persist(refreshed)).rows[0].result.status).toBe("duplicate");
    const after = (
      await database.query<MetadataCaptureRow>(
        "select id,content_hash,original_data,source_url,fetched_at,expires_at from public.tmdb_movie_snapshots where tmdb_id=1470198 and locale='es-ES'",
      )
    ).rows[0];
    expect({ ...after, expires_at: before.expires_at }).toEqual(before);
    expect(new Date(after.expires_at).getTime()).toBeGreaterThan(
      new Date(before.expires_at).getTime(),
    );
    expect(
      (
        await database.query(
          "select last_verified_at::text from public.tmdb_movie_snapshots where tmdb_id=1470198 and locale='en-US'",
        )
      ).rows[0],
    ).toEqual({ last_verified_at: "2026-10-07 08:00:00+00" });
  });

  it("selects a restored old hash by verification time and refuses conflicting original data", async () => {
    await persist(
      await capture("es-ES", "2026-10-09T08:00:00Z", "Changed overview"),
    );
    await persist(await capture("es-ES", "2026-10-10T08:00:00Z"));
    expect(
      (
        await database.query(
          "select overview,fetched_at::text,last_verified_at::text from public.tmdb_movie_snapshots where tmdb_id=1470198 and locale='es-ES' order by last_verified_at desc,id desc limit 1",
        )
      ).rows[0],
    ).toEqual({
      overview: raw.overview,
      fetched_at: "2026-10-07 08:00:00+00",
      last_verified_at: "2026-10-10 08:00:00+00",
    });
    const malformed = await capture("es-ES", "2026-10-11T08:00:00Z");
    malformed.snapshot.original_data.overview =
      "Different body pretending the old hash";
    await expect(persist(malformed)).rejects.toThrow(/hash conflicts/);
    expect(
      (
        await database.query(
          "select last_checked_at::text from public.tmdb_movies where tmdb_id=1470198",
        )
      ).rows[0],
    ).toEqual({ last_checked_at: "2026-10-10 08:00:00+00" });
  });

  it("exposes metadata publicly while denying public writes and uncorroborated/source-withdrawn imports", async () => {
    await database.exec("set role anon");
    try {
      expect(
        (
          await database.query(
            "select poster_path from public.tmdb_movie_snapshots where tmdb_id=1470198",
          )
        ).rows,
      ).toHaveLength(3);
      await expect(
        persist(await capture("en-US", "2026-10-11T08:00:00Z")),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await database.exec("reset role");
    }
    const unlinked = await prepareFestivalMovieMetadata(
      { ...raw, id: 999999 },
      "en-US",
      "2026-10-11T08:00:00Z",
      buildMovieSnapshot,
    );
    await expect(persist(unlinked)).rejects.toThrow(
      /lacks a current corroborated/,
    );
    await database.exec(
      "update public.sources set publication_status='replace-before-publish' where id='sundance'",
    );
    await expect(
      persist(await capture("en-US", "2026-10-11T08:00:00Z")),
    ).rejects.toThrow(/lacks a current corroborated/);
  });
});
