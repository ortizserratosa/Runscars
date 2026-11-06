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
    alter default privileges in schema public grant execute on functions to anon, authenticated;
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
  complete = true,
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
  const observationIds: number[] = [];
  for (const [category, entries] of Object.entries(categories)) {
    for (const entry of entries as Array<{
      rank: number;
      parts: { subject: string; filmSubject: string };
    }>) {
      const observation = await database.query<{ id: number }>(
        `insert into public.professional_observations
        (dedupe_key,source_id,publication_id,capture_id,run_id,season_id,film_id,category_id,data_type,prediction_intention,
          original_subject,original_value,source_url,published_at,captured_at,extractor_version,participates,state)
        values (md5($1)||md5($1),$2,$3,$4,(select id from public.ingestion_runs where run_key='evidence-test'),
          'oscars-2027','the-odyssey',$5,'prediction_ordered','nomination',$6,$7::jsonb,
          'https://example.com/prediction',$8,$9,'test-v1',$10,$11::public.professional_observation_state) returning id`,
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
      observationIds.push(observation.rows[0].id);
    }
  }
  if (complete && observationIds.length > 0) {
    await database.query(
      `select public.finalize_source_capture($1,$2,$3::bigint[],$4)`,
      [result.rows[0].id, observationIds.length, observationIds, date],
    );
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
    const privateCategory = await publication(
      "awards-radar",
      "private-category",
    );
    await capture(privateCategory, "awards-radar", "2026-10-19T04:17:00Z", {
      cinematography: entries("Private category title"),
    });
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
    const categories = await database.query(
      `select distinct category_id from public.public_prediction_source_status`,
    );
    expect(categories.rows).toEqual([{ category_id: "best-picture" }]);
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

  it("keeps an undated legacy URL from replacing a dated publication", async () => {
    const dated = await publication(
      "variety",
      "dated-current",
      "https://example.com/dated-current",
    );
    await capture(
      dated,
      "variety",
      "2026-11-01T04:17:00Z",
      { "best-picture": entries("Current dated prediction") },
      "2026-11-01T00:00:00Z",
    );
    const undated = await publication(
      "variety",
      "undated-legacy",
      "https://example.com/undated-legacy",
    );
    await capture(undated, "variety", "2026-11-06T04:17:00Z", {
      "best-picture": entries("Legacy prediction checked later"),
    });
    const result = await database.query(
      `select original_subject from public.public_prediction_source_evidence where source_id='variety' and category_id='best-picture'`,
    );
    expect(result.rows).toEqual([
      { original_subject: "Current dated prediction" },
    ]);
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

  it("keeps a newer unfinished capture out of evidence until every row is committed", async () => {
    const old = await publication(
      "ankler",
      "complete-old",
      "https://example.com/atomic",
    );
    await capture(
      old,
      "ankler",
      "2026-11-02T04:17:00Z",
      {
        "best-picture": entries("Previous complete prediction"),
      },
      "2026-11-02T00:00:00Z",
    );
    const newer = await publication(
      "ankler",
      "incomplete-new",
      "https://example.com/atomic",
    );
    const unfinished = await capture(
      newer,
      "ankler",
      "2026-11-04T04:17:00Z",
      {
        "best-picture": entries("Dune: Part Three"),
      },
      "2026-11-03T00:00:00Z",
      "published",
      false,
    );
    const read = () =>
      database.query<{ original_subject: string }>(
        `select original_subject from public.public_prediction_source_evidence where source_id='ankler' and category_id='best-picture'`,
      );
    expect((await read()).rows).toEqual([
      { original_subject: "Previous complete prediction" },
    ]);
    await database.exec("set role anon");
    expect(
      (
        await database.query(
          `select id from public.professional_observations where capture_id=$1`,
          [unfinished],
        )
      ).rows,
    ).toEqual([]);
    await database.exec("reset role");
    const ids = await database.query<{ id: number }>(
      `select id from public.professional_observations where capture_id=$1`,
      [unfinished],
    );
    await expect(
      database.query(
        `select public.finalize_source_capture($1,2,$2::bigint[],$3)`,
        [unfinished, ids.rows.map((row) => row.id), "2026-11-04T04:18:00Z"],
      ),
    ).rejects.toThrow("distinct expected");
    expect((await read()).rows).toEqual([
      { original_subject: "Previous complete prediction" },
    ]);
    const parameters = [
      unfinished,
      1,
      ids.rows.map((row) => row.id),
      "2026-11-04T04:18:00Z",
    ];
    expect(
      (
        await database.query<{ finalized: boolean }>(
          `select public.finalize_source_capture($1,$2,$3::bigint[],$4) as finalized`,
          parameters,
        )
      ).rows[0].finalized,
    ).toBe(true);
    expect(
      (
        await database.query<{ finalized: boolean }>(
          `select public.finalize_source_capture($1,$2,$3::bigint[],$4) as finalized`,
          parameters,
        )
      ).rows[0].finalized,
    ).toBe(false);
    expect((await read()).rows).toEqual([
      { original_subject: "Dune: Part Three" },
    ]);
    await database.exec("set role anon");
    await expect(
      database.query(`select * from public.source_capture_completions`),
    ).rejects.toThrow("permission denied");
    await expect(
      database.query(
        `select public.finalize_source_capture($1,$2,$3::bigint[],$4)`,
        parameters,
      ),
    ).rejects.toThrow("permission denied");
    await database.exec("reset role");
  });

  it("allows reused observation IDs only from the same publication and verifies the receipt length", async () => {
    const pub = await publication("the-rolling-tape", "capture-reuse");
    const original = await capture(
      pub,
      "the-rolling-tape",
      "2026-11-05T04:17:00Z",
      {
        "best-picture": entries("Reused observation"),
      },
      null,
      "published",
      false,
    );
    const ids = await database.query<{ id: number }>(
      `select id from public.professional_observations where capture_id=$1`,
      [original],
    );
    const next = await database.query<{ id: number }>(
      `insert into public.source_publication_captures(publication_id,content_hash,source_url,original_data,captured_at,extractor_version)
       values ($1,repeat('d',64),'https://example.com/reuse','{"rows":[{},{}]}','2026-11-06T04:17:00Z','test-v2') returning id`,
      [pub],
    );
    await expect(
      database.query(
        `select public.finalize_source_capture($1,1,$2::bigint[],'2026-11-06T04:18:00Z')`,
        [next.rows[0].id, ids.rows.map((row) => row.id)],
      ),
    ).rejects.toThrow("expects 2");
    const sameLength = await database.query<{ id: number }>(
      `insert into public.source_publication_captures(publication_id,content_hash,source_url,original_data,captured_at,extractor_version)
       values ($1,repeat('e',64),'https://example.com/reuse','{"rows":[{}]}','2026-11-06T04:17:00Z','test-v2') returning id`,
      [pub],
    );
    await database.query(
      `select public.finalize_source_capture($1,1,$2::bigint[],'2026-11-06T04:18:00Z')`,
      [sameLength.rows[0].id, ids.rows.map((row) => row.id)],
    );
    const count = await database.query<{ count: number }>(
      `select count(*)::integer as count from public.completed_professional_observations where id=$1`,
      [ids.rows[0].id],
    );
    expect(count.rows[0].count).toBe(1);
    const cohort = await database.query<{
      capture_id: number;
      captured_at: Date;
      extractor_version: string;
    }>(
      `select capture_id,captured_at,extractor_version from public.completed_professional_observations where id=$1`,
      [ids.rows[0].id],
    );
    expect(cohort.rows[0].capture_id).toBe(sameLength.rows[0].id);
    expect(new Date(cohort.rows[0].captured_at).toISOString()).toBe(
      "2026-11-06T04:17:00.000Z",
    );
    expect(cohort.rows[0].extractor_version).toBe("test-v2");
    await database.exec("set role anon");
    const evidence = await database.query<{
      original_subject: string;
      captured_at: Date;
      extractor_version: string;
    }>(
      `select original_subject,captured_at,extractor_version from public.public_prediction_source_evidence where source_id='the-rolling-tape'`,
    );
    expect(evidence.rows).toHaveLength(1);
    expect(evidence.rows[0].original_subject).toBe("Reused observation");
    expect(new Date(evidence.rows[0].captured_at).toISOString()).toBe(
      "2026-11-06T04:17:00.000Z",
    );
    expect(evidence.rows[0].extractor_version).toBe("test-v2");
    await database.exec("reset role");
  });
});
