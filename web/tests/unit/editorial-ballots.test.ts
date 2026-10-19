import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANKLER_BALLOT_URL,
  ROLLING_TAPE_API_URL,
  ROLLING_TAPE_BALLOT_URL,
  parseAnklerFixture,
  parseRollingTapeFixture,
  runAnklerConnector,
  runRollingTapeConnector,
} from "../../../supabase/functions/_shared/ingestion/editorial-ballots.mjs";
import {
  prepareBatch,
  validateRequiredPredictionCategories,
} from "../../../supabase/functions/_shared/ingestion/core.mjs";
import { CONNECTORS } from "../../../supabase/functions/_shared/ingestion/connectors.mjs";

const capturedAt = "2026-10-19T23:00:00Z";
const readFixture = (file: string) =>
  readFile(
    path.resolve(import.meta.dirname, "../fixtures/ingestion", file),
    "utf8",
  );
const ankler = () => readFixture("ankler-2026-10-19.html");
const rolling = async () =>
  JSON.parse(await readFixture("rolling-tape-2026-10-19.json"));
const anklerOptions = { capturedAt, endpointUrl: ANKLER_BALLOT_URL };
const rollingOptions = { capturedAt, endpointUrl: ROLLING_TAPE_API_URL };

function category(batch: ReturnType<typeof parseAnklerFixture>, id: string) {
  return batch.publications.find(
    (publication: { originalData: { category_id: string } }) =>
      publication.originalData.category_id === id,
  )!;
}

describe("independent editorial ballots", () => {
  it("registers both fixed authors as separate source connectors", () => {
    expect(CONNECTORS["ankler-predictions"]).toBe(runAnklerConnector);
    expect(CONNECTORS["rolling-tape-predictions"]).toBe(
      runRollingTapeConnector,
    );
  });

  it("reads Rosen's explicit ranks and original category dates, preserving duo identities", async () => {
    const batch = parseAnklerFixture(await ankler(), anklerOptions);
    expect(batch.sourceId).toBe("ankler");
    expect(batch.publications).toHaveLength(8);
    expect(
      batch.publications.flatMap(
        (p: { observations: unknown[] }) => p.observations,
      ),
    ).toHaveLength(45);
    expect(
      new Set(batch.publications.map((p: { author: string }) => p.author)),
    ).toEqual(new Set(["Christopher Rosen"]));
    expect(category(batch, "best-picture")).toMatchObject({
      publishedAt: "2026-10-18T00:00:00.000Z",
      canonicalUrl: ANKLER_BALLOT_URL,
    });
    expect(category(batch, "adapted-screenplay").publishedAt).toBe(
      "2026-10-10T00:00:00.000Z",
    );
    expect(category(batch, "directing").observations[1]).toMatchObject({
      filmSubject: "La Bola Negra",
      peopleSubjects: ["Javier Ambrossi", "Javier Calvo"],
      originalValue: {
        rank: 2,
        list_length: 5,
        raw: { subject: "Javier Ambrossi, Javier Calvo" },
      },
    });
    expect(
      category(batch, "original-screenplay").observations[0].peopleSubjects,
    ).toEqual([]);
  });

  it.each([
    [
      "author",
      (s: string) => s.replaceAll("Christopher Rosen", "Other Author"),
    ],
    [
      "season",
      (s: string) => s.replace("predictions for 2027", "predictions for 2028"),
    ],
    ["canonical", (s: string) => s.replace('rel="canonical"', 'rel="other"')],
    [
      "missing category",
      (s: string) =>
        s.replace("Best Adapted Screenplay", "Unrecognized Category"),
    ],
    ["duplicate rank", (s: string) => s.replace("<p>2</p>", "<p>1</p>")],
    ["missing rank", (s: string) => s.replace("<p>1</p>", "")],
    [
      "future update",
      (s: string) =>
        s.replace("Updated Oct. 18, 2026", "Updated Oct. 28, 2026"),
    ],
    [
      "invalid calendar date",
      (s: string) =>
        s.replace("Updated Oct. 18, 2026", "Updated Sep. 31, 2026"),
    ],
    [
      "missing update",
      (s: string) => s.replace("Updated Oct. 18, 2026", "Last checked today"),
    ],
  ])("rejects unverified Ankler %s", async (_label, mutate) => {
    const html = await ankler();
    expect(() => parseAnklerFixture(mutate(html), anklerOptions)).toThrow();
  });

  it("retains Jarabek's full 20/10 factual lists and dates independently of API synchronization", async () => {
    const payload = await rolling();
    const batch = parseRollingTapeFixture(payload, rollingOptions);
    expect(batch.sourceId).toBe("the-rolling-tape");
    expect(batch.publications).toHaveLength(8);
    expect(
      batch.publications.flatMap(
        (p: { observations: unknown[] }) => p.observations,
      ),
    ).toHaveLength(90);
    expect(
      category(batch, "best-picture").observations.at(-1)?.originalValue,
    ).toMatchObject({ rank: 20, list_length: 20 });
    expect(category(batch, "directing")).toMatchObject({
      canonicalUrl: ROLLING_TAPE_BALLOT_URL,
      author: "Danny Jarabek",
      publishedAt: "2026-09-23T12:40:20.000Z",
    });
    payload.last_synced = "2026-10-19T23:00:00Z";
    payload.categories.push({
      slug: "sound",
      last_updated: "2028-02-20",
      picks: [],
    });
    expect(parseRollingTapeFixture(payload, rollingOptions)).toEqual(batch);
  });

  it.each([
    "author",
    "canonical",
    "closed nominations",
    "historical view",
    "missing category",
    "duplicate category",
    "duplicate rank",
    "gap",
    "duplicate subject",
    "short list",
    "future date",
    "missing film",
  ])("rejects unverified Rolling Tape %s", async (failure) => {
    const payload = await rolling();
    if (failure === "author") payload.predictor.name = "Other Author";
    if (failure === "canonical")
      payload.predictor.profile_url = "https://other.example/profile";
    if (failure === "closed nominations") payload.nominations_locked = true;
    if (failure === "historical view") payload.historical_date = "2026-10-01";
    if (failure === "missing category") payload.categories.pop();
    if (failure === "duplicate category")
      payload.categories.push(payload.categories[0]);
    if (failure === "duplicate rank") payload.categories[0].picks[1].rank = 1;
    if (failure === "gap") payload.categories[0].picks[1].rank = 3;
    if (failure === "duplicate subject")
      payload.categories[0].picks[1].nominee =
        payload.categories[0].picks[0].nominee;
    if (failure === "short list") payload.categories[0].picks.pop();
    if (failure === "future date")
      payload.categories[0].last_updated = "2026-12-20T00:00:00Z";
    if (failure === "missing film")
      payload.categories[1].picks[0].nominee = "Christopher Nolan";
    expect(() => parseRollingTapeFixture(payload, rollingOptions)).toThrow();
  });

  it("refuses season rollover and unknown endpoints", async () => {
    const payload = await rolling();
    expect(() =>
      parseRollingTapeFixture(payload, {
        ...rollingOptions,
        ceremonyYear: 2028,
      }),
    ).toThrow();
    expect(() =>
      parseRollingTapeFixture(payload, {
        ...rollingOptions,
        capturedAt: "2027-03-20T00:00:00Z",
      }),
    ).toThrow();
    expect(() =>
      parseRollingTapeFixture(payload, {
        ...rollingOptions,
        endpointUrl: "https://other.example/api",
      }),
    ).toThrow();
  });

  it("keeps immutable identities stable on repeat checks and isolates real revisions by category", async () => {
    const payload = await rolling();
    const first = await prepareBatch(
      parseRollingTapeFixture(payload, rollingOptions),
      [],
    );
    const again = await prepareBatch(
      parseRollingTapeFixture(payload, {
        ...rollingOptions,
        capturedAt: "2026-10-20T12:00:00Z",
      }),
      [],
    );
    expect(
      again.publications.map((p: { externalId: string }) => p.externalId),
    ).toEqual(
      first.publications.map((p: { externalId: string }) => p.externalId),
    );
    payload.categories[0].picks[19].nominee = "A New Film";
    const changed = await prepareBatch(
      parseRollingTapeFixture(payload, rollingOptions),
      [],
    );
    expect(changed.publications[0].externalId).not.toBe(
      first.publications[0].externalId,
    );
    expect(changed.publications[1].externalId).toBe(
      first.publications[1].externalId,
    );
    expect(
      changed.publications[0].observations.every(
        (row: { state: string }) => row.state === "pending_review",
      ),
    ).toBe(true);
  });

  it.each(["ankler", "rolling"])(
    "runs the %s connector through ordinary public requests, preserving required coverage",
    async (source) => {
      const endpoint =
        source === "ankler" ? ANKLER_BALLOT_URL : ROLLING_TAPE_API_URL;
      const body =
        source === "ankler" ? await ankler() : JSON.stringify(await rolling());
      const requests: Array<{ url: string; headers: Headers }> = [];
      const fetcher: typeof fetch = async (input, init) => {
        requests.push({
          url: String(input),
          headers: new Headers(init?.headers),
        });
        return new Response(body);
      };
      const connector = {
        id:
          source === "ankler"
            ? "ankler-predictions"
            : "rolling-tape-predictions",
        endpoint_url: endpoint,
        configuration: { season_id: "oscars-2027", ceremony_year: 2027 },
      };
      const run =
        source === "ankler" ? runAnklerConnector : runRollingTapeConnector;
      const batch = await run({ connector, capturedAt, fetcher });
      expect(requests).toHaveLength(1);
      expect(requests[0].url).toBe(endpoint);
      expect(requests[0].headers.get("cookie")).toBeNull();
      expect(requests[0].headers.get("authorization")).toBeNull();
      validateRequiredPredictionCategories(batch, [
        "best-picture",
        "directing",
        "actor",
        "actress",
        "supporting-actor",
        "supporting-actress",
        "original-screenplay",
        "adapted-screenplay",
      ]);
      expect(Object.keys(batch.discovery.latestCategoryUrls)).toHaveLength(8);
      await expect(
        run({
          connector: { ...connector, source_id: "other" },
          capturedAt,
          fetcher,
        }),
      ).rejects.toThrow();
    },
  );
});
