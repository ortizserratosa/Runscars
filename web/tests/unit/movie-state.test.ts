import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  discoverMovieStatePredictionUrls,
  parseMovieStateFixture,
  runMovieStateConnector,
} from "../../../supabase/functions/_shared/ingestion/movie-state.mjs";
import { prepareBatch } from "../../../supabase/functions/_shared/ingestion/core.mjs";

const url = "https://themoviestate.com/2026/09/14/2027-oscar-predictions/";
const options = { capturedAt: "2026-09-29T12:00:00Z", endpointUrl: url };
const fixture = () =>
  readFile(
    path.resolve(
      import.meta.dirname,
      "../fixtures/ingestion/movie-state-multicategory.html",
    ),
    "utf8",
  );

describe("The Movie State predictions", () => {
  it("captures the two table columns independently with an explicit rank, author and article dates", async () => {
    const batch = parseMovieStateFixture(await fixture(), options);
    const publication = batch.publications[0];
    expect(batch.sourceId).toBe("the-movie-state");
    expect(publication.author).toBe("Ben Sears");
    expect(publication.publishedAt).toBe("2026-09-14T15:00:00.000Z");
    expect(publication.originalData.publication_date).toBe(
      "2026-09-14T15:00:00.000Z",
    );
    expect(publication.observations).toHaveLength(45);
    expect(
      new Set(publication.observations.map((row) => row.categoryId)).size,
    ).toBe(8);
    expect(
      publication.observations.find(
        (row) => row.categoryId === "adapted-screenplay",
      ),
    ).toMatchObject({
      filmSubject: "La Bola Negra",
      peopleSubjects: [],
      originalValue: { rank: 1, list_length: 5 },
    });
    expect(
      publication.observations.find(
        (row) => row.categoryId === "directing" && row.originalValue.rank === 2,
      ),
    ).toMatchObject({
      filmSubject: "La Bola Negra",
      peopleSubjects: ["Javier Ambrossi", "Javier Calvo"],
      originalValue: { raw: "2. Los Javis, “La Bola Negra”" },
    });
  });

  it.each([
    [
      "missing category",
      (html: string) => html.replace("Best Adapted Screenplay", "Adapted"),
    ],
    [
      "duplicate rank",
      (html: string) => html.replace("2. La Bola Negra", "1. La Bola Negra"),
    ],
    [
      "gap",
      (html: string) => html.replace("2. La Bola Negra", "3. La Bola Negra"),
    ],
    [
      "duplicate subject",
      (html: string) => html.replace("2. La Bola Negra", "2. The Odyssey"),
    ],
    [
      "unranked selection",
      (html: string) => html.replace("1. The Odyssey", "The Odyssey"),
    ],
    [
      "missing row",
      (html: string) => html.replace("<br>10. Dune Part Three", ""),
    ],
    [
      "different author",
      (html: string) => html.replace("Ben Sears", "Other Author"),
    ],
    [
      "wrong ceremony",
      (html: string) =>
        html.replace("2027 Oscar Predictions", "2026 Oscar Predictions"),
    ],
    [
      "no date",
      (html: string) =>
        html.replace('property="article:published_time"', 'property="ignored"'),
    ],
    [
      "future date",
      (html: string) =>
        html.replace("2026-09-21T17:24:58+00:00", "2026-12-21T17:24:58+00:00"),
    ],
    ["invalid body", (html: string) => html.replace("<article ", "<section ")],
  ])("fails closed on %s", async (_label, mutate) => {
    const html = await fixture();
    expect(() => parseMovieStateFixture(mutate(html), options)).toThrow();
  });

  it("keeps the original publication date when the CMS modification timestamp changes", async () => {
    const html = await fixture();
    const before = parseMovieStateFixture(html, options).publications[0];
    const after = parseMovieStateFixture(
      html.replace("2026-09-21T17:24:58+00:00", "2026-09-28T17:24:58+00:00"),
      options,
    ).publications[0];
    expect(after.publishedAt).toBe(before.publishedAt);
    expect(after.publishedAt).toBe("2026-09-14T15:00:00.000Z");
    expect(after.observations).toEqual(before.observations);
    expect(after.originalData.modification_date).toBe(
      "2026-09-28T17:24:58.000Z",
    );
  });

  it("discovers the current ceremony without accepting similarly named articles, other seasons or domains", () => {
    const urls = discoverMovieStatePredictionUrls(
      `<a href="${url}">2027</a><a href="https://themoviestate.com/2025/09/16/2026-oscar-predictions/">2026</a><a href="https://other.com/2026/09/14/2027-oscar-predictions/">copy</a><a href="${url}#comment">duplicate</a><a href="https://themoviestate.com/2026/09/14/early-2027-oscar-predictions/">other</a>`,
    );
    expect(urls).toEqual([url]);
  });

  it("runs discovery on each check and preserves immutable content identities across repeated captures", async () => {
    const html = await fixture();
    const requested: string[] = [];
    const connector = {
      id: "movie-state-predictions",
      endpoint_url:
        "https://themoviestate.com/the-movie-state/features/award-predictions/",
      configuration: { season_id: "oscars-2027", ceremony_year: 2027 },
    };
    const fetcher: typeof fetch = async (input) => {
      const inputUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      requested.push(inputUrl);
      return new Response(
        inputUrl === connector.endpoint_url
          ? `<a href="${url}">2027</a>`
          : html,
      );
    };
    const first = await runMovieStateConnector({
      connector,
      capturedAt: options.capturedAt,
      fetcher,
    });
    const second = await runMovieStateConnector({
      connector,
      capturedAt: "2026-09-30T12:00:00Z",
      fetcher,
    });
    expect(requested).toEqual([
      connector.endpoint_url,
      url,
      connector.endpoint_url,
      url,
    ]);
    expect(first.discovery.latestCategoryUrls["original-screenplay"]).toBe(url);
    const prepared = await prepareBatch(first, []);
    const preparedAgain = await prepareBatch(second, []);
    expect(prepared.publications[0].externalId).toBe(
      preparedAgain.publications[0].externalId,
    );
    expect(prepared.publications[0].contentHash).toBe(
      preparedAgain.publications[0].contentHash,
    );
    const changed = parseMovieStateFixture(
      html.replace("9. Behemoth!", "9. I Play Rocky"),
      options,
    );
    expect(
      (await prepareBatch(changed, [])).publications[0].externalId,
    ).not.toBe(prepared.publications[0].externalId);
  });
});
