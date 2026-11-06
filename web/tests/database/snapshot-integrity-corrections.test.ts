import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
let database: PGlite;

beforeAll(async () => {
  database = new PGlite();
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
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await database.exec(await readFile(path.join(directory, file), "utf8"));
  }
  await database.exec(
    await readFile(path.join(root, "supabase/seed.sql"), "utf8"),
  );
  for (const [index, id] of ["integrity-first", "integrity-second"].entries()) {
    const payload = {
      schemaVersion: "runscars-snapshot-v2",
      kind: "periodic",
      seasonId: "oscars-2027",
      categoryId: "best-picture",
      intention: "nomination",
      methodVersion: "runscars-aggregation-v4",
      aggregate: { fixture: true },
      includedObservationIds: [],
      excludedObservationIds: [],
      activeSourceIds: ["awardswatch"],
      selectedCandidateIds: [],
    };
    await database.query(
      `insert into public.aggregate_snapshots
      (id,season_id,category_id,prediction_intention,kind,cutoff_at,time_zone,
        method_version,schema_version,content_hash,payload,active_source_ids,locked_at,locked_by)
      values ($1,'oscars-2027','best-picture','nomination','periodic','2026-11-04T04:47:00Z','UTC',
        'runscars-aggregation-v4','runscars-snapshot-v2',$2,$3::jsonb,array['awardswatch'],
        '2026-11-04T04:47:00Z','fixture')`,
      [id, String(index + 1).repeat(64), JSON.stringify(payload)],
    );
  }
  await database.exec(`insert into public.snapshot_integrity_corrections
    (snapshot_id,reason,corrected_at)
    values ('integrity-first','Importación incompleta','2026-11-06T13:00:00Z');`);
});

afterAll(async () => {
  await database?.close();
});

async function asRole<T>(role: string, action: () => Promise<T>) {
  await database.exec(`set role ${role}`);
  try {
    return await action();
  } finally {
    await database.exec("reset role");
  }
}

describe("additive snapshot integrity corrections", () => {
  it.each(["anon", "authenticated"])(
    "publishes only the correction notice and denies writes to %s",
    async (role) => {
      const result = await asRole(role, () =>
        database.query<Record<string, unknown>>(
          "select * from public.snapshot_integrity_corrections",
        ),
      );
      expect(result.rows).toHaveLength(1);
      expect(Object.keys(result.rows[0]).sort()).toEqual([
        "corrected_at",
        "reason",
        "snapshot_id",
      ]);
      await expect(
        asRole(role, () =>
          database.exec(`insert into public.snapshot_integrity_corrections
            (snapshot_id,reason) values ('integrity-second','Unauthorized')`),
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);
    },
  );

  it("allows the editorial service to append a correction without mutating the locked snapshot", async () => {
    const before = await database.query(
      "select id,content_hash,payload from public.aggregate_snapshots order by id",
    );
    await asRole("service_role", () =>
      database.exec(`insert into public.snapshot_integrity_corrections
        (snapshot_id,reason) values ('integrity-second','Importación incompleta')`),
    );
    expect(
      (
        await asRole("anon", () =>
          database.query(
            "select snapshot_id from public.snapshot_integrity_corrections",
          ),
        )
      ).rows,
    ).toHaveLength(2);
    expect(
      (
        await database.query(
          "select id,content_hash,payload from public.aggregate_snapshots order by id",
        )
      ).rows,
    ).toEqual(before.rows);
    await expect(
      database.exec(
        "update public.snapshot_integrity_corrections set reason='Changed'",
      ),
    ).rejects.toThrow(/immutable/);
    await expect(
      database.exec("delete from public.snapshot_integrity_corrections"),
    ).rejects.toThrow(/immutable/);
  });
});
