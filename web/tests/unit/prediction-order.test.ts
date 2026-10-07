import { describe, expect, it } from "vitest";
import {
  prepareBatch,
  validateOrderedPredictionLists,
  validateRequiredPredictionCategories,
} from "../../../supabase/functions/_shared/ingestion/core.mjs";
import {
  parseAwardsDailyFixture,
  parseAwardsWatchArticleFixture,
} from "../../../supabase/functions/_shared/ingestion/professional-predictions.mjs";

const capturedAt = "2026-10-07T05:00:00Z";
const dailyOptions = {
  connectorId: "awards-daily-predictions",
  capturedAt,
  endpointUrl: "https://www.awardsdaily.com/2026/10/02/predictions/",
  seasonId: "oscars-2027",
};

describe("source ordering and category retention", () => {
  it("preserves HTML ranks including ordered contenders after nomination slots", () => {
    const batch = parseAwardsDailyFixture(
      `<div class="content-inner"><h2>Predictions</h2><h3>Best Picture</h3>
       <ol>${Array.from({ length: 10 }, (_, index) => `<li>Film ${index + 1}</li>`).join("")}</ol>
       <ol start="11"><li>Film Eleven</li><li value="12">Film Twelve</li></ol>
       </div>`,
      dailyOptions,
    );
    const observations = batch.publications[0].observations;
    expect(observations).toHaveLength(12);
    expect(observations[11].originalValue).toMatchObject({
      rank: 12,
      list_length: 12,
      raw: "Film Twelve",
      order_evidence: "html-ordered-list",
    });
    expect(() => validateOrderedPredictionLists(batch)).not.toThrow();
  });

  it("retains a declared prediction block when Best Picture is absent", () => {
    const batch = parseAwardsDailyFixture(
      `<div class="content-inner"><h3>Best Picture</h3><p>Editorial discussion.</p>
       <p>Here are my predictions for this week:</p><h3>Best Actor</h3>
       <ol><li>Matt Damon, The Odyssey</li><li>John Malkovich, Wild Horse Nine</li></ol></div>`,
      dailyOptions,
    );
    expect(
      batch.publications[0].observations.map(
        (row: { categoryId: string }) => row.categoryId,
      ),
    ).toEqual(["actor", "actor"]);
    expect(() =>
      validateRequiredPredictionCategories(batch, ["actor"]),
    ).not.toThrow();
    expect(() =>
      validateRequiredPredictionCategories(batch, ["best-picture"]),
    ).toThrow("best-picture");
  });

  it("keeps unnumbered nominations as selections and rejects conflicting HTML ranks", () => {
    const batch = parseAwardsDailyFixture(
      `<h2>Predictions</h2><h3>Best Picture</h3><ul><li>The Odyssey</li><li>Wild Horse Nine</li></ul>`,
      dailyOptions,
    );
    expect(
      batch.publications[0].observations.every(
        (row: { dataType: string }) => row.dataType === "prediction_selection",
      ),
    ).toBe(true);
    expect(() =>
      parseAwardsDailyFixture(
        `<h2>Predictions</h2><h3>Best Picture</h3><ol><li>2. The Odyssey</li></ol>`,
        dailyOptions,
      ),
    ).toThrow("contradice");
  });

  it("reads explicit AwardsWatch list markers without a literal number in text", () => {
    const batch = parseAwardsWatchArticleFixture(
      `<h1>2027 Oscar Predictions</h1><h2>BEST PICTURE</h2><ol><li>The Odyssey</li><li>Wild Horse Nine</li></ol>`,
      {
        ...dailyOptions,
        connectorId: "awardswatch-predictions",
        endpointUrl:
          "https://awardswatch.com/2027-oscar-predictions-best-picture/",
        categoryId: "best-picture",
      },
    );
    expect(batch.publications[0].observations[1].originalValue).toMatchObject({
      rank: 2,
      list_length: 2,
      raw: "Wild Horse Nine",
      order_evidence: "html-ordered-list",
    });
  });

  it("matches the AwardsWatch editorial asterisk without overwriting its original label", async () => {
    const batch = parseAwardsWatchArticleFixture(
      `<h1>2027 Oscar Predictions</h1><h2>BEST SUPPORTING ACTOR</h2><ol><li>*Guitarricadelafuente, La Bola Negra</li></ol>`,
      {
        ...dailyOptions,
        connectorId: "awardswatch-predictions",
        endpointUrl:
          "https://awardswatch.com/2027-oscar-predictions-best-supporting-actor/",
        categoryId: "supporting-actor",
      },
    );
    const prepared = await prepareBatch(batch, [
      {
        id: "la-bola-negra",
        title: "La Bola Negra",
        alternate_titles: [],
        credits: [
          {
            role: "Actor",
            department: "Acting",
            billingOrder: 0,
            person: {
              id: "guitarricadelafuente",
              name: "Guitarricadelafuente",
              alternate_names: [],
            },
          },
        ],
      },
    ]);
    expect(prepared.publications[0].observations[0].review).toBeNull();
    expect(batch.publications[0].observations[0].originalValue.raw).toBe(
      "*Guitarricadelafuente, La Bola Negra",
    );
  });
});
