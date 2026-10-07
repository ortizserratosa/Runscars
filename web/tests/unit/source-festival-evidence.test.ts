import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SourcePage from "../../src/app/fuentes/[slug]/page";
import type { FestivalEditionView } from "../../src/lib/festivals/data";
import {
  getSourceDetail,
  getSourceIndex,
} from "../../src/lib/repositories/sources";

const state = vi.hoisted(() => ({
  festivals: [] as FestivalEditionView[],
  sources: [] as Record<string, unknown>[],
  professional: [] as Record<string, unknown>[],
  connectors: [] as Record<string, unknown>[],
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => "es",
}));
vi.mock("../../src/lib/environment", () => ({
  isSupabaseConfigured: () => true,
}));
vi.mock("../../src/lib/repositories/signals", () => ({
  getCurrentCategoryPredictions: async () => [],
}));
vi.mock("../../src/lib/precursors/data", () => ({
  getPrecursorIndex: async () => [],
}));
vi.mock("../../src/lib/festivals/data", () => ({
  getFestivalIndex: async () => state.festivals,
}));
vi.mock("../../src/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    from: (table: string) => {
      const data =
        table === "sources"
          ? state.sources
          : table === "public_source_freshness"
            ? state.professional
            : table === "public_festival_freshness"
              ? state.connectors
              : [];
      return {
        select: () => ({
          data,
          error: null,
          eq: () => ({
            single: async () => ({ data: { notes: null }, error: null }),
          }),
        }),
      };
    },
  }),
}));

function edition(): FestivalEditionView {
  const set = (kind: "selection" | "awards") => ({
    id: `cannes-2026-${kind}`,
    kind,
    version: 2,
    sourceUrl: `https://www.festival-cannes.com/${kind}`,
    sourceTitle: `Cannes ${kind}`,
    publishedAt: "2026-05-23T00:00:00Z",
    capturedAt: "2026-10-07T08:32:29Z",
    extractorVersion: "festival-manual-v2",
    entries: [
      {
        id: `entry-${kind}`,
        order: 1,
        section: "Competition",
        originalTitle: "Example",
        originalRecipient: null,
        awardType: null,
        filmId: null,
        filmTitle: null,
        matchStatus: "unmatched" as const,
      },
    ],
  });
  return {
    id: "cannes-2026",
    festivalId: "cannes",
    name: "Festival de Cannes",
    nameEn: "Festival de Cannes",
    shortName: "Cannes",
    homepageUrl: "https://www.festival-cannes.com/",
    competitive: true,
    displayOrder: 3,
    seasonId: "oscars-2027",
    year: 2026,
    editionNumber: 79,
    startsOn: "2026-05-12",
    endsOn: "2026-05-23",
    status: "completed",
    awardsStatus: "published",
    officialUrl: "https://www.festival-cannes.com/2026/",
    selectionUrl: "https://www.festival-cannes.com/selection",
    awardsUrl: "https://www.festival-cannes.com/awards",
    lastVerifiedAt: "2026-10-07T08:32:29Z",
    selection: set("selection"),
    awards: set("awards"),
  };
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  state.festivals = [edition()];
  state.sources = [
    {
      id: "cannes",
      name: "Festival de Cannes",
      homepage_url: "https://www.festival-cannes.com/",
      source_types: ["festival"],
      editorial_status: "selected",
      technical_status: "automated",
      publication_status: "publishable",
      last_reviewed_on: "2026-10-07",
    },
  ];
  state.professional = [];
  state.connectors = [
    {
      source_id: "cannes",
      is_active: false,
      configuration: {
        edition_id: "cannes-2026",
        manual_archive_kinds: ["selection", "awards"],
      },
      last_success_at: "2026-09-07T04:30:00Z",
      last_failure_at: "2026-10-07T04:30:00Z",
    },
  ];
});
afterEach(() => vi.unstubAllGlobals());

describe("festival source evidence", () => {
  it("shows a reviewed current archive without inventing an automatic success", async () => {
    const source = (await getSourceIndex())[0];
    expect(source.festivalArchiveReviewed).toBe(true);
    expect(source.health).toBe("unknown");
    expect(source.lastCapturedAt).toBe("2026-10-07T08:32:29Z");
    expect(source.lastPublishedAt).toBe("2026-05-23T00:00:00Z");
    expect(source.lastSuccessfulCheckAt).toBe("2026-09-07T04:30:00Z");
    expect(source.lastFailureAt).toBe("2026-10-07T04:30:00Z");
    const detail = await getSourceDetail("cannes");
    expect(detail?.festivalEditions).toEqual(state.festivals);
    expect(detail?.categories).toEqual([]);
  });

  it("requires each manually archived kind to exist before labelling the archive reviewed", async () => {
    state.festivals[0].awards = null;
    expect((await getSourceIndex())[0].festivalArchiveReviewed).toBe(false);
  });

  it("does not label a shorter old set as the reviewed complete receipt", async () => {
    state.connectors[0].configuration = {
      edition_id: "cannes-2026",
      manual_archive_kinds: ["selection", "awards"],
      minimum_entries: { selection: 76, awards: 16 },
    };
    expect((await getSourceIndex())[0].festivalArchiveReviewed).toBe(false);
  });

  it("links current festival receipts and distinguishes their manual capture from automatic checks", async () => {
    const html = renderToStaticMarkup(
      await SourcePage({ params: Promise.resolve({ slug: "cannes" }) }),
    );
    expect(html).toContain("Archivo festivalero revisado");
    expect(html).toContain('href="/festivales/cannes/2026"');
    expect(html).toContain('href="https://www.festival-cannes.com/selection"');
    expect(html).toContain('href="https://www.festival-cannes.com/awards"');
    expect(html).toContain("Última comprobación automática correcta");
    expect(html).not.toContain("Incidencia reciente");
    expect(html).not.toContain("Esta fuente no tiene predicciones");
  });

  it("keeps a currently active festival connector failure visible", async () => {
    state.connectors[0].is_active = true;
    state.connectors[0].configuration = {
      edition_id: "cannes-2026",
      manual_archive_kinds: [],
    };
    const source = (await getSourceIndex())[0];
    expect(source.festivalArchiveReviewed).toBe(false);
    expect(source.health).toBe("failed");
  });

  it("does not hide one category connector failure behind a later professional source success", async () => {
    state.sources[0].id = "variety";
    state.sources[0].source_types = ["prediction"];
    state.professional = [
      {
        source_id: "variety",
        last_successful_check_at: "2026-10-07T08:30:00Z",
        last_failure_at: "2026-10-07T08:00:00Z",
        has_current_failure: true,
      },
    ];
    const source = (await getSourceIndex())[0];
    expect(source.health).toBe("failed");
  });

  it("retains historical verification dates without treating inactive connectors as healthy automation", async () => {
    state.sources[0].id = "variety";
    state.sources[0].source_types = ["prediction"];
    state.professional = [
      {
        source_id: "variety",
        last_successful_check_at: "2026-10-07T08:30:00Z",
        last_failure_at: null,
        has_current_failure: false,
        has_active_connector: false,
      },
    ];
    const source = (await getSourceIndex())[0];
    expect(source.health).toBe("unknown");
    expect(source.lastSuccessfulCheckAt).toBe("2026-10-07T08:30:00Z");
  });

  it("uses the public active failure flag rather than an inactive connector's historical failure", async () => {
    state.sources[0].id = "variety";
    state.sources[0].source_types = ["prediction"];
    state.professional = [
      {
        source_id: "variety",
        last_successful_check_at: "2026-10-07T08:30:00Z",
        last_failure_at: "2026-10-07T09:30:00Z",
        has_current_failure: false,
        has_active_connector: true,
      },
    ];
    const source = (await getSourceIndex())[0];
    expect(source.health).toBe("ok");
    expect(source.lastFailureAt).toBe("2026-10-07T09:30:00Z");
  });

  it("evaluates failures against each active connector rather than another connector's later success", async () => {
    state.connectors[0].is_active = true;
    state.connectors.push({
      source_id: "cannes",
      is_active: true,
      configuration: {},
      last_success_at: "2026-10-07T09:30:00Z",
      last_failure_at: null,
    });
    expect((await getSourceIndex())[0].health).toBe("failed");
  });
});
