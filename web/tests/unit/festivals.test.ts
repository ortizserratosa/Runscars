import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  awardsPublicationIncident,
  festivalConsensusPoints,
  isEligibleFestivalEntry,
  normalizeFestivalTitle,
  prepareFestivalSet,
} from "../../../supabase/functions/_shared/festivals/core.mjs";
import {
  FESTIVAL_CONNECTORS,
  parseFestivalHtml,
} from "../../../supabase/functions/_shared/festivals/connectors.mjs";
import { runFestivalConnectors } from "../../../supabase/functions/_shared/festivals/repository.mjs";

const festivals = [
  "sundance",
  "berlinale",
  "cannes",
  "locarno",
  "venice",
  "tiff",
  "san-sebastian",
  "telluride",
  "nyff",
];

describe("festival circuit", () => {
  it("keeps short-film special mentions out of feature awards", () => {
    const item = (award: string, title: string) =>
      `<div class="award-list__item"><strong class="award-list__type">${award}</strong><div class="award-list__details"><p><a href="/en/2026/programme/fixture.html">${title}</a></p></div></div>`;
    const html =
      '<h2 class="award-list__headline">Generation 2026</h2>' +
      item("Crystal Bear for the Best Short Film", "Short winner") +
      item("Special Mention", "Short mention") +
      item("Crystal Bear for the Best Film", "Feature winner") +
      item("Special Mention", "Feature mention");
    expect(
      parseFestivalHtml("berlinale", "awards", html)
        .filter(isEligibleFestivalEntry)
        .map((entry: { originalTitle: string }) => entry.originalTitle),
    ).toEqual(["Feature winner", "Feature mention"]);
  });

  it("parses the official San Sebastian feature listing for the requested year", async () => {
    const html = readFileSync(
      new URL("../fixtures/festivals/san-sebastian-film.html", import.meta.url),
      "utf8",
    );
    const entries = parseFestivalHtml("san-sebastian", "selection", html, 2026);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      originalTitle: "Geister / Ghost Song",
      originalRecipient: "Fatih Akin",
      isFeature: true,
    });
    expect(parseFestivalHtml("san-sebastian", "selection", html, 2025)).toEqual(
      [],
    );
  });

  it("parses the captured Berlinale award markup and excludes other editions", () => {
    const html = readFileSync(
      new URL("../fixtures/festivals/berlinale-award.html", import.meta.url),
      "utf8",
    );
    const entries = parseFestivalHtml("berlinale", "awards", html, 2026);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      originalTitle: "Gelbe Briefe",
      awardType: "Golden Bear for Best Film",
      section: "International Jury 2026",
    });
  });
  it("parses the captured Venice film markup with its source identity", () => {
    const html = readFileSync(
      new URL("../fixtures/festivals/venice-film.html", import.meta.url),
      "utf8",
    );
    expect(parseFestivalHtml("venice", "selection", html, 2026)).toEqual([
      expect.objectContaining({
        originalTitle: "NAZA",
        originalRecipient: "Yuval Abraham, Rachel Szor",
        isFeature: true,
      }),
    ]);
    expect(parseFestivalHtml("venice", "selection", html, 2025)).toEqual([]);
  });
  it.each(festivals)("parses the official %s fixture", (festival) => {
    const html = `
      <article>
        <span data-film-title="FJORD" data-section="Competition"
          data-award="Grand Prize" data-recipient="Cristian Mungiu"
          data-format="feature" data-official="true"></span>
      </article>`;
    expect(parseFestivalHtml(festival, "awards", html)).toEqual([
      expect.objectContaining({
        section: "Competition",
        originalTitle: "FJORD",
        originalRecipient: "Cristian Mungiu",
        awardType: "Grand Prize",
        isFeature: true,
      }),
    ]);
  });

  it("excludes shorts, immersive work, restorations and industry awards", () => {
    for (const entry of [
      { section: "Short Films" },
      { section: "Venice Immersive" },
      { section: "Classics", awardType: "Restoration Award" },
      { section: "Industry Market" },
      { section: "Competition", awardType: "Honorary Palme" },
    ]) {
      expect(isEligibleFestivalEntry(entry)).toBe(false);
    }
    expect(isEligibleFestivalEntry({ section: "Official Competition" })).toBe(
      true,
    );
  });

  it("matches exact catalogue titles, preserves originals and hashes idempotently", async () => {
    const manifest = {
      editionId: "cannes-2026",
      kind: "awards",
      source: {
        url: "https://www.festival-cannes.com/en/example/",
        title: "Official winners",
        publishedAt: "2026-05-23T00:00:00Z",
      },
      capturedAt: "2026-09-03T00:00:00Z",
      extractorVersion: "fixture-v1",
      rawCapture: { full: "receipt" },
      entries: [
        {
          section: "Competition",
          originalTitle: "SOUDAIN",
          originalRecipient: "Virginie Efira",
          awardType: "Best Performance",
        },
        {
          section: "Competition",
          originalTitle: "Unknown Film",
          awardType: "Jury Prize",
        },
      ],
    };
    const catalogue = [
      {
        id: "all-of-a-sudden",
        title: "All of a Sudden",
        alternateTitles: ["Soudain"],
      },
    ];
    const first = await prepareFestivalSet(manifest, catalogue);
    const repeated = await prepareFestivalSet(manifest, catalogue);
    expect(first.contentHash).toBe(repeated.contentHash);
    expect(first.entries).toEqual([
      expect.objectContaining({
        originalTitle: "SOUDAIN",
        filmId: "all-of-a-sudden",
        status: "matched",
      }),
      expect.objectContaining({
        originalTitle: "Unknown Film",
        filmId: null,
        status: "unmatched",
      }),
    ]);
    expect(normalizeFestivalTitle("L’estranea")).toBe("l estranea");
  });

  it("treats pending awards as an incident only 24 hours after closing", () => {
    const edition = { awards_status: "pending", ends_on: "2026-09-12" };
    expect(
      awardsPublicationIncident(edition, new Date("2026-09-13T12:00:00Z")),
    ).toBe(false);
    expect(
      awardsPublicationIncident(edition, new Date("2026-09-14T00:00:01Z")),
    ).toBe(true);
  });

  it("treats an unpublished awards page as normal before the incident deadline", async () => {
    const connector = {
      id: "festival-venice",
      festival_id: "venice",
      name: "Venice official",
      extractor_version: "venice-official-v1",
      edition: {
        awards_status: "pending",
        ends_on: "2026-09-12",
      },
      configuration: {
        edition_id: "venice-2026",
        awards_url: "https://example.com/awards",
      },
    };
    const manifests = await FESTIVAL_CONNECTORS[connector.id]({
      connector,
      capturedAt: "2026-09-03T00:00:00Z",
      fetcher: async () => new Response("missing", { status: 404 }),
    });
    expect(manifests).toEqual([]);
  });

  it("never contributes points to the Oscar consensus", () => {
    expect(festivalConsensusPoints()).toBe(0);
  });

  it("isolates a failed festival from successful connectors", async () => {
    const runs: Array<Record<string, unknown>> = [];
    const repository = {
      catalogue: async () => [],
      beginRun: async (connector: { id: string }) => ({
        id: connector.id,
        repeated: false,
      }),
      persistPreparedSet: async () => ({ status: "inserted" }),
      finishRun: async (id: string, result: Record<string, unknown>) =>
        runs.push({ id, ...result }),
      markConnector: async () => {},
    };
    const connectors = [
      { id: "ok", edition: {}, configuration: {}, extractor_version: "v1" },
      { id: "bad", edition: {}, configuration: {}, extractor_version: "v1" },
      { id: "empty", edition: {}, configuration: {}, extractor_version: "v1" },
    ];
    const manifest = {
      editionId: "cannes-2026",
      kind: "selection",
      source: {
        url: "https://example.com/",
        title: "Fixture",
        publishedAt: null,
      },
      capturedAt: "2026-09-03T00:00:00Z",
      extractorVersion: "fixture-v1",
      entries: [{ section: "Competition", originalTitle: "Fixture Film" }],
      rawCapture: { fixture: true },
    };
    const results = await runFestivalConnectors({
      connectors,
      registry: {
        ok: async () => [manifest],
        empty: async () => [],
        bad: async () => {
          throw new Error("source unavailable");
        },
      },
      repository,
      now: () => new Date("2026-09-03T00:00:00Z"),
    });
    expect(results.map((result) => result.status)).toEqual([
      "succeeded",
      "failed",
      "failed",
    ]);
    expect(runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "ok", status: "succeeded" }),
        expect.objectContaining({ id: "bad", status: "failed" }),
        expect.objectContaining({
          id: "empty",
          status: "failed",
          errorSummary: expect.stringContaining("No se reconocieron"),
        }),
      ]),
    );
    expect(Object.keys(FESTIVAL_CONNECTORS)).toHaveLength(9);
  });
});
