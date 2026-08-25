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
import {
  discoverLatestRingerBestPictureArticle,
  discoverWordPressPredictionUrls,
  parseAwardsDailyFixture,
  parseAwardsRadarFixture,
  parseAwardsWatchArticleFixture,
  parseMidnightCriticsFixture,
  parseNextBestPictureFixture,
  parseRingerSelectionFixture,
} from "../../../supabase/functions/_shared/ingestion/professional-predictions.mjs";

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
  semanticResolutions: string[] = [];
  nextRun = 1;
  nextPublication = 1;
  publications = new Map<string, number>();

  async beginRun(values: { connectorId: string }) {
    const id = this.nextRun++;
    this.runs.set(id, { ...values, status: "running" });
    return id;
  }
  async failStaleRuns({
    connectorId,
    staleBefore,
    recoveredAt,
  }: {
    connectorId: string;
    staleBefore: string;
    recoveredAt: string;
  }) {
    let recovered = 0;
    for (const [id, run] of this.runs) {
      if (
        run.connectorId === connectorId &&
        run.status === "running" &&
        run.startedAt < staleBefore
      ) {
        this.runs.set(id, {
          ...run,
          status: "failed",
          finishedAt: recoveredAt,
          errorSummary: "abandoned",
        });
        this.events.push({
          runId: id,
          level: "error",
          code: "connector.abandoned",
        });
        recovered += 1;
      }
    }
    return recovered;
  }
  async filmIdentities() {
    return films;
  }
  async savePublication(
    batch: { sourceId: string },
    publication: { externalId: string },
  ) {
    const key = `${batch.sourceId}:${publication.externalId}`;
    if (!this.publications.has(key)) {
      this.publications.set(key, this.nextPublication++);
    }
    return this.publications.get(key);
  }
  async ensureCandidate() {}
  async saveCapture(
    _batch: unknown,
    publicationId: number,
    publication: { contentHash: string },
  ) {
    const key = `${publicationId}:${publication.contentHash}`;
    if (!this.captures.has(key)) {
      const id = this.captures.size + 1;
      this.captures.set(key, id);
      return { id, inserted: true };
    }
    return { id: this.captures.get(key), inserted: false };
  }
  async saveObservation({
    observation,
  }: {
    observation: { dedupeKey: string; state: string };
  }) {
    if (this.observations.has(observation.dedupeKey)) {
      return {
        id: this.observations.get(observation.dedupeKey),
        inserted: false,
        state: observation.state,
      };
    }
    const id = this.observations.size + 1;
    this.observations.set(observation.dedupeKey, id);
    return { id, inserted: true, state: observation.state };
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
  async resolveSemanticReviewItems({
    observation,
  }: {
    observation: { subject: string };
  }) {
    this.semanticResolutions.push(observation.subject);
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

  it.each([
    ["awards-daily-multicategory.html", parseAwardsDailyFixture],
    ["awards-radar-multicategory.html", parseAwardsRadarFixture],
    ["next-best-picture-multicategory.html", parseNextBestPictureFixture],
    ["midnight-critics-multicategory.html", parseMidnightCriticsFixture],
  ])("extracts all eight public categories from %s", async (name, parser) => {
    const batch = parser(await fixture(name), {
      connectorId: `fixture-${name}`,
      capturedAt,
      endpointUrl: "https://example.com/predictions",
      seasonId: "oscars-2027",
    });
    const categories = new Set(
      batch.publications.flatMap(
        (publication: { observations: Array<{ categoryId: string }> }) =>
          publication.observations.map((observation) => observation.categoryId),
      ),
    );
    expect(categories).toEqual(
      new Set([
        "best-picture",
        "directing",
        "actor",
        "actress",
        "supporting-actor",
        "supporting-actress",
        "original-screenplay",
        "adapted-screenplay",
      ]),
    );
  });

  it("keeps AwardsWatch people and film subjects separate", async () => {
    const batch = parseAwardsWatchArticleFixture(
      await fixture("awardswatch-actor.html"),
      {
        connectorId: "awardswatch-predictions",
        capturedAt,
        endpointUrl:
          "https://awardswatch.com/2027-oscar-predictions-best-actor-june/",
        seasonId: "oscars-2027",
        categoryId: "actor",
      },
    );
    expect(batch.publications[0].observations).toHaveLength(2);
    expect(batch.publications[0].observations[0]).toEqual(
      expect.objectContaining({
        filmSubject: "Digger",
        peopleSubjects: ["Tom Cruise"],
      }),
    );
  });

  it("normalizes source annotations without changing the original value", () => {
    const batch = parseAwardsWatchArticleFixture(
      `
        <link rel="canonical" href="https://awardswatch.com/actor/" />
        <article>
          <h2>BEST ACTOR</h2>
          <p>1. Guitarricadelafuente (Álvaro Lafuente) – La bola negra (The Black Ball) (Netflix) NEW</p>
        </article>
      `,
      {
        connectorId: "awardswatch-predictions",
        capturedAt,
        endpointUrl: "https://awardswatch.com/actor/",
        seasonId: "oscars-2027",
        categoryId: "actor",
      },
    );
    expect(batch.publications[0].observations[0]).toEqual(
      expect.objectContaining({
        filmSubject: "La bola negra",
        peopleSubjects: ["Guitarricadelafuente"],
        originalValue: expect.objectContaining({
          raw: expect.stringContaining("(Netflix) NEW"),
        }),
      }),
    );
  });

  it("recognizes common headings for structured additional categories", () => {
    const batch = parseAwardsDailyFixture(
      `
        <link rel="canonical" href="https://example.com/predictions" />
        <h2>Best Picture</h2><p>The Odyssey</p>
        <h2>Best International Feature</h2><p>Digger</p>
        <h2>Best Editing</h2><p>Fjord</p>
        <h2>Best Score</h2><p>Wild Horse Nine</p>
        <h2>Best Adapted Screenplay</h2>
        <p>Fatherland (Could be Original, will be debated)</p>
      `,
      {
        connectorId: "awards-daily-predictions",
        capturedAt,
        endpointUrl: "https://example.com/predictions",
        seasonId: "oscars-2027",
      },
    );
    expect(
      batch.publications[0].observations.map(
        (observation: { categoryId: string }) => observation.categoryId,
      ),
    ).toEqual([
      "best-picture",
      "international-feature",
      "film-editing",
      "original-score",
      "adapted-screenplay",
    ]);
    expect(batch.publications[0].observations.at(-1)).toEqual(
      expect.objectContaining({ filmSubject: "Fatherland" }),
    );
  });

  it("recognizes Awards Daily's latest compact headings and URL date", () => {
    const batch = parseAwardsDailyFixture(
      `
        <link rel="canonical" href="https://www.awardsdaily.com/2026/07/24/latest/" />
        <h1>2027 Oscar Predictions</h1>
        <p>Best Picture<br />The Odyssey<br />Project Hail Mary</p>
        <p>Director<br />Christopher Nolan, The Odyssey</p>
        <p>Actor<br />Matt Damon, The Odyssey</p>
        <p>Actress<br />Julianne Moore, The Debut</p>
        <p>Supporting Actor<br />Sam Rockwell, Wild Horse Nine</p>
        <p>Supporting Actress<br />Anne Hathaway, The Odyssey</p>
        <p>Original Screenplay<br />Fjord</p>
        <p>Adapted Screenplay<br />The Odyssey</p>
        <p>Makeup and Hair<br />Digger</p>
      `,
      {
        connectorId: "awards-daily-predictions",
        capturedAt,
        endpointUrl: "https://www.awardsdaily.com/2026/07/24/latest/",
        seasonId: "oscars-2027",
      },
    );

    expect(batch.publications[0].publishedAt).toBe("2026-07-24T00:00:00.000Z");
    expect(
      new Set(
        batch.publications[0].observations.map(
          (observation: { categoryId: string }) => observation.categoryId,
        ),
      ),
    ).toEqual(
      new Set([
        "best-picture",
        "directing",
        "actor",
        "actress",
        "supporting-actor",
        "supporting-actress",
        "original-screenplay",
        "adapted-screenplay",
        "makeup-hairstyling",
      ]),
    );
  });

  it("limits Awards Daily parsing to the article and skips alternate rows", () => {
    const batch = parseAwardsDailyFixture(
      `
        <link rel="canonical" href="https://www.awardsdaily.com/2026/08/07/latest/" />
        <div class="content-inner">
          <p>Best Picture<br />The Odyssey<br />Digger<br />Alt. Ink</p>
          <div class="video"><div><iframe title="Trailer"></iframe></div></div>
          <p>Actor<br />Matt Damon, The Odyssey</p>
          <div class="jeg_post_tags">Tags: 2027 Oscar Predictions</div>
        </div>
        <div class="post-nav">Previous Post<br />Oscar Podcast Ep: 90</div>
      `,
      {
        connectorId: "awards-daily-predictions",
        capturedAt,
        endpointUrl: "https://www.awardsdaily.com/2026/08/07/latest/",
        seasonId: "oscars-2027",
      },
    );

    expect(batch.extractorVersion).toBe("awards-daily-v3");
    expect(
      batch.publications[0].observations.map(
        (observation: { originalValue: { raw: string } }) =>
          observation.originalValue.raw,
      ),
    ).toEqual(["The Odyssey", "Digger", "Matt Damon, The Odyssey"]);
  });

  it("normalizes verified source spellings without changing raw values", () => {
    const batch = parseAwardsDailyFixture(
      `
        <link rel="canonical" href="https://www.awardsdaily.com/2026/07/24/latest/" />
        <p>Best Picture<br />The Debut<br />Dune III<br />Wewulf</p>
        <p>Director<br />Christian Mungiu, Fjord<br />Javiers, La Bola Negra<br />Los Jovis, La Bola Begra</p>
        <p>Actor<br />Sebastien Stan, Fjord<br />Cho Yeo-jong, Possible Love</p>
      `,
      {
        connectorId: "awards-daily-predictions",
        capturedAt,
        endpointUrl: "https://www.awardsdaily.com/2026/07/24/latest/",
        seasonId: "oscars-2027",
      },
    );
    const observations = batch.publications[0].observations;

    expect(
      observations.map(
        (observation: {
          filmSubject: string;
          peopleSubjects: string[];
          originalValue: { raw: string };
        }) => ({
          film: observation.filmSubject,
          people: observation.peopleSubjects,
          raw: observation.originalValue.raw,
        }),
      ),
    ).toEqual([
      { film: "The Debut", people: [], raw: "The Debut" },
      { film: "Dune: Part Three", people: [], raw: "Dune III" },
      { film: "Werwulf", people: [], raw: "Wewulf" },
      {
        film: "Fjord",
        people: ["Cristian Mungiu"],
        raw: "Christian Mungiu, Fjord",
      },
      {
        film: "La Bola Negra",
        people: ["Javier Ambrossi", "Javier Calvo"],
        raw: "Javiers, La Bola Negra",
      },
      {
        film: "La Bola Negra",
        people: ["Javier Ambrossi", "Javier Calvo"],
        raw: "Los Jovis, La Bola Begra",
      },
      {
        film: "Fjord",
        people: ["Sebastian Stan"],
        raw: "Sebastien Stan, Fjord",
      },
      {
        film: "Possible Love",
        people: ["Cho Yeo-jeong"],
        raw: "Cho Yeo-jong, Possible Love",
      },
    ]);
  });

  it("parses an updated mutable Awards Radar category page", () => {
    const batch = parseAwardsRadarFixture(
      `
        <link rel="canonical" href="https://awardsradar.com/best-actor/" />
        <h1>BEST ACTOR</h1>
        <p>2027 Oscar Predictions</p>
        <p>Updated July 20th, 2026</p>
        <p>1. Tom Cruise – Digger</p>
        <p>2. Matt Damon – The Odyssey</p>
      `,
      {
        connectorId: "awards-radar-predictions",
        capturedAt,
        endpointUrl: "https://awardsradar.com/best-actor/",
        seasonId: "oscars-2027",
        categoryId: "actor",
      },
    );

    expect(batch.publications[0].publishedAt).toBe("2026-07-20T00:00:00.000Z");
    expect(batch.publications[0].observations).toEqual([
      expect.objectContaining({
        categoryId: "actor",
        peopleSubjects: ["Tom Cruise"],
      }),
      expect.objectContaining({
        categoryId: "actor",
        peopleSubjects: ["Matt Damon"],
      }),
    ]);
  });

  it("preserves gapped source ranks with a fitting list length", () => {
    const batch = parseAwardsRadarFixture(
      `
        <link rel="canonical" href="https://awardsradar.com/best-picture/" />
        <h1>BEST PICTURE</h1>
        <p>Updated July 20th, 2026</p>
        <p>1. The Odyssey</p>
        <p>2. Project Hail Mary</p>
        <p>11. Tony</p>
      `,
      {
        connectorId: "awards-radar-predictions",
        capturedAt,
        endpointUrl: "https://awardsradar.com/best-picture/",
        seasonId: "oscars-2027",
        categoryId: "best-picture",
      },
    );

    expect(
      batch.publications[0].observations.map(
        (item: { originalValue: { list_length: number } }) =>
          item.originalValue.list_length,
      ),
    ).toEqual([11, 11, 11]);
  });

  it("discovers current articles deterministically", () => {
    expect(
      discoverWordPressPredictionUrls(
        [
          {
            subtype: "post",
            title: "2027 Oscar Predictions: July 4",
            url: "https://www.awardsdaily.com/2026/07/04/july/",
          },
          {
            subtype: "post",
            title: "2027 Oscar Predictions: July 24",
            url: "https://www.awardsdaily.com/2026/07/24/latest/",
          },
          {
            subtype: "post",
            title: "2026 Oscar Predictions",
            url: "https://www.awardsdaily.com/2025/07/24/old/",
          },
        ],
        2027,
      ),
    ).toEqual([
      "https://www.awardsdaily.com/2026/07/24/latest/",
      "https://www.awardsdaily.com/2026/07/04/july/",
    ]);

    expect(
      discoverLatestRingerBestPictureArticle(
        `<a href="/2026/03/20/oscars/oscars-2027-predictions-best-picture">A Way-Too-Early 2027 Oscars Preview</a>`,
      ),
    ).toBe(
      "https://www.theringer.com/2026/03/20/oscars/oscars-2027-predictions-best-picture",
    );
  });

  it("ingests only the newest publication needed for each Awards Daily category", async () => {
    const discoveryUrl = "https://www.awardsdaily.com/wp-json/search";
    const newestUrl = "https://www.awardsdaily.com/2026/07/24/latest/";
    const olderUrl = "https://www.awardsdaily.com/2026/07/04/older/";
    const article = (url: string, title: string) => `
      <link rel="canonical" href="${url}" />
      <h1>${title}</h1>
      <p>Best Picture<br />The Odyssey<br />Digger</p>
      <p>Actor<br />Matt Damon, The Odyssey</p>
    `;
    const responses = new Map([
      [
        discoveryUrl,
        JSON.stringify([
          {
            subtype: "post",
            title: "2027 Oscar Predictions: latest",
            url: newestUrl,
          },
          {
            subtype: "post",
            title: "2027 Oscar Predictions: older",
            url: olderUrl,
          },
        ]),
      ],
      [newestUrl, article(newestUrl, "Latest")],
      [olderUrl, article(olderUrl, "Older")],
    ]);
    const batch = await CONNECTORS["awards-daily-predictions"]({
      connector: {
        id: "awards-daily-predictions",
        endpoint_url: discoveryUrl,
        configuration: {
          season_id: "oscars-2027",
          ceremony_year: 2027,
          discovery_limit: 12,
        },
      },
      capturedAt,
      fetcher: async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = responses.get(url);
        return new Response(body ?? "", {
          status: body === undefined ? 404 : 200,
          headers: {
            "content-type":
              url === discoveryUrl ? "application/json" : "text/html",
          },
        });
      },
    });

    expect(batch.publications).toHaveLength(1);
    expect(batch.publications[0].canonicalUrl).toBe(newestUrl);
    expect(batch.publications[0].isMutable).toBe(true);
    expect(batch.discovery.supersededUrls).toEqual([olderUrl]);
  });

  it("stores each AwardsWatch extraction as an immutable content revision", async () => {
    const hqUrl = "https://awardswatch.com/oscar-predictions-hq/";
    const archiveUrl =
      "https://awardswatch.com/category/predictions/2027-oscar-predictions/";
    const categoryUrl = "https://awardswatch.com/predictions/best-picture/";
    const articleUrl =
      "https://awardswatch.com/2026/06/26/2027-oscar-predictions-best-picture/";
    const responses = new Map([
      [hqUrl, `<a href="${categoryUrl}">Best Picture</a>`],
      [
        archiveUrl,
        `<a href="${articleUrl}">2027 Oscar Predictions: Best Picture June</a>`,
      ],
      [articleUrl, await fixture("awardswatch.html")],
    ]);
    const batch = await CONNECTORS["awardswatch-predictions"]({
      connector: {
        id: "awardswatch-predictions",
        endpoint_url: hqUrl,
        configuration: {
          season_id: "oscars-2027",
          ceremony_year: 2027,
          archive_url: archiveUrl,
          category_ids: ["best-picture"],
        },
      },
      capturedAt,
      fetcher: async (input: RequestInfo | URL) => {
        const body = responses.get(String(input));
        return new Response(body ?? "", {
          status: body === undefined ? 404 : 200,
        });
      },
    });

    expect(batch.extractorVersion).toBe("awardswatch-multicategory-v4");
    expect(batch.publications).toEqual([
      expect.objectContaining({
        isMutable: true,
        observations: expect.any(Array),
      }),
    ]);
  });

  it("removes consensus markers without truncating hyphenated names", () => {
    const batch = parseMidnightCriticsFixture(
      `
        <link rel="canonical" href="https://example.com/consensus" />
        <h1>2027 Oscar Predictions</h1>
        <h2>BEST PICTURE</h2><p>1. The Odyssey- ALL</p>
        <h2>BEST ACTRESS</h2>
        <p>1. Daisy Edgar-Jones, Sense and Sensibility - Aaron, Amy</p>
      `,
      {
        connectorId: "midnight-critics-predictions",
        capturedAt,
        endpointUrl: "https://example.com/consensus",
        seasonId: "oscars-2027",
      },
    );
    expect(batch.publications[0].observations).toEqual([
      expect.objectContaining({ filmSubject: "The Odyssey" }),
      expect.objectContaining({
        peopleSubjects: ["Daisy Edgar-Jones"],
        filmSubject: "Sense and Sensibility",
      }),
    ]);
  });

  it("selects the requested section from a joint AwardsWatch article", () => {
    const batch = parseAwardsWatchArticleFixture(
      `
        <link rel="canonical" href="https://awardswatch.com/joint/" />
        <article>
          <h2>BEST PICTURE</h2>
          <p>1. The Odyssey<br />2. Digger</p>
          <h2>BEST DIRECTOR</h2>
          <p>1. Christopher Nolan – The Odyssey<br />
          2. Alejandro G. Iñárritu – Digger</p>
        </article>
      `,
      {
        connectorId: "awardswatch-predictions",
        capturedAt,
        endpointUrl: "https://awardswatch.com/joint/",
        seasonId: "oscars-2027",
        categoryId: "directing",
      },
    );

    expect(
      batch.publications[0].observations.map(
        (observation: { subject: string }) => observation.subject,
      ),
    ).toEqual([
      "Christopher Nolan – The Odyssey",
      "Alejandro G. Iñárritu – Digger",
    ]);
  });

  it("treats The Ringer as selection-only", async () => {
    const batch = parseRingerSelectionFixture(
      await fixture("ringer-best-picture.html"),
      {
        connectorId: "ringer-best-picture",
        capturedAt,
        endpointUrl: "https://www.theringer.com/fixture/oscars-2027",
        seasonId: "oscars-2027",
      },
    );
    expect(batch.publications[0].observations).toHaveLength(4);
    expect(batch.publications[0].observations[0]).toEqual(
      expect.objectContaining({
        dataType: "prediction_selection",
        participates: true,
      }),
    );
  });

  it("fails loudly when a source changes to unrecognized HTML", () => {
    expect(() =>
      parseAwardsRadarFixture("<html><body>layout changed</body></html>", {
        connectorId: "awards-radar-predictions",
        capturedAt,
        endpointUrl: "https://awardsradar.com/fixture",
        seasonId: "oscars-2027",
      }),
    ).toThrow("no contiene categorías reconocibles");
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

  it("preserves aggregator discovery without changing the original source", async () => {
    const manifest = JSON.parse(await fixture("aggregator-discovered.json"));
    const batch = parseManualManifest(manifest, { capturedAt });

    expect(batch.sourceId).toBe("guardian");
    expect(batch.publications[0].discoveredVia).toEqual([
      expect.objectContaining({ sourceId: "metacritic" }),
      expect.objectContaining({ sourceId: "rotten-tomatoes" }),
      expect.objectContaining({ sourceId: "filmaffinity" }),
    ]);
    expect(batch.publications[0].observations[1]).toEqual(
      expect.objectContaining({
        dataType: "score_individual",
        participates: true,
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

  it("builds distinct canonical candidates for two actors from one film", async () => {
    const peopleFilms = [
      {
        id: "wild-horse-nine",
        title: "Wild Horse Nine",
        alternate_titles: [],
        credits: [
          {
            role: "Actor",
            person: { id: "person-john", name: "John Malkovich" },
          },
          {
            role: "Actor",
            person: { id: "person-sam", name: "Sam Rockwell" },
          },
        ],
      },
    ];
    const batch = {
      connectorId: "fixture-actors",
      sourceId: "awardswatch",
      extractorVersion: "fixture-v1",
      seasonId: "oscars-2027",
      capturedAt,
      sourceUrl: "https://example.com/actors",
      publications: [
        {
          externalId: "actors",
          canonicalUrl: "https://example.com/actors",
          title: "Actors",
          author: null,
          publishedAt: capturedAt,
          originalData: { fixture: true },
          observations: ["John Malkovich", "Sam Rockwell"].map(
            (person, index) => ({
              dataType: "prediction_ordered",
              subject: `${person} — Wild Horse Nine`,
              filmSubject: "Wild Horse Nine",
              peopleSubjects: [person],
              originalValue: {
                rank: index + 1,
                list_length: 2,
              },
              originalScale: null,
              categoryId: "supporting-actor",
              predictionIntention: "nomination",
              participates: true,
            }),
          ),
        },
      ],
    };
    const prepared = await prepareBatch(batch, peopleFilms);
    const [john, sam] = prepared.publications[0].observations;
    expect(john.categoryCandidateId).not.toBe(sam.categoryCandidateId);
    expect(john.candidate.people[0].name).toBe("John Malkovich");
    expect(sam.candidate.people[0].name).toBe("Sam Rockwell");
  });

  it("chooses a deterministic credit role for each category", async () => {
    const batch = {
      connectorId: "fixture-multiple-roles",
      sourceId: "academy",
      extractorVersion: "fixture-v1",
      seasonId: "oscars-2026",
      capturedAt,
      sourceUrl: "https://www.oscars.org/oscars/ceremonies/2026",
      publications: [
        {
          externalId: "multiple-roles",
          canonicalUrl: "https://www.oscars.org/oscars/ceremonies/2026",
          title: "Multiple roles",
          author: null,
          publishedAt: capturedAt,
          originalData: { fixture: true },
          observations: ["directing", "adapted-screenplay"].map(
            (categoryId) => ({
              dataType: "prediction_selection",
              subject: "Josh Safdie — Marty Supreme",
              filmSubject: "Marty Supreme",
              peopleSubjects: ["Josh Safdie"],
              originalValue: { official_nominee: true },
              originalScale: null,
              categoryId,
              predictionIntention: "nomination",
              participates: false,
            }),
          ),
        },
      ],
    };
    const prepared = await prepareBatch(batch, [
      {
        id: "marty-supreme",
        title: "Marty Supreme",
        alternate_titles: [],
        credits: [
          {
            role: "Writer",
            department: "Writing",
            billingOrder: 0,
            person: { id: "person-josh", name: "Josh Safdie" },
          },
          {
            role: "Director",
            department: "Directing",
            billingOrder: 0,
            person: { id: "person-josh", name: "Josh Safdie" },
          },
        ],
      },
    ]);
    expect(
      prepared.publications[0].observations.map(
        (observation: { candidate: { people: Array<{ role: string }> } }) =>
          observation.candidate.people[0].role,
      ),
    ).toEqual(["Director", "Writer"]);
  });

  it("matches a person alias only inside the already matched film credits", async () => {
    const batch = parseAwardsWatchArticleFixture(
      (await fixture("awardswatch-actor.html")).replace(
        "Tom Cruise",
        "Thomas Cruise Mapother IV",
      ),
      {
        connectorId: "awardswatch-predictions",
        capturedAt,
        endpointUrl:
          "https://awardswatch.com/2027-oscar-predictions-best-actor-june/",
        seasonId: "oscars-2027",
        categoryId: "actor",
      },
    );
    const prepared = await prepareBatch(batch, [
      {
        id: "digger",
        title: "Digger",
        alternate_titles: [],
        credits: [
          {
            role: "Actor",
            person: {
              id: "tmdb-500",
              name: "Tom Cruise",
              alternate_names: ["Thomas Cruise Mapother IV"],
            },
          },
        ],
      },
      ...films.filter((film) => film.id !== "digger"),
    ]);

    expect(prepared.publications[0].observations[0]).toEqual(
      expect.objectContaining({
        state: "published",
        categoryCandidateId: expect.any(String),
      }),
    );
  });

  it("queues an ambiguous person within an already matched film", async () => {
    const batch = parseAwardsWatchArticleFixture(
      (await fixture("awardswatch-actor.html")).replace(
        "Tom Cruise",
        "Unknown Actor",
      ),
      {
        connectorId: "awardswatch-predictions",
        capturedAt,
        endpointUrl:
          "https://awardswatch.com/2027-oscar-predictions-best-actor-june/",
        seasonId: "oscars-2027",
        categoryId: "actor",
      },
    );
    const prepared = await prepareBatch(batch, [
      {
        id: "digger",
        title: "Digger",
        alternate_titles: [],
        credits: [],
      },
      ...films.filter((film) => film.id !== "digger"),
    ]);
    expect(prepared.publications[0].observations[0]).toEqual(
      expect.objectContaining({
        categoryCandidateId: null,
        state: "pending_review",
        participates: false,
        review: expect.objectContaining({ kind: "person_match" }),
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
    expect(first.capturesInserted).toBe(1);
    expect(second.capturesInserted).toBe(0);
    expect(second.capturesDuplicate).toBe(1);
    expect(second.observationsDuplicate).toBe(10);
    expect(repository.observations).toHaveLength(10);
    expect(repository.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "source.updated" }),
        expect.objectContaining({ code: "source.unchanged" }),
      ]),
    );
  });

  it("creates a complete immutable revision when a mutable page changes", async () => {
    const mutable = {
      connectorId: "mutable-source",
      sourceId: "awards-radar",
      extractorVersion: "awards-radar-v2",
      seasonId: "oscars-2027",
      capturedAt,
      sourceUrl: "https://awardsradar.com/best-picture/",
      publications: [
        {
          externalId: "best-picture",
          canonicalUrl: "https://awardsradar.com/best-picture/",
          title: "Best Picture",
          author: null,
          publishedAt: null,
          isMutable: true,
          originalData: { ranking: ["The Odyssey", "Digger"] },
          observations: ["The Odyssey", "Digger"].map((subject, index) => ({
            dataType: "prediction_ordered",
            subject,
            filmSubject: subject,
            peopleSubjects: [],
            originalValue: { rank: index + 1, list_length: 2 },
            originalScale: null,
            categoryId: "best-picture",
            predictionIntention: "nomination",
            participates: true,
          })),
        },
      ],
    };
    const first = await prepareBatch(mutable, films);
    const second = await prepareBatch(
      {
        ...mutable,
        publications: [
          {
            ...mutable.publications[0],
            originalData: { ranking: ["Digger", "The Odyssey"] },
            observations: [...mutable.publications[0].observations]
              .reverse()
              .map((observation, index) => ({
                ...observation,
                originalValue: { rank: index + 1, list_length: 2 },
              })),
          },
        ],
      },
      films,
    );
    const parserRevision = await prepareBatch(
      {
        ...mutable,
        extractorVersion: "awards-radar-v3",
        publications: [
          {
            ...mutable.publications[0],
            observations: mutable.publications[0].observations.map(
              (observation) => ({
                ...observation,
                originalValue: {
                  ...observation.originalValue,
                  list_length: 3,
                },
              }),
            ),
          },
        ],
      },
      films,
    );

    expect(first.publications[0].externalId).not.toBe(
      second.publications[0].externalId,
    );
    expect(first.publications[0].externalId).not.toBe(
      parserRevision.publications[0].externalId,
    );
    expect(first.publications[0].observations).toHaveLength(2);
    expect(second.publications[0].observations).toHaveLength(2);
    expect(
      first.publications[0].observations.map(
        (observation: { dedupeKey: string }) => observation.dedupeKey,
      ),
    ).not.toEqual(
      second.publications[0].observations.map(
        (observation: { dedupeKey: string }) => observation.dedupeKey,
      ),
    );
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
      discovery: {
        checkedAt: capturedAt,
        mode: "fixture",
        publicationUrls: [],
        latestCategoryUrls: {},
        skippedUrls: [],
      },
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
        expect.objectContaining({ level: "info", code: "discovery.checked" }),
        expect.objectContaining({ level: "info", code: "connector.completed" }),
      ]),
    );
  });

  it("closes an abandoned connector run before retrying it", async () => {
    const repository = new MemoryRepository();
    repository.runs.set(41, {
      connectorId: "healthy",
      status: "running",
      startedAt: "2026-07-24T14:00:00Z",
    });
    repository.nextRun = 42;

    const results = await runConnectorSet({
      connectors: [{ id: "healthy" }],
      registry: {
        healthy: async () => ({
          connectorId: "healthy",
          sourceId: "awardswatch",
          extractorVersion: "test-v1",
          seasonId: "oscars-2027",
          capturedAt,
          sourceUrl: "https://example.com/",
          publications: [],
        }),
      },
      repository,
      trigger: "fixture",
      now: () => new Date(capturedAt),
    });

    expect(repository.runs.get(41)).toEqual(
      expect.objectContaining({ status: "failed", errorSummary: "abandoned" }),
    );
    expect(results[0]).toEqual(
      expect.objectContaining({ status: "succeeded" }),
    );
    expect(repository.events).toContainEqual(
      expect.objectContaining({
        runId: 41,
        level: "error",
        code: "connector.abandoned",
      }),
    );
  });
});
