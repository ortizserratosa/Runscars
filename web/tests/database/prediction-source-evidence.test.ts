import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
let database: PGlite;
let sequence = 0;

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
  await database.exec(`insert into public.ingestion_runs (run_key,connector_id,trigger,started_at)
    values ('evidence-test','next-best-picture-predictions','fixture','2026-09-01T00:00:00Z');`);
});
afterAll(async () => {
  await database?.close();
});

async function publication(
  source: string,
  name: string,
  canonicalUrl = `https://example.com/${name}`,
) {
  const result = await database.query<{ id: number }>(
    `insert into public.source_publications
    (source_id,external_id,canonical_url,title) values ($1,$2,$3,'Prediction') returning id`,
    [source, name, canonicalUrl],
  );
  return result.rows[0].id;
}
async function capture(
  publicationId: number,
  source: string,
  date: string,
  categories: Record<string, unknown>,
  published: string | null = null,
  state = "published",
) {
  const version = ++sequence;
  const result = await database.query<{ id: number }>(
    `insert into public.source_publication_captures
    (publication_id,content_hash,source_url,original_data,captured_at,extractor_version)
    values ($1,md5($2)||md5($2),'https://example.com/prediction',$3::jsonb,$4,'test-v1') returning id`,
    [
      publicationId,
      String(version),
      JSON.stringify({
        source_id: source,
        publication_date: published,
        categories,
        private_debug: "do not publish",
      }),
      date,
    ],
  );
  for (const [category, entries] of Object.entries(categories)) {
    for (const entry of entries as Array<{
      rank: number;
      parts: { subject: string; filmSubject: string };
    }>) {
      await database.query(
        `insert into public.professional_observations
        (dedupe_key,source_id,publication_id,capture_id,run_id,season_id,film_id,category_id,data_type,prediction_intention,
          original_subject,original_value,source_url,published_at,captured_at,extractor_version,participates,state)
        values (md5($1)||md5($1),$2,$3,$4,(select id from public.ingestion_runs where run_key='evidence-test'),
          'oscars-2027','the-odyssey',$5,'prediction_ordered','nomination',$6,$7::jsonb,
          'https://example.com/prediction',$8,$9,'test-v1',$10,$11::public.professional_observation_state)`,
        [
          `${version}-${category}-${entry.rank}`,
          source,
          publicationId,
          result.rows[0].id,
          category,
          entry.parts.subject,
          JSON.stringify({
            rank: entry.rank,
            list_length: 50,
            raw: entry.parts.subject,
          }),
          published,
          date,
          state === "published",
          state,
        ],
      );
    }
  }
  return result.rows[0].id;
}
const entries = (name = "The Odyssey") => [
  { rank: 1, parts: { subject: name, filmSubject: name, peopleSubjects: [] } },
];

describe("public source prediction evidence", () => {
  it("exposes only published approved facts and preserves the full ranked tail", async () => {
    const approved = await publication("awards-radar", "public-evidence");
    await capture(
      approved,
      "awards-radar",
      "2026-10-14T04:17:00Z",
      {
        "best-picture": [
          ...entries(),
          {
            rank: 50,
            parts: {
              subject: "Original tail",
              filmSubject: "Original tail",
              peopleSubjects: [],
            },
          },
        ],
      },
      "2026-10-14T00:00:00Z",
    );
    const pending = await publication("awards-radar", "pending-evidence");
    await capture(
      pending,
      "awards-radar",
      "2026-10-19T04:17:00Z",
      { "best-picture": entries("Pending secret") },
      null,
      "pending_review",
    );
    const privateSource = await publication("awardswatch", "private-evidence");
    await capture(privateSource, "awardswatch", "2026-10-19T04:17:00Z", {
      "best-picture": entries("Private secret"),
    });
    await database.exec(
      `update public.sources set publication_status='review-before-publish' where id='awardswatch'; set role anon;`,
    );
    const result = await database.query<{
      source_id: string;
      original_subject: string;
    }>(
      `select source_id,original_subject from public.public_prediction_source_evidence order by id`,
    );
    expect(result.rows).toEqual([
      { source_id: "awards-radar", original_subject: "The Odyssey" },
      { source_id: "awards-radar", original_subject: "Original tail" },
    ]);
    const status = await database.query(
      `select original_count,matched_count from public.public_prediction_source_status where source_id='awards-radar'`,
    );
    expect(status.rows).toEqual([{ original_count: 50, matched_count: 2 }]);
    const columns = await database.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema='public' and table_name in ('public_prediction_source_evidence','public_prediction_connector_freshness')`,
    );
    for (const privateColumn of [
      "original_data",
      "configuration",
      "last_error",
      "notes",
    ]) {
      expect(columns.rows.map((row) => row.column_name)).not.toContain(
        privateColumn,
      );
    }
    await expect(
      database.query(
        `select original_data from public.source_publication_captures`,
      ),
    ).rejects.toThrow();
    await database.exec("reset role");
  });

  it("retains undated category age when other categories or screenplay credits change", async () => {
    const id = await publication("next-best-picture", "undated-evidence");
    const screenplay = [
      {
        rank: 1,
        parts: {
          subject: "Writer One — The Odyssey",
          filmSubject: "The Odyssey",
          peopleSubjects: ["Writer One"],
        },
      },
    ];
    await capture(id, "next-best-picture", "2026-09-17T04:17:00Z", {
      "best-picture": entries(),
      "original-screenplay": screenplay,
    });
    const revisedId = await publication(
      "next-best-picture",
      "undated-revision",
      "https://example.com/undated-evidence",
    );
    expect(revisedId).not.toBe(id);
    await capture(revisedId, "next-best-picture", "2026-10-19T04:17:00Z", {
      "best-picture": entries(),
      actor: entries("Changed actor"),
      "original-screenplay": [
        {
          rank: 1,
          parts: {
            ...screenplay[0].parts,
            subject: "Writer Two — The Odyssey",
            peopleSubjects: ["Writer Two"],
          },
        },
      ],
    });
    await database.exec("set role anon");
    const result = await database.query<{
      category_id: string;
      freshness_at: Date;
      captured_at: Date;
    }>(
      `select category_id,freshness_at,captured_at from public.public_prediction_source_status where source_id='next-best-picture' order by category_id`,
    );
    expect(
      result.rows.map((row) => [
        row.category_id,
        new Date(row.freshness_at).toISOString(),
        new Date(row.captured_at).toISOString(),
      ]),
    ).toEqual([
      ["actor", "2026-10-19T04:17:00.000Z", "2026-10-19T04:17:00.000Z"],
      ["best-picture", "2026-09-17T04:17:00.000Z", "2026-10-19T04:17:00.000Z"],
      [
        "original-screenplay",
        "2026-09-17T04:17:00.000Z",
        "2026-10-19T04:17:00.000Z",
      ],
    ]);
    await database.exec("reset role");
  });

  it("restarts freshness after a category disappears and later returns", async () => {
    const first = await publication(
      "midnight-critics",
      "missing-initial",
      "https://example.com/missing",
    );
    await capture(first, "midnight-critics", "2026-09-01T04:17:00Z", {
      "best-picture": entries(),
    });
    const missing = await publication(
      "midnight-critics",
      "missing-middle",
      "https://example.com/missing",
    );
    await capture(missing, "midnight-critics", "2026-10-01T04:17:00Z", {
      actor: entries("Actor"),
    });
    const returned = await publication(
      "midnight-critics",
      "missing-return",
      "https://example.com/missing",
    );
    await capture(returned, "midnight-critics", "2026-10-19T04:17:00Z", {
      "best-picture": entries(),
    });
    const result = await database.query<{ freshness_at: Date }>(
      `select freshness_at from public.public_prediction_source_status where source_id='midnight-critics' and category_id='best-picture'`,
    );
    expect(new Date(result.rows[0].freshness_at).toISOString()).toBe(
      "2026-10-19T04:17:00.000Z",
    );
  });

  it("normalizes Unicode and safely breaks continuity at invalid category evidence", async () => {
    const url = "https://example.com/normalized";
    const initial = await publication(
      "midnight-critics",
      "unicode-initial",
      url,
    );
    await capture(initial, "midnight-critics", "2026-09-01T04:17:00Z", {
      "best-picture": entries("Cafe\u0301"),
    });
    const normalized = await publication(
      "midnight-critics",
      "unicode-normalized",
      url,
    );
    await capture(normalized, "midnight-critics", "2026-10-20T04:17:00Z", {
      "best-picture": entries("Café"),
    });
    let result = await database.query<{ freshness_at: Date }>(
      `select freshness_at from public.public_prediction_source_status where publication_url=$1 and category_id='best-picture'`,
      [url],
    );
    expect(new Date(result.rows[0].freshness_at).toISOString()).toBe(
      "2026-09-01T04:17:00.000Z",
    );
    const invalid = await publication(
      "midnight-critics",
      "unicode-invalid",
      url,
    );
    await capture(invalid, "midnight-critics", "2026-10-21T04:17:00Z", {
      "best-picture": [
        { rank: "oops", parts: { subject: "Café", filmSubject: "Café" } },
      ],
    });
    const resumed = await publication(
      "midnight-critics",
      "unicode-resumed",
      url,
    );
    await capture(resumed, "midnight-critics", "2026-10-22T04:17:00Z", {
      "best-picture": entries("Café"),
    });
    result = await database.query<{ freshness_at: Date }>(
      `select freshness_at from public.public_prediction_source_status where publication_url=$1 and category_id='best-picture'`,
      [url],
    );
    expect(new Date(result.rows[0].freshness_at).toISOString()).toBe(
      "2026-10-22T04:17:00.000Z",
    );
  });

  it("resolves the newest URL revision before comparing publication dates", async () => {
    const old = await publication(
      "variety",
      "dated-old",
      "https://example.com/dated",
    );
    await capture(
      old,
      "variety",
      "2026-10-10T04:17:00Z",
      { "best-picture": entries("Old dated version") },
      "2026-10-10T00:00:00Z",
    );
    const corrected = await publication(
      "variety",
      "dated-corrected",
      "https://example.com/dated",
    );
    await capture(
      corrected,
      "variety",
      "2026-10-19T04:17:00Z",
      { "best-picture": entries("Corrected version") },
      "2026-10-09T00:00:00Z",
    );
    const result = await database.query(
      `select original_subject from public.public_prediction_source_evidence where source_id='variety' and category_id='best-picture'`,
    );
    expect(result.rows).toEqual([{ original_subject: "Corrected version" }]);
  });

  it("keeps connector incidents specific to the affected category", async () => {
    await database.exec(`update public.source_connectors set last_success_at='2026-10-19T04:17:00Z',last_failure_at=null where source_id='variety';
      update public.source_connectors set last_failure_at='2026-10-19T04:18:00Z' where id='variety-actor-predictions'; set role anon;`);
    const result = await database.query(
      `select category_id,has_current_failure from public.public_prediction_connector_freshness where source_id='variety' and category_id in ('actor','best-picture') order by category_id`,
    );
    expect(result.rows).toEqual([
      { category_id: "actor", has_current_failure: true },
      { category_id: "best-picture", has_current_failure: false },
    ]);
    await database.exec("reset role");
  });
});
