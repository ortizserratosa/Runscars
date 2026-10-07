import {
  festivalAwardLabel,
  festivalCoverageNote,
} from "../../src/lib/festivals/presentation";
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
import {
  importFestivalManifests,
  runFestivalConnectors,
} from "../../../supabase/functions/_shared/festivals/repository.mjs";

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
  it("keeps Cannes feature awards, ties and recipients distinct from the film links", () => {
    const html = readFileSync(
      new URL(
        "../fixtures/festivals/cannes-native-awards.html",
        import.meta.url,
      ),
      "utf8",
    );
    const entries = parseFestivalHtml("cannes", "awards", html);
    expect(entries).toHaveLength(5);
    expect(
      entries.map((entry: { originalTitle: string }) => entry.originalTitle),
    ).toEqual([
      "LA BOLA NEGRA",
      "FATHERLAND",
      "SOUDAIN",
      "BEN’IMANA",
      "Notre Salut",
    ]);
    expect(entries[0]).toMatchObject({
      originalRecipient: "Javier CALVO & Javier AMBROSSI",
      awardType: "Best Director Prize (ex-æquo)",
    });
    expect(entries[2]).toMatchObject({
      originalRecipient: "Virginie EFIRA and Tao OKAMOTO",
    });
    expect(entries[3]).toMatchObject({
      section: "Caméra d’or",
      originalRecipient: "Marie-Clémentine DUSABEJAMBO",
    });
    expect(entries[4]).toMatchObject({
      originalRecipient: "Nicolas Rumpl",
      awardType: "THE CST AWARD FOR BEST ARTIST-TECHNICIAN",
    });
  });

  it("decodes Berlinale names while preserving source details and removing only the recipient separator", () => {
    const html =
      '<h2 class="award-list__headline">Competition</h2><div class="award-list__item"><strong class="award-list__type">Silver Bear</strong><div class="award-list__details"><p>Sandra H&uuml;ller in: <a href="/en/2026/programme/202601234.html">R&oacute;se</a></p></div></div>';
    const entries = parseFestivalHtml("berlinale", "awards", html);
    expect(entries[0]).toMatchObject({
      originalTitle: "Róse",
      originalRecipient: "Sandra Hüller",
    });
    expect(entries[0].originalData).toMatchObject({
      details: "Sandra Hüller in: Róse",
    });
  });

  it("exposes the scope of partial selection captures without adding it to awards", () => {
    const locarno = festivalCoverageNote(
      "locarno-2026",
      "selection",
      { notes: "PARTIAL verified five sections" },
      [{ section: "Piazza Grande" }],
    );
    expect(locarno?.es).toContain("Selección parcial");
    expect(
      festivalCoverageNote("locarno-2026", "awards", { notes: "PARTIAL" }, []),
    ).toBeNull();
    expect(
      festivalCoverageNote("nyff-2026", "selection", {}, [
        { section: "Main Slate" },
      ])?.en,
    ).toContain("Spotlight and Currents");
    expect(
      festivalCoverageNote("nyff-2026", "selection", {}, [
        { section: "Main Slate" },
        { section: "Spotlight" },
      ]),
    ).toBeNull();
  });

  it("reads Sundance native feature and award markup without importing synopses or volunteer awards", () => {
    const html = readFileSync(
      new URL("../fixtures/festivals/sundance-native.html", import.meta.url),
      "utf8",
    );
    expect(parseFestivalHtml("sundance", "selection", html)).toEqual([
      expect.objectContaining({
        originalTitle: "Josephine",
        originalRecipient: "Beth de Araújo",
        section: "U.S. DRAMATIC COMPETITION",
      }),
    ]);
    expect(parseFestivalHtml("sundance", "awards", html)).toEqual([
      expect.objectContaining({
        originalTitle: "Josephine",
        awardType: "U.S. Grand Jury Prize: Dramatic",
      }),
    ]);
  });

  it("keeps Cannes sections and the opening film's explicit out-of-competition status", () => {
    const html = readFileSync(
      new URL(
        "../fixtures/festivals/cannes-native-selection.html",
        import.meta.url,
      ),
      "utf8",
    );
    const entries = parseFestivalHtml("cannes", "selection", html);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      originalTitle: "THE ELECTRIC KISS",
      originalRecipient: "Pierre SALVADORI",
      section: "Out of Competition",
    });
    expect(entries[1]).toMatchObject({
      originalTitle: "FJORD",
      section: "In Competition",
    });
    expect(entries[2]).toMatchObject({ section: "Un Certain Regard" });
  });

  it("reads Venice film and performance awards while excluding shorts, restorations and immersive", () => {
    const html = readFileSync(
      new URL(
        "../fixtures/festivals/venice-native-awards.html",
        import.meta.url,
      ),
      "utf8",
    );
    const entries = parseFestivalHtml("venice", "awards", html);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      originalTitle: "KVINDE UKENDT (WOMAN UNKNOWN)",
      originalRecipient: "May el-Toukhy",
      awardType: "GOLDEN LION for Best Film",
    });
    expect(entries[1]).toMatchObject({
      originalRecipient: "Mathilde Arcel",
      awardType: "COPPA VOLPI for Best Actress",
    });
  });

  it("preserves a reviewed static archive without fetching a dynamic partial page", async () => {
    const connector = {
      id: "festival-tiff",
      festival_id: "tiff",
      name: "TIFF",
      extractor_version: "v4",
      configuration: {
        edition_id: "tiff-2026",
        selection_url: "https://example.com/selection",
        awards_url: "https://example.com/awards",
        manual_archive_kinds: ["selection", "awards"],
      },
    };
    let requests = 0;
    expect(
      await FESTIVAL_CONNECTORS[connector.id]({
        connector,
        capturedAt: "2026-10-07T08:32:29Z",
        fetcher: async () => {
          requests++;
          return new Response('<span data-film-title="Partial"></span>');
        },
      }),
    ).toEqual([]);
    expect(requests).toBe(0);
  });

  it("rejects a partial capture below the reviewed feature count and keeps publication provenance", async () => {
    const connector = {
      id: "festival-cannes",
      festival_id: "cannes",
      name: "Cannes",
      extractor_version: "v4",
      configuration: {
        edition_id: "cannes-2026",
        selection_url: "https://example.com/selection",
        minimum_entries: { selection: 3 },
      },
    };
    const html =
      '<meta property="article:published_time" content="2026-04-09T12:00:00Z"><span data-film-title="Feature" data-section="Competition"></span><span data-film-title="Short" data-format="short"></span>';
    const fetcher = async () => new Response(html);
    await expect(
      FESTIVAL_CONNECTORS[connector.id]({
        connector,
        capturedAt: "2026-10-07T08:32:29Z",
        fetcher,
      }),
    ).rejects.toThrow("Captura parcial");
    connector.configuration.minimum_entries.selection = 1;
    const [manifest] = await FESTIVAL_CONNECTORS[connector.id]({
      connector,
      capturedAt: "2026-10-07T08:32:29Z",
      fetcher,
    });
    expect(manifest.source.publishedAt).toBe("2026-04-09T12:00:00Z");
  });
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
    const withoutCatalogue = await prepareFestivalSet(manifest, []);
    const ambiguousCatalogue = await prepareFestivalSet(manifest, [
      ...catalogue,
      { id: "other-soudain", title: "Soudain" },
    ]);
    expect(withoutCatalogue.entries[0].status).toBe("unmatched");
    expect(ambiguousCatalogue.entries[0].status).toBe("pending_review");
    expect(withoutCatalogue.contentHash).toBe(first.contentHash);
    expect(ambiguousCatalogue.contentHash).toBe(first.contentHash);
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

describe("reviewed October festival supplement", () => {
  it("continues importing other festival captures after validation and persistence failures", async () => {
    const makeManifest = (editionId: string) => ({
      editionId,
      kind: "selection",
      source: {
        url: "https://example.org/official",
        title: "Official source",
        publishedAt: null,
      },
      capturedAt: "2026-10-07T08:32:29Z",
      extractorVersion: "fixture",
      entries: [{ section: "Competition", originalTitle: "Example" }],
    });
    const persisted: string[] = [];
    const results = await importFestivalManifests({
      manifests: [
        { ...makeManifest("invalid"), entries: [] },
        makeManifest("database-failure"),
        makeManifest("healthy"),
      ],
      repository: {
        catalogue: async () => [],
        persistPreparedSet: async (prepared: { editionId: string }) => {
          persisted.push(prepared.editionId);
          if (prepared.editionId === "database-failure")
            throw new Error("Source persistence failed");
          return { status: "inserted" };
        },
      },
    });
    expect(results.map((result: { status: string }) => result.status)).toEqual([
      "failed",
      "failed",
      "inserted",
    ]);
    expect(persisted).toEqual(["database-failure", "healthy"]);
    expect(results[1].error).toBe("Source persistence failed");
  });

  it("retains all in-scope facts, remains idempotent and preserves explicit source values", async () => {
    const document = JSON.parse(
      readFileSync(
        new URL(
          "../../data/festivals/2026-supplement-2026-10-07.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const counts = [90, 29, 149, 76, 63, 16, 206, 20, 141, 35, 16];
    expect(document.sets).toHaveLength(counts.length);
    for (const [index, manifest] of document.sets.entries()) {
      const first = await prepareFestivalSet(manifest, []);
      const repeated = await prepareFestivalSet(manifest, []);
      expect(first.entries).toHaveLength(counts[index]);
      expect(first.contentHash).toBe(repeated.contentHash);
      expect(
        first.entries.every(
          (entry: { originalTitle: string }) =>
            entry.originalTitle.length < 200,
        ),
      ).toBe(true);
      expect(manifest.entries.every(isEligibleFestivalEntry)).toBe(true);
      expect(manifest.rawCapture.sourceUrl).toBe(manifest.source.url);
    }
    const tiff = document.sets.find(
      (item: { editionId: string; kind: string }) =>
        item.editionId === "tiff-2026" && item.kind === "awards",
    );
    expect(
      tiff.entries.some((entry: { awardType: string }) =>
        entry.awardType.includes("Second runner-up"),
      ),
    ).toBe(true);
    const sanSebastian = document.sets.find(
      (item: { editionId: string; kind: string }) =>
        item.editionId === "san-sebastian-2026" && item.kind === "awards",
    );
    expect(
      sanSebastian.entries.some((entry: { awardType: string }) =>
        entry.awardType.includes("BEST EUROPEAN FILM"),
      ),
    ).toBe(true);
    expect(
      sanSebastian.entries.filter((entry: { awardType: string }) =>
        entry.awardType.includes("ex aequo"),
      ),
    ).toHaveLength(2);
    const locarno = document.sets.find(
      (item: { editionId: string }) => item.editionId === "locarno-2026",
    );
    expect(locarno.rawCapture.notes).toContain("PARTIAL");
    expect(
      locarno.entries.some(
        (entry: { originalTitle: string }) => entry.originalTitle === "Armony",
      ),
    ).toBe(true);
    expect(
      locarno.entries.some(
        (entry: { originalTitle: string }) => entry.originalTitle === "Jaws",
      ),
    ).toBe(false);
  });
});

describe("Telluride official programme supplement", () => {
  it("imports contemporary features idempotently and excludes shorts and repertory screenings", async () => {
    const document = JSON.parse(
      readFileSync(
        new URL("../../data/festivals/2026-telluride.json", import.meta.url),
        "utf8",
      ),
    );
    const manifest = document.sets[0];
    const catalogue = [{ id: "fjord", title: "Fjord", alternateTitles: [] }];
    const first = await prepareFestivalSet(manifest, catalogue);
    const repeated = await prepareFestivalSet(manifest, catalogue);
    expect(first).toEqual(repeated);
    expect(manifest.entries).toHaveLength(43);
    expect(manifest.entries.every(isEligibleFestivalEntry)).toBe(true);
    expect(
      manifest.entries.map(
        (entry: { originalTitle: string }) => entry.originalTitle,
      ),
    ).toContain("Fjord");
    expect(
      manifest.entries.map(
        (entry: { originalTitle: string }) => entry.originalTitle,
      ),
    ).not.toContain("Beau Geste");
    expect(
      manifest.entries.map(
        (entry: { originalTitle: string }) => entry.originalTitle,
      ),
    ).not.toContain("A Song for the Snow Lion");
  });
});

it("keeps lengthy jury citations out of compact public award labels", () => {
  expect(festivalAwardLabel("Grand Jury Prize", "en")).toBe("Grand Jury Prize");
  expect(festivalAwardLabel("A long jury citation. ".repeat(12), "en")).toBe(
    "Official award",
  );
  expect(festivalAwardLabel("A long jury citation. ".repeat(12), "es")).toBe(
    "Premio oficial",
  );
});
