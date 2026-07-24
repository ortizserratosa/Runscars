import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseAwardsWatchFixture,
  parseGuardianFixture,
  parseManualManifest,
  parseRogerEbertFixture,
  prepareBatch,
} from "../../../supabase/functions/_shared/ingestion/core.mjs";
import {
  persistBatch,
  runConnectorSet,
} from "../../../supabase/functions/_shared/ingestion/repository.mjs";
import { CONNECTORS } from "../../../supabase/functions/_shared/ingestion/connectors.mjs";

const fixtureDirectory = path.resolve(
  import.meta.dirname,
  "../fixtures/ingestion",
);
const capturedAt = "2026-07-24T15:00:00Z";
const films = [
  {
    id: "the-odyssey",
    title: "The Odyssey",
    alternate_titles: [],
  },
  {
    id: "project-hail-mary",
    title: "Project Hail Mary",
    alternate_titles: [],
  },
  {
    id: "dune-part-three",
    title: "Dune: Part Three",
    alternate_titles: ["Dune: Messiah"],
  },
  { id: "la-bola-negra", title: "La Bola Negra", alternate_titles: [] },
  { id: "digger", title: "Digger", alternate_titles: [] },
  { id: "fjord", title: "Fjord", alternate_titles: [] },
  { id: "wild-horse-nine", title: "Wild Horse Nine", alternate_titles: [] },
  {
    id: "sense-and-sensibility",
    title: "Sense and Sensibility",
    alternate_titles: [],
  },
  { id: "behemoth", title: "Behemoth!", alternate_titles: [] },
  { id: "fatherland", title: "Fatherland", alternate_titles: [] },
];

async function fixture(name: string) {
  return readFile(path.join(fixtureDirectory, name), "utf8");
}

class MemoryRepository {
  runs = new Map();
  observations = new Map();
  captures = new Map();
  reviews = new Map();
  events: Array<{ runId: number; level: string; code: string }> = [];
  nextRun = 1;
  nextPublication = 1;

  async beginRun(values: { connectorId: string }) {
    const id = this.nextRun++;
    this.runs.set(id, { ...values, status: "running" });
    return id;
  }
  async filmIdentities() {
    return films;
  }
  async savePublication() {
    return this.nextPublication++;
  }
  async saveCapture(
    _batch: unknown,
    publicationId: number,
    publication: { contentHash: string },
  ) {
    const key = `${publicationId}:${publication.contentHash}`;
    if (!this.captures.has(key)) this.captures.set(key, this.captures.size + 1);
    return this.captures.get(key);
  }
  async saveObservation({
    observation,
  }: {
    observation: { dedupeKey: string };
  }) {
    if (this.observations.has(observation.dedupeKey)) {
      return {
        id: this.observations.get(observation.dedupeKey),
        inserted: false,
      };
    }
    const id = this.observations.size + 1;
    this.observations.set(observation.dedupeKey, id);
    return { id, inserted: true };
  }
  async saveReviewItem({
    observation,
  }: {
    observation: { review: { queueKey: string } };
  }) {
    if (this.reviews.has(observation.review.queueKey)) return false;
    this.reviews.set(observation.review.queueKey, this.reviews.size + 1);
    return true;
  }
  async addEvent(runId: number, level: string, code: string) {
    this.events.push({ runId, level, code });
  }
  async finishRun(runId: number, result: { status: string }) {
    this.runs.set(runId, { ...this.runs.get(runId), ...result });
  }
  async markConnector() {}
}

describe("professional ingestion adapters", () => {
  it("parses Guardian JSON without copying article bodies", async () => {
    const batch = parseGuardianFixture(
      JSON.parse(await fixture("guardian.json")),
      { capturedAt },
    );

    expect(batch.publications).toHaveLength(2);
    expect(batch.publications[0].observations).toHaveLength(2);
    expect(batch.publications[0].originalData).toEqual(
      expect.objectContaining({ star_rating: "4" }),
    );
    expect(batch.publications[0].originalData).not.toHaveProperty("body");
  });

  it("limits scheduled Guardian discovery to the season catalog", async () => {
    const payload = JSON.parse(await fixture("guardian.json"));
    const batch = await CONNECTORS["guardian-content-api"]({
      connector: {
        endpoint_url: "https://content.guardianapis.com/search",
        configuration: {
          season_id: "oscars-2027",
          catalog_only: true,
        },
      },
      capturedAt,
      secrets: { GUARDIAN_CONTENT_API_KEY: "fixture-key" },
      filmIdentities: films,
      fetcher: async () =>
        ({
          ok: true,
          json: async () => payload,
        }) as Response,
    });

    expect(batch.publications).toHaveLength(1);
    expect(batch.publications[0].observations).toHaveLength(2);
    expect(batch.publications[0].observations[0].subject).toBe("The Odyssey");
  });

  it("keeps only review URLs from the RogerEbert RSS fixture", async () => {
    const batch = parseRogerEbertFixture(await fixture("roger-ebert.xml"), {
      capturedAt,
    });

    expect(batch.publications).toHaveLength(1);
    expect(batch.publications[0].observations[0].subject).toBe(
      "Project Hail Mary",
    );
  });

  it("extracts the ordered Best Picture list from AwardsWatch HTML", async () => {
    const batch = parseAwardsWatchFixture(await fixture("awardswatch.html"), {
      capturedAt,
      endpointUrl:
        "https://awardswatch.com/2027-oscar-predictions-best-picture-and-best-director-june/",
    });

    expect(batch.publications[0].observations).toHaveLength(10);
    expect(batch.publications[0].observations[0].originalValue).toEqual({
      rank: 1,
      list_length: 10,
      raw: "1. The Odyssey (Universal Pictures)",
    });
    expect(batch.publications[0].author).toBe("Erik Anderson");
  });

  it("accepts a versioned manual manifest and preserves aggregate semantics", async () => {
    const manifest = JSON.parse(await fixture("manual.json"));
    const batch = parseManualManifest(manifest, { capturedAt });

    expect(batch.publications[0].observations[0]).toEqual(
      expect.objectContaining({
        dataType: "score_aggregate",
        filmId: "the-odyssey",
        participates: false,
      }),
    );
  });

  it("matches exact alternate titles and queues an unknown subject", async () => {
    const awards = parseAwardsWatchFixture(await fixture("awardswatch.html"), {
      capturedAt,
      endpointUrl:
        "https://awardswatch.com/2027-oscar-predictions-best-picture-and-best-director-june/",
    });
    const preparedAwards = await prepareBatch(awards, films);
    const dune = preparedAwards.publications[0].observations.find(
      (observation: { subject: string }) =>
        observation.subject === "Dune: Messiah",
    );
    expect(dune).toEqual(
      expect.objectContaining({
        filmId: "dune-part-three",
        state: "published",
      }),
    );

    const guardian = parseGuardianFixture(
      JSON.parse(await fixture("guardian.json")),
      { capturedAt },
    );
    const preparedGuardian = await prepareBatch(guardian, films);
    expect(preparedGuardian.publications[1].observations[0]).toEqual(
      expect.objectContaining({
        filmId: null,
        participates: false,
        state: "pending_review",
        review: expect.objectContaining({ kind: "film_match" }),
      }),
    );
  });

  it("reimports the same observations without duplicates", async () => {
    const batch = parseAwardsWatchFixture(await fixture("awardswatch.html"), {
      capturedAt,
      endpointUrl:
        "https://awardswatch.com/2027-oscar-predictions-best-picture-and-best-director-june/",
    });
    const repository = new MemoryRepository();

    const first = await persistBatch({
      batch,
      repository,
      runId: await repository.beginRun({ connectorId: batch.connectorId }),
    });
    const second = await persistBatch({
      batch,
      repository,
      runId: await repository.beginRun({ connectorId: batch.connectorId }),
    });

    expect(first.observationsInserted).toBe(10);
    expect(second.observationsInserted).toBe(0);
    expect(second.observationsDuplicate).toBe(10);
    expect(repository.observations).toHaveLength(10);
  });

  it("continues with the next connector after an isolated failure", async () => {
    const repository = new MemoryRepository();
    const emptyBatch = {
      connectorId: "healthy",
      sourceId: "awardswatch",
      extractorVersion: "test-v1",
      seasonId: "oscars-2027",
      capturedAt,
      sourceUrl: "https://example.com/",
      publications: [],
    };
    const results = await runConnectorSet({
      connectors: [{ id: "broken" }, { id: "healthy" }],
      registry: {
        broken: async () => {
          throw new Error("fixture failure");
        },
        healthy: async () => emptyBatch,
      },
      repository,
      trigger: "fixture",
      now: () => new Date(capturedAt),
    });

    expect(results.map((result) => result.status)).toEqual([
      "failed",
      "succeeded",
    ]);
    expect(repository.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "error", code: "connector.failed" }),
        expect.objectContaining({ level: "info", code: "connector.completed" }),
      ]),
    );
  });
});
