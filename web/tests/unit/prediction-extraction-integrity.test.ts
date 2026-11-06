import { describe, expect, it } from "vitest";
import { prepareBatch } from "../../../supabase/functions/_shared/ingestion/core.mjs";
import {
  parseAwardsDailyFixture,
  parseAwardsRadarFixture,
  parseRingerSelectionFixture,
} from "../../../supabase/functions/_shared/ingestion/professional-predictions.mjs";

const options = {
  connectorId: "audit",
  capturedAt: "2026-11-06T12:00:00Z",
  endpointUrl: "https://www.awardsdaily.com/2026/10/30/predictions/",
  seasonId: "oscars-2027",
};
const statement =
  "For now, I’m ordering these by which films I think are strongest";

describe("prediction extraction integrity", () => {
  it("uses an adjacent explicit editorial order only for the declared Best Picture list", () => {
    const batch = parseAwardsDailyFixture(
      `<h1>2027 Oscar Predictions</h1><p>${statement}, rather than by how the groupthink is going.</p>
       <p>Best Picture<br>The Odyssey<br>I Play Rocky<br>Alt. Dune III</p>
       <p>Director<br>Christopher Nolan, The Odyssey<br>Christian Mungiu, Fjord,</p>`,
      options,
    );
    const publication = batch.publications[0];
    expect(
      publication.observations
        .slice(0, 2)
        .map((row: { originalValue: unknown }) => row.originalValue),
    ).toEqual([
      expect.objectContaining({
        rank: 1,
        list_length: 2,
        raw: "The Odyssey",
        order_evidence: "explicit-editorial-statement",
      }),
      expect.objectContaining({
        rank: 2,
        list_length: 2,
        raw: "I Play Rocky",
        order_evidence: "explicit-editorial-statement",
      }),
    ]);
    expect(
      publication.observations
        .slice(2)
        .map((row: { dataType: string }) => row.dataType),
    ).toEqual(["prediction_selection", "prediction_selection"]);
    expect(publication.originalData.order_statements).toEqual({
      "best-picture": statement,
    });
    expect(publication.observations.at(-1)).toMatchObject({
      filmSubject: "Fjord",
      peopleSubjects: ["Cristian Mungiu"],
      originalValue: { raw: "Christian Mungiu, Fjord," },
    });
  });

  it("does not borrow an ordering statement from an unrelated paragraph or category", () => {
    for (const html of [
      `<p>${statement}.</p><p>Here are my predictions:</p><p>Best Picture<br>The Odyssey</p>`,
      `<p>${statement}.</p><p>Director<br>Christopher Nolan, The Odyssey</p><p>Best Picture<br>The Odyssey</p>`,
    ]) {
      const batch = parseAwardsDailyFixture(html, options);
      expect(
        batch.publications[0].observations.every(
          (row: { dataType: string }) =>
            row.dataType === "prediction_selection",
        ),
      ).toBe(true);
      expect(
        batch.publications[0].originalData.order_statements,
      ).toBeUndefined();
    }
  });

  it("queues an empty film label without losing valid observations in the same source capture", async () => {
    const batch = parseAwardsDailyFixture(
      "<p>Best Picture<br>The Odyssey<br>Dune III</p>",
      options,
    );
    batch.publications[0].observations[1].filmSubject = "";
    const prepared = await prepareBatch(batch, [
      {
        id: "the-odyssey",
        title: "The Odyssey",
        alternate_titles: [],
        credits: [],
      },
    ]);
    expect(prepared.publications[0].observations[0].state).toBe("published");
    expect(prepared.publications[0].observations[1]).toMatchObject({
      state: "pending_review",
      participates: false,
      candidate: null,
      review: { kind: "film_match" },
    });
  });

  it("matches the abbreviated Cliff Booth title while preserving the published wording", () => {
    const batch = parseAwardsDailyFixture(
      "<p>Best Picture<br>Further Mis-Adventures of Cliff Booth</p>",
      options,
    );
    expect(batch.publications[0].observations[0]).toMatchObject({
      filmSubject: "The Adventures of Cliff Booth",
      originalValue: { raw: "Further Mis-Adventures of Cliff Booth" },
    });
  });

  it.each([
    "February 30th, 2026",
    "November 7th, 2026",
    "September 31st, 2026",
  ])("rejects the impossible or future Radar editorial date %s", (date) => {
    expect(() =>
      parseAwardsRadarFixture(
        `<p>2027 Oscar Predictions</p><p>Updated ${date}</p><p>1. The Odyssey</p>`,
        { ...options, categoryId: "best-picture" },
      ),
    ).toThrow("fecha editorial");
  });

  it("rejects inverse season labels in mutable Radar pages and Ringer articles", () => {
    expect(() =>
      parseAwardsRadarFixture(
        "<p>Oscar Predictions for 2028</p><p>Updated November 5th, 2026</p><p>1. The Odyssey</p>",
        { ...options, categoryId: "best-picture" },
      ),
    ).toThrow("otra temporada");
    expect(() =>
      parseRingerSelectionFixture(
        '<meta property="og:title" content="Oscar Predictions for 2028"><article><p>The Odyssey (dir. Christopher Nolan)</p></article>',
        options,
      ),
    ).toThrow("otra temporada");
  });
});
