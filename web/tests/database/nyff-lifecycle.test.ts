import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const migrationName = "20261106140000_archive_completed_nyff.sql";

it("archives completed NYFF without changing its reviewed programme, pointers or automatic history", async () => {
  const database = new PGlite();
  try {
    await database.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
      $$;
      grant usage on schema auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
    `);
    const directory = path.join(root, "supabase/migrations");
    for (const file of (await readdir(directory))
      .filter((name) => name.endsWith(".sql") && name !== migrationName)
      .sort()) {
      await database.exec(await readFile(path.join(directory, file), "utf8"));
    }
    await database.exec(
      await readFile(path.join(root, "supabase/seed.sql"), "utf8"),
    );
    await database.exec(`
      update public.festival_connectors
      set last_success_at='2026-09-06T05:17:06Z',
        last_failure_at='2026-11-06T05:17:02Z', last_error='Captura parcial: 0 de 34'
      where id='festival-nyff';
      insert into public.festival_sets
        (id,edition_id,kind,version,content_hash,source_url,source_title,published_at,captured_at,raw_capture,extractor_version)
      values ('nyff-2026-selection-aaaaaaaaaaaa','nyff-2026','selection',1,repeat('a',64),
        'https://www.filmlinc.org/nyff/nyff64-lineup/','Reviewed Main Slate','2026-08-05','2026-09-03','{}','nyff-official-v1');
      insert into public.festival_entries
        (set_id,entry_order,section,original_title,original_data)
      select 'nyff-2026-selection-aaaaaaaaaaaa',i,'Main Slate','Fixture '||i,'{}'::jsonb
      from generate_series(1,34) i;
      insert into public.current_festival_sets(edition_id,kind,set_id)
      values ('nyff-2026','selection','nyff-2026-selection-aaaaaaaaaaaa');
    `);
    const programme = async () =>
      (
        await database.query(`select
          (select jsonb_agg(to_jsonb(s)) from public.festival_sets s) sets,
          (select jsonb_agg(to_jsonb(e) order by e.id) from public.festival_entries e) entries,
          (select jsonb_agg(to_jsonb(p)) from public.current_festival_sets p) pointers`)
      ).rows;
    const automatic = async () =>
      (
        await database.query(`select last_success_at,last_failure_at,last_error,
          configuration->>'archive_reviewed_at' reviewed_at
          from public.festival_connectors where id='festival-nyff'`)
      ).rows;
    const beforeProgramme = await programme();
    const beforeAutomatic = await automatic();
    const migration = await readFile(
      path.join(directory, migrationName),
      "utf8",
    );
    await database.exec(migration);
    const lifecycle = await database.query<{
      status: string;
      awards_status: string;
      is_active: boolean;
      kinds: string[];
      archived_at: string;
    }>(`select e.status,e.awards_status,c.is_active,
      c.configuration->'manual_archive_kinds' kinds,
      c.configuration->>'archived_at' archived_at
      from public.festival_editions e join public.festival_connectors c
      on c.configuration->>'edition_id'=e.id where e.id='nyff-2026'`);
    expect(lifecycle.rows[0]).toMatchObject({
      status: "completed",
      awards_status: "not_applicable",
      is_active: false,
      kinds: ["selection"],
    });
    expect(Number.isFinite(Date.parse(lifecycle.rows[0].archived_at))).toBe(
      true,
    );
    expect(await programme()).toEqual(beforeProgramme);
    expect(await automatic()).toEqual(beforeAutomatic);
    await database.exec(migration);
    expect(await programme()).toEqual(beforeProgramme);
    expect(await automatic()).toEqual(beforeAutomatic);
    expect(
      (
        await database.query(`select configuration->>'archived_at' archived_at
        from public.festival_connectors where id='festival-nyff'`)
      ).rows,
    ).toEqual([{ archived_at: lifecycle.rows[0].archived_at }]);
    await database.exec("set role anon");
    const publicState = await database.query(`select is_active,configuration
      from public.public_festival_freshness where source_id='nyff'`);
    expect(publicState.rows).toEqual([
      {
        is_active: false,
        configuration: {
          edition_id: "nyff-2026",
          manual_archive_kinds: ["selection"],
          minimum_entries: { selection: 34 },
        },
      },
    ]);
  } finally {
    await database.close();
  }
});
