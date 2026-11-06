import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const schedulePath = path.resolve(
  import.meta.dirname,
  "../../../supabase/schedules/run-ingestion-daily.sql",
);
const jobPrefix = "runscars-ingestion-daily-connector-";
const activeConnectorIds = [
  "ankler-predictions",
  "awards-daily-predictions",
  "awards-radar-predictions",
  "awardswatch-predictions",
  "guardian-content-api",
  "midnight-critics-predictions",
  "movie-state-predictions",
  "next-best-picture-predictions",
  "ringer-best-picture",
  "roger-ebert-rss",
  "rolling-tape-predictions",
  "variety-actor-predictions",
  "variety-actress-predictions",
  "variety-adapted-screenplay-predictions",
  "variety-best-picture-predictions",
  "variety-directing-predictions",
  "variety-original-screenplay-predictions",
  "variety-supporting-actor-predictions",
  "variety-supporting-actress-predictions",
];

describe("daily ingestion dispatch", () => {
  let database: PGlite;
  let scheduleSql: string;

  beforeEach(async () => {
    database = new PGlite();
    // PGlite cannot load pg_cron, pg_net or Vault. These adapters execute the
    // versioned schedule SQL and record the jobs/HTTP requests it actually emits.
    scheduleSql = (await readFile(schedulePath, "utf8")).replace(
      /^create extension if not exists [^;]+;\s*$/gm,
      "",
    );
    await database.exec(`
      create schema cron;
      create schema net;
      create schema vault;
      create table public.source_connectors (
        id text primary key,
        is_active boolean not null default false
      );
      create table vault.decrypted_secrets (
        name text primary key,
        decrypted_secret text not null
      );
      create table cron.job (
        jobid bigint generated always as identity primary key,
        jobname text unique not null,
        schedule text not null,
        command text not null
      );
      create function cron.unschedule(requested_jobid bigint)
      returns boolean language plpgsql as $$
      begin
        delete from cron.job where jobid = requested_jobid;
        return found;
      end;
      $$;
      create function cron.schedule(job_name text, expression text, sql_command text)
      returns bigint language sql as $$
        insert into cron.job (jobname, schedule, command)
        values (job_name, expression, sql_command)
        returning jobid;
      $$;
      create table net.request_queue (
        id bigint generated always as identity primary key,
        url text not null,
        headers jsonb not null,
        body jsonb not null,
        timeout_milliseconds integer not null
      );
      create function net.http_post(
        url text, headers jsonb, body jsonb, timeout_milliseconds integer
      ) returns bigint language sql as $$
        insert into net.request_queue (url, headers, body, timeout_milliseconds)
        values (url, headers, body, timeout_milliseconds)
        returning id;
      $$;
      insert into vault.decrypted_secrets values
        ('runscars_ingestion_cron_secret', 'fixture-before-rotation');
      insert into public.source_connectors values
        ${activeConnectorIds.map((id) => `('${id}', true)`).join(",")},
        ('paused-predictions', false);
    `);
  });

  afterEach(async () => {
    await database.close();
  });

  async function dispatch() {
    const { rows } = await database.query<{ command: string }>(`
      select command from cron.job where starts_with(jobname, '${jobPrefix}')
      order by schedule, jobname
    `);
    for (const row of rows) await database.exec(row.command);
  }

  it("reinstalls nineteen unique staggered jobs while retaining markets and festivals", async () => {
    await database.exec(`
      insert into cron.job (jobname, schedule, command) values
        ('runscars-ingestion-daily', '17 4 * * *', 'select 1'),
        ('runscars-ingestion-daily-connector-removed', '17 4 * * *', 'select 1'),
        ('runscars-markets-hourly', '17 * * * *', 'select 2'),
        ('runscars-festivals-daily', '17 5 * * *', 'select 3');
    `);
    await database.exec(scheduleSql);
    await database.exec(scheduleSql);

    const jobs = await database.query<{ jobname: string; schedule: string }>(`
      select jobname, schedule from cron.job order by jobname
    `);
    const ingestionJobs = jobs.rows.filter((job) =>
      job.jobname.startsWith(jobPrefix),
    );
    expect(ingestionJobs).toEqual(
      activeConnectorIds.map((id, index) => ({
        jobname: `${jobPrefix}${id}`,
        schedule: `${17 + index} 4 * * *`,
      })),
    );
    expect(new Set(ingestionJobs.map((job) => job.schedule)).size).toBe(19);
    expect(
      jobs.rows.filter((job) => !job.jobname.startsWith(jobPrefix)),
    ).toEqual([
      { jobname: "runscars-festivals-daily", schedule: "17 5 * * *" },
      { jobname: "runscars-markets-hourly", schedule: "17 * * * *" },
    ]);
    const requests = await database.query("select id from net.request_queue");
    expect(requests.rows).toEqual([]);
  });

  it("queues one source per job and reads the rotated secret at invocation time", async () => {
    await database.exec(scheduleSql);
    await database.exec(`
      update vault.decrypted_secrets
      set decrypted_secret = 'fixture-after-rotation'
      where name = 'runscars_ingestion_cron_secret';
    `);
    await dispatch();

    const { rows } = await database.query<{
      id: number;
      url: string;
      headers: Record<string, string>;
      body: { trigger: string; connectors: string[] };
      timeout_milliseconds: number;
    }>("select * from net.request_queue order by id");
    expect(rows).toHaveLength(19);
    expect(new Set(rows.map((row) => row.id)).size).toBe(19);
    expect(rows.map((row) => row.body)).toEqual(
      activeConnectorIds.map((id) => ({
        trigger: "scheduled",
        connectors: [id],
      })),
    );
    const jobs = await database.query<{ command: string }>(
      "select command from cron.job",
    );
    expect(jobs.rows.every((job) => !job.command.includes("fixture-"))).toBe(
      true,
    );
    for (const row of rows) {
      expect(row.url).toBe(
        "https://lgiqzrxeifwciykckzrn.supabase.co/functions/v1/run-ingestion",
      );
      expect(row.headers).toEqual({
        "Content-Type": "application/json",
        "x-runscars-cron-secret": "fixture-after-rotation",
      });
      expect(row.timeout_milliseconds).toBe(120000);
    }
  });

  it("applies pauses immediately and installs newly activated sources when the schedule is reapplied", async () => {
    await database.exec(scheduleSql);
    await database.exec(`
      update public.source_connectors set is_active = false where id = 'ankler-predictions';
      insert into public.source_connectors values ('new-predictions', true);
      update public.source_connectors set is_active = true
      where id = 'paused-predictions';
    `);
    await dispatch();
    const first = await database.query<{ body: { connectors: string[] } }>(
      "select body from net.request_queue order by id",
    );
    expect(first.rows.map((row) => row.body.connectors)).toEqual(
      activeConnectorIds
        .filter((id) => id !== "ankler-predictions")
        .map((id) => [id]),
    );

    await database.exec("delete from net.request_queue");
    await database.exec(scheduleSql);
    await dispatch();
    const newlyInstalled = await database.query<{
      body: { connectors: string[] };
    }>("select body from net.request_queue order by id");
    expect(newlyInstalled.rows.map((row) => row.body.connectors)).toEqual(
      [
        ...activeConnectorIds.filter((id) => id !== "ankler-predictions"),
        "new-predictions",
        "paused-predictions",
      ]
        .sort()
        .map((id) => [id]),
    );

    await database.exec(
      "update public.source_connectors set is_active = false",
    );
    await dispatch();
    const second = await database.query("select id from net.request_queue");
    expect(second.rows).toHaveLength(20);
  });
});
