import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  discoverVarietyCategoryUrls,
  parseVarietyFixture,
  runVarietyConnector,
  varietyChartRedirect,
} from "../../../supabase/functions/_shared/ingestion/variety.mjs";
import {
  prepareBatch,
  validateOrderedPredictionLists,
  validateRequiredPredictionCategories,
} from "../../../supabase/functions/_shared/ingestion/core.mjs";

type CategoryFixture = {
  endpointUrl: string;
  articleHtml: string;
  chartHtml: string;
  csv: string;
  iframeUrl: string;
  resolvedChartUrl: string;
  datasetUrl: string;
};
const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/variety-2026-10-01.json", import.meta.url),
    "utf8",
  ),
) as { capturedAt: string; categories: Record<string, CategoryFixture> };
const indexUrl = "https://variety.com/lists/2027-oscars-predictions/";
const indexHtml = Object.values(fixture.categories)
  .map(
    (category) =>
      `<a href="${category.endpointUrl}">Oscar category page with rankings</a>`,
  )
  .join("");
const parse = (categoryId: string, changes: Partial<CategoryFixture> = {}) =>
  parseVarietyFixture(
    { ...fixture.categories[categoryId], ...changes },
    {
      capturedAt: fixture.capturedAt,
      categoryId,
      endpointUrl: fixture.categories[categoryId].endpointUrl,
    },
  );

describe("Variety public category rankings", () => {
  it.each(Object.keys(fixture.categories))(
    "preserves every explicit rank for %s and stops before the eligible catalogue",
    (categoryId) => {
      const batch = parse(categoryId);
      const publication = batch.publications[0];
      const length = categoryId === "best-picture" ? 40 : 30;
      expect(publication.observations).toHaveLength(length);
      expect(
        publication.observations.map(
          (row: { originalValue: { rank: number } }) => row.originalValue.rank,
        ),
      ).toEqual(Array.from({ length }, (_, index) => index + 1));
      expect(
        publication.observations[length - 1].originalValue.list_length,
      ).toBe(length);
      expect(publication).toMatchObject({
        author: "Clayton Davis",
        publishedAt: "2026-10-01T00:00:00.000Z",
        isMutable: true,
      });
      expect(publication.originalData).toMatchObject({
        iframe_url: fixture.categories[categoryId].iframeUrl,
        resolved_chart_url: fixture.categories[categoryId].resolvedChartUrl,
        dataset_url: fixture.categories[categoryId].datasetUrl,
      });
      expect(() => validateOrderedPredictionLists(batch)).not.toThrow();
      expect(() =>
        validateRequiredPredictionCategories(batch, [categoryId]),
      ).not.toThrow();
    },
  );

  it("keeps quoted commas, multiline credits and doubled quotes intact", () => {
    expect(parse("actress").publications[0].observations[25].filmSubject).toBe(
      "Ha-Chan, Shake Your Booty!",
    );
    const adapted = parse("adapted-screenplay").publications[0].observations;
    expect(adapted[0].originalValue.raw["Writer(s)"]).toContain(
      '"The People Upstairs"',
    );
    expect(adapted[5].originalValue.raw["Writer(s)"]).toContain(
      "\nby Andy Weir",
    );
    expect(
      parse("actor").publications[0].observations[21].peopleSubjects,
    ).toEqual(["Timothée Chalamet"]);
    expect(
      parse("actor").publications[0].observations[21].originalValue.raw
        .Performer,
    ).toBe("Timothée Chalamet\r");
    expect(
      parse("best-picture").publications[0].observations[22].filmSubject,
    ).toBe("The Adventures of Cliff Booth");
    expect(
      parse("best-picture").publications[0].observations[22].originalValue.raw
        .Film,
    ).toBe("The Further Mis-Adventures of Cliff Booth");
  });

  it("keeps an undisclosed performer pending without removing its position or length", async () => {
    const batch = parse("supporting-actress");
    const prepared = await prepareBatch(batch, [
      {
        id: "you-can-see-everything",
        title: "You Can See Everything",
        alternate_titles: [],
        credits: [],
      },
    ]);
    const redacted = prepared.publications[0].observations[6];
    expect(redacted.candidate).toBeNull();
    expect(redacted.review).not.toBeNull();
    expect(redacted.originalValue).toMatchObject({
      rank: 7,
      list_length: 30,
      raw: { Performer: "[REDACTED]" },
    });
    expect(prepared.publications[0].observations).toHaveLength(30);
    expect(
      await prepareBatch(batch, [
        {
          id: "you-can-see-everything",
          title: "You Can See Everything",
          alternate_titles: [],
          credits: [],
        },
      ]),
    ).toEqual(prepared);
  });

  it.each([
    {
      csv: fixture.categories.actor.csv.replace(
        "2,Andrew Scott",
        "3,Andrew Scott",
      ),
    },
    {
      csv: fixture.categories.actor.csv.replace(
        "ELIGIBLE PERFORMERS (IN ALPHABETICAL ORDER)",
        "UNRECOGNIZED CATALOGUE",
      ),
    },
    {
      csv: fixture.categories.actor.csv.replace(
        "Updated Oct. 1, 2026",
        "Updated Oct. 8, 2026",
      ),
    },
    {
      chartHtml: fixture.categories.actor.chartHtml.replace(
        "Best Actor",
        "Best Actress",
      ),
    },
    {
      articleHtml: fixture.categories.actor.articleHtml.replace(
        "Clayton Davis",
        "Unknown Author",
      ),
    },
    { datasetUrl: "https://example.com/dataset.csv" },
  ])(
    "rejects incomplete or contradictory provenance without manufacturing ranks",
    (changes) => {
      expect(() => parse("actor", changes)).toThrow();
    },
  );

  it("rediscovers current category articles and follows only public same-chart versions", async () => {
    const category = fixture.categories.directing;
    const calls: string[] = [];
    const connector = {
      id: "variety-directing-predictions",
      endpoint_url: indexUrl,
      configuration: {
        season_id: "oscars-2027",
        ceremony_year: 2027,
        category_id: "directing",
        required_category_ids: ["directing"],
      },
    };
    const fetcher = async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push(url);
      const bodies: Record<string, string> = {
        [indexUrl]: indexHtml,
        [category.endpointUrl]: category.articleHtml,
        [category.iframeUrl]: `<meta http-equiv="refresh" content="0; url=${category.resolvedChartUrl}">`,
        [category.resolvedChartUrl]: category.chartHtml,
        [category.datasetUrl]: category.csv,
      };
      if (!(url in bodies)) throw new Error(`Unexpected request ${url}`);
      return new Response(bodies[url]);
    };
    const batch = await runVarietyConnector({
      connector,
      capturedAt: fixture.capturedAt,
      fetcher,
    });
    expect(calls).toEqual([
      indexUrl,
      category.endpointUrl,
      category.iframeUrl,
      category.resolvedChartUrl,
      category.datasetUrl,
    ]);
    expect(batch.discovery.latestCategoryUrls).toEqual({
      directing: category.endpointUrl,
    });
    expect(batch.sourceId).toBe("variety");
    expect(discoverVarietyCategoryUrls(indexHtml)).toHaveProperty(
      "directing",
      category.endpointUrl,
    );
    expect(() =>
      varietyChartRedirect(
        '<meta http-equiv="refresh" content="0; url=https://datawrapper.dwcdn.net/Other/1/">',
        category.iframeUrl,
      ),
    ).toThrow("cambió");
    expect(() =>
      varietyChartRedirect(
        '<meta http-equiv="refresh" content="0; url=https://example.com/a/">',
        category.iframeUrl,
      ),
    ).toThrow();
  });

  it.each(["unavailable", "ambiguous"])(
    "isolates an %s category from the seven other category connectors",
    async (failure) => {
      const bad = fixture.categories.actor;
      const base = {
        endpoint_url: indexUrl,
        configuration: { season_id: "oscars-2027", ceremony_year: 2027 },
      };
      const fetcher = async (input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url === indexUrl)
          return new Response(
            indexHtml +
              (failure === "ambiguous"
                ? '<a href="https://variety.com/feature/2027-oscars-best-actor-predictions-9999999999/">Actor updated article</a>'
                : ""),
          );
        if (url === bad.endpointUrl)
          return new Response("Unavailable", { status: 503 });
        for (const category of Object.values(fixture.categories)) {
          if (url === category.endpointUrl)
            return new Response(category.articleHtml);
          if (url === category.iframeUrl || url === category.resolvedChartUrl) {
            if (url !== category.resolvedChartUrl)
              return new Response(
                `<meta http-equiv="refresh" content="0; url=${category.resolvedChartUrl}">`,
              );
            return new Response(category.chartHtml);
          }
          if (url === category.datasetUrl) return new Response(category.csv);
        }
        throw new Error(`Unexpected request ${url}`);
      };
      const results = await Promise.allSettled(
        Object.keys(fixture.categories).map((categoryId) =>
          runVarietyConnector({
            connector: {
              ...base,
              id: `variety-${categoryId}-predictions`,
              configuration: {
                ...base.configuration,
                category_id: categoryId,
                required_category_ids: [categoryId],
              },
            },
            capturedAt: fixture.capturedAt,
            fetcher,
          }),
        ),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(7);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
    },
  );
});
