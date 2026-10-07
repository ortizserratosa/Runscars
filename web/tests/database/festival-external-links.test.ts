import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import manifest from "../../data/festivals/2026-supplement-2026-10-07.json";
import { prepareFestivalSet } from "../../../supabase/functions/_shared/festivals/core.mjs";

const root = path.resolve(import.meta.dirname, "../../..");

describe("separate append-only festival external identities", () => {
  let database: PGlite;
  let entryId: number;
  let originalSourceUrl: string;
  let originalSetId: string;
  let baseline: unknown;
  const payload = (
    hash: string,
    capturedAt = "2026-10-07T12:00:00Z",
    imdbId = "tt35504660",
  ) => ({
    entryId,
    status: "confirmed",
    tmdbId: 1470198,
    imdbId,
    sourceUrl: "https://api.themoviedb.org/3/movie/1470198",
    originalSourceUrl,
    capturedAt,
    method: "exact-source-title-director-tmdb-external-ids",
    contentHash: hash.repeat(64),
    evidence: {
      claim: { officialTitles: ["Bedford Park"], directors: ["Stephanie Ahn"] },
      matchedTitle: "Bedford Park",
      matchedDirectors: ["Stephanie Ahn"],
    },
    originalData: {
      id: 1470198,
      title: "Bedford Park",
      imdb_id: imdbId,
      directors: ["Stephanie Ahn"],
    },
  });
  const persist = (value: unknown) =>
    database.query<{ result: { status: string; historyId: number } }>(
      "select public.persist_festival_external_link($1::jsonb) as result",
      [JSON.stringify(value)],
    );
  const counts = () =>
    database.query(
      "select (select count(*)::int from public.films) films, (select count(*)::int from public.season_films) season_films, (select count(*)::int from public.category_candidates) candidates, (select count(*)::int from public.professional_observations) observations",
    );

  beforeAll(async () => {
    database = new PGlite();
    await database.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;`);
    for (const file of (await readdir(path.join(root, "supabase/migrations")))
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      await database.exec(
        await readFile(path.join(root, "supabase/migrations", file), "utf8"),
      );
    }
    const source = manifest.sets.find(
      (set) => set.editionId === "sundance-2026" && set.kind === "selection",
    )!;
    const prepared = await prepareFestivalSet(
      { ...source, entries: source.entries.slice(0, 1) },
      [],
    );
    await database.query("select public.persist_festival_set($1::jsonb)", [
      JSON.stringify(prepared),
    ]);
    const stored = (
      await database.query<{ id: number; set_id: string; source_url: string }>(
        "select e.id,e.set_id,s.source_url from public.festival_entries e join public.festival_sets s on s.id=e.set_id where s.edition_id='sundance-2026' limit 1",
      )
    ).rows[0];
    originalSetId = stored.set_id;
    originalSourceUrl = stored.source_url;
    entryId = stored.id;
    baseline = (await counts()).rows;
  }, 120_000);
  afterAll(async () => {
    await database?.close();
  });

  it("confirms a movie outside the Oscar catalogue without creating films or eligibility", async () => {
    const first = await persist(payload("a"));
    expect(first.rows[0].result.status).toBe("inserted");
    expect((await counts()).rows).toEqual(baseline);
    expect(
      (
        await database.query(
          "select film_id from public.festival_entries where id=$1",
          [entryId],
        )
      ).rows[0],
    ).toEqual({ film_id: null });
    expect(
      (
        await database.query(
          "select imdb_id from public.public_festival_external_links",
        )
      ).rows,
    ).toEqual([{ imdb_id: "tt35504660" }]);
    expect((await persist(payload("a"))).rows[0].result.status).toBe(
      "duplicate",
    );
  });

  it("preserves the current confirmed link across pending, old confirmations and repeated old content", async () => {
    const pending = {
      ...payload("b"),
      status: "pending_review",
      tmdbId: null,
      imdbId: null,
      method: "ambiguous-exact-title-director",
      originalData: {},
      evidence: {
        reason: "ambiguous",
        candidates: [{ tmdbId: 1 }, { tmdbId: 2 }],
      },
    };
    await persist(pending);
    await persist(payload("c", "2026-10-06T12:00:00Z", "tt00000001"));
    await persist(payload("a"));
    expect(
      (
        await database.query(
          "select imdb_id from public.public_festival_external_links",
        )
      ).rows,
    ).toEqual([{ imdb_id: "tt35504660" }]);
    expect(
      (
        await database.query(
          "select count(*)::int count from public.festival_entry_external_link_history",
        )
      ).rows[0],
    ).toEqual({ count: 3 });
  });

  it("rejects malformed confirmed IDs and false original provenance", async () => {
    await expect(
      persist({
        ...payload("d"),
        tmdbId: null,
        imdbId: null,
        originalData: { id: null, imdb_id: null },
      }),
    ).rejects.toThrow(/festival_external_identity_shape/);
    await expect(
      persist({
        ...payload("d"),
        imdbId: "javascript:bad",
        originalData: { id: 1470198, imdb_id: "javascript:bad" },
      }),
    ).rejects.toThrow(/festival_external_identity_shape/);
    await expect(
      persist({
        ...payload("d"),
        originalSourceUrl: "https://unrelated.example",
      }),
    ).rejects.toThrow(/procedencia original/);
    await expect(persist({ ...payload("d"), evidence: {} })).rejects.toThrow(
      /evidencia corroborada/,
    );
  });

  it("keeps history immutable and public access minimal while denying importer execution", async () => {
    await expect(
      database.exec(
        "update public.festival_entry_external_link_history set method='changed' where true",
      ),
    ).rejects.toThrow(/immutable/);
    await expect(
      database.exec("delete from public.festival_entry_external_link_history"),
    ).rejects.toThrow(/immutable/);
    await database.exec("set role anon");
    try {
      expect(
        (
          await database.query(
            "select entry_id, imdb_id from public.public_festival_external_links",
          )
        ).rows,
      ).toEqual([{ entry_id: entryId, imdb_id: "tt35504660" }]);
      await expect(
        database.query(
          "select * from public.festival_entry_external_link_history",
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        database.query(
          "select * from public.current_festival_entry_external_links",
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(persist(payload("d"))).rejects.toThrow(/permission denied/);
      await expect(
        database.query("delete from public.public_festival_external_links"),
      ).rejects.toThrow(
        /permission denied|not automatically updatable|cannot delete from view/,
      );
    } finally {
      await database.exec("reset role");
    }
  });

  it("publishes a newer verified version through the service role and never reactivates an old duplicate", async () => {
    await database.exec("set role service_role");
    try {
      await persist(payload("d", "2026-10-08T12:00:00Z"));
    } finally {
      await database.exec("reset role");
    }
    await persist(payload("a"));
    expect(
      (
        await database.query(
          "select captured_at::text from public.public_festival_external_links",
        )
      ).rows[0],
    ).toEqual({ captured_at: "2026-10-08 12:00:00+00" });
  });

  it("hides links when the festival source is withdrawn and when a new receipt becomes current", async () => {
    await database.exec(
      "update public.sources set publication_status='replace-before-publish' where id='sundance'",
    );
    expect(
      (
        await database.query(
          "select * from public.public_festival_external_links",
        )
      ).rows,
    ).toEqual([]);
    await database.exec(
      "update public.sources set publication_status='publishable' where id='sundance'",
    );
    expect(
      (
        await database.query(
          "select imdb_id from public.public_festival_external_links",
        )
      ).rows,
    ).toHaveLength(1);
    await database.query(
      "delete from public.current_festival_sets where set_id=$1",
      [originalSetId],
    );
    expect(
      (
        await database.query(
          "select * from public.public_festival_external_links",
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await database.query(
          "select count(*)::int count from public.festival_entry_external_link_history",
        )
      ).rows[0],
    ).toEqual({ count: 4 });
  });
});
