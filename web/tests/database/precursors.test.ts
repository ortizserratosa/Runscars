import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import manifest from "../../data/precursors/2026-2027.json";
import { preparePrecursorSet } from "../../../supabase/functions/_shared/precursors/core.mjs";

const root = path.resolve(import.meta.dirname, "../../..");

describe("precursor receipts, permissions and corrections", () => {
  let database: PGlite;
  let winnerSetId: string;
  let winnerEntryId: number;

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
    for (const set of manifest.sets) {
      const prepared = await preparePrecursorSet(set);
      await database.query("select public.persist_precursor_set($1::jsonb)", [
        JSON.stringify(prepared),
      ]);
    }
    const result = await database.query<{ id: string; entry_id: number }>(
      "select s.id, e.id as entry_id from public.precursor_sets s join public.precursor_entries e on e.set_id = s.id where s.edition_id = 'actor-awards-2026' order by e.entry_order limit 1",
    );
    winnerSetId = result.rows[0].id;
    winnerEntryId = result.rows[0].entry_id;
  }, 120_000);
  afterAll(async () => {
    await database?.close();
  });

  it("persists twelve complete receipts idempotently without creating professional observations", async () => {
    const before = await database.query<{ count: number }>(
      "select count(*)::int as count from public.professional_observations",
    );
    for (const set of manifest.sets) {
      const result = await database.query<{ result: { status: string } }>(
        "select public.persist_precursor_set($1::jsonb) as result",
        [JSON.stringify(await preparePrecursorSet(set))],
      );
      expect(result.rows[0].result.status).toBe("duplicate");
    }
    const counts = await database.query<{
      sets: number;
      entries: number;
      matches: number;
    }>(
      "select (select count(*)::int from public.precursor_sets) as sets, (select count(*)::int from public.precursor_entries) as entries, (select count(*)::int from public.current_precursor_entry_matches) as matches",
    );
    expect(counts.rows[0]).toEqual({ sets: 12, entries: 25, matches: 25 });
    expect(
      (
        await database.query(
          "select count(*)::int as count from public.professional_observations",
        )
      ).rows,
    ).toEqual(before.rows);
  });

  it("allows public reads while denying writes, importer execution and private matching metadata", async () => {
    await database.exec("set role anon");
    expect(
      (
        await database.query(
          "select count(*)::int as count from public.precursor_entries",
        )
      ).rows[0],
    ).toEqual({ count: 25 });
    await expect(
      database.query("select reason from public.precursor_entry_match_history"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      database.query("select public.persist_precursor_set('{}'::jsonb)"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      database.query("delete from public.precursor_sets"),
    ).rejects.toThrow(/permission denied/);
    await database.exec("reset role");
    expect(
      (
        await database.query<{ permitted: boolean }>(
          "select has_function_privilege('service_role', 'public.persist_precursor_set(jsonb,text)', 'EXECUTE') as permitted",
        )
      ).rows[0].permitted,
    ).toBe(true);
  });

  it("protects receipts and entry originals even against database-owner mutation", async () => {
    await expect(
      database.query(
        "update public.precursor_sets set source_title = 'overwritten' where id = $1",
        [winnerSetId],
      ),
    ).rejects.toThrow();
    await expect(
      database.query("delete from public.precursor_entries where id = $1", [
        winnerEntryId,
      ]),
    ).rejects.toThrow();
  });

  it("honours source publication controls across receipts, entries and matching", async () => {
    await database.exec(
      "update public.sources set publication_status = 'replace-before-publish' where id = 'actor-awards'; set role anon",
    );
    expect(
      (
        await database.query(
          "select count(*)::int as count from public.precursor_entries",
        )
      ).rows[0],
    ).toEqual({ count: 20 });
    expect(
      (
        await database.query(
          "select count(*)::int as count from public.current_precursor_sets where edition_id like 'actor-awards-%'",
        )
      ).rows[0],
    ).toEqual({ count: 0 });
    expect(
      (
        await database.query(
          "select count(*)::int as count from public.precursor_entry_match_history where entry_id = $1",
          [winnerEntryId],
        )
      ).rows[0],
    ).toEqual({ count: 0 });
    await database.exec(
      "reset role; update public.sources set publication_status = 'publishable' where id = 'actor-awards'",
    );
  });

  it("also rejects undated or premature winners at the SQL boundary", async () => {
    const future = await preparePrecursorSet(
      manifest.sets.find((set) => set.editionId === "actor-awards-2027")!,
    );
    const archived = await preparePrecursorSet(
      manifest.sets.find((set) => set.editionId === "actor-awards-2026")!,
    );
    await expect(
      database.query("select public.persist_precursor_set($1::jsonb)", [
        JSON.stringify({
          ...future,
          kind: "winners",
          entries: archived.entries,
        }),
      ]),
    ).rejects.toThrow(/antes de su ceremonia/);
    await expect(
      database.query("select public.persist_precursor_set($1::jsonb)", [
        JSON.stringify({
          ...future,
          kind: "winners",
          schedule: { ...future.schedule, ceremonyOn: null },
          entries: archived.entries,
        }),
      ]),
    ).rejects.toThrow(/requieren una fecha/);
  });

  it("corrects matching append-only and rejects a film from another season", async () => {
    const before = await database.query(
      "select original_title, original_data from public.precursor_entries where id = $1",
      [winnerEntryId],
    );
    await expect(
      database.query(
        "select public.match_precursor_entry($1, 'the-odyssey', 'wrong season', 'fixture')",
        [winnerEntryId],
      ),
    ).rejects.toThrow(/misma temporada/);
    await database.query(
      "select public.match_precursor_entry($1, 'sinners', 'Título corroborado en el recibo oficial', 'fixture-editor')",
      [winnerEntryId],
    );
    expect(
      (
        await database.query(
          "select original_title, original_data from public.precursor_entries where id = $1",
          [winnerEntryId],
        )
      ).rows,
    ).toEqual(before.rows);
    const history = await database.query<{ film_id: string | null }>(
      "select film_id from public.precursor_entry_match_history where entry_id = $1 order by id",
      [winnerEntryId],
    );
    expect(history.rows).toEqual([{ film_id: null }, { film_id: "sinners" }]);
  });

  it("creates a corrected version without letting a repeated old import reset its pointer", async () => {
    const set = manifest.sets.find(
      (set) => set.editionId === "actor-awards-2026",
    )!;
    const corrected = await preparePrecursorSet({
      ...set,
      coverage: {
        ...set.coverage,
        es: `${set.coverage.es} Corrección de la descripción.`,
      },
      correctsSetId: winnerSetId,
      correctionReason: "Precisión de cobertura",
    });
    const result = await database.query<{ result: { setId: string } }>(
      "select public.persist_precursor_set($1::jsonb) as result",
      [JSON.stringify(corrected)],
    );
    await database.query("select public.persist_precursor_set($1::jsonb)", [
      JSON.stringify(await preparePrecursorSet(set)),
    ]);
    const pointer = await database.query<{ set_id: string }>(
      "select set_id from public.current_precursor_sets where edition_id = 'actor-awards-2026' and kind = 'winners'",
    );
    expect(pointer.rows[0].set_id).toBe(result.rows[0].result.setId);
    expect(pointer.rows[0].set_id).not.toBe(winnerSetId);
  });
});
