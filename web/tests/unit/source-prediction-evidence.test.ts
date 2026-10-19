import { describe, expect, it } from "vitest";
import { phase71FixtureAggregate } from "../../src/data/phase71-fixture";
import type { CurrentCategoryPredictionView } from "../../src/lib/repositories/signals";
import {
  predictionEvidenceState,
  sourceEvidenceCategories,
  type PredictionEvidenceRow,
} from "../../src/lib/repositories/source-evidence";

function prediction(): CurrentCategoryPredictionView {
  const aggregate = phase71FixtureAggregate("best-picture");
  aggregate.sourceLists = [
    {
      sourceId: "radar",
      sourceName: "Radar",
      publicationId: "article",
      publicationUrl: "https://example.com/article",
      publishedAt: "2026-10-14T00:00:00Z",
      listLength: 50,
      orderedObservationIds: ["1"],
      selectionObservationIds: [],
    },
  ];
  aggregate.ranking = [];
  aggregate.scoringDepth = 20;
  return {
    categoryId: "best-picture",
    categorySlug: "mejor-pelicula",
    categoryName: "Mejor película",
    lockedAt: "2026-10-19T04:47:00Z",
    changedSourceIds: [],
    sourceLastChangedAt: {},
    aggregate,
  };
}
function row(id: number, rank: number): PredictionEvidenceRow {
  return {
    id,
    source_id: "radar",
    source_name: "Radar",
    category_id: "best-picture",
    prediction_intention: "nomination",
    category_candidate_id: `film-${id}`,
    candidate_label: `Film ${id}`,
    original_subject: `Original ${id}`,
    original_value: { rank, list_length: 50, raw: `Original ${id}` },
    data_type: "prediction_ordered",
    participates: true,
    published_at: "2026-10-14T00:00:00Z",
    captured_at: "2026-10-19T04:17:00Z",
    freshness_at: "2026-10-14T00:00:00Z",
    extractor_version: "test-v1",
    publication_external_id: "article",
    publication_title: "Prediction",
    publication_url: "https://example.com/article",
    author: "Author",
  };
}

describe("public prediction source evidence", () => {
  it("preserves original tail ranks and list length while distinguishing the scoring subset", () => {
    const [category] = sourceEvidenceCategories(
      [row(1, 1), row(2, 50)],
      [prediction()],
      [],
      "2026-10-19T00:00:00Z",
    );
    expect(category.originalCount).toBe(50);
    expect(category.matchedCount).toBe(2);
    expect(category.consideredCount).toBe(1);
    expect(
      category.entries.map((entry) => [entry.rank, entry.considered]),
    ).toEqual([
      [1, true],
      [50, false],
    ]);
    expect(category.entries[1].originalValue).toEqual({
      rank: 50,
      list_length: 50,
      raw: "Original 2",
    });
  });
  it("shows the original selection size without publishing unmatched identities", () => {
    const evidence = {
      ...row(1, 1),
      data_type: "prediction_selection" as const,
      original_value: { raw: "Matched choice" },
      original_count: 5,
    };
    const [category] = sourceEvidenceCategories(
      [evidence],
      [prediction()],
      [],
      "2026-10-19T00:00:00Z",
    );
    expect(category.originalCount).toBe(5);
    expect(category.matchedCount).toBe(1);
    expect(category.entries).toHaveLength(1);
    expect(category.entries[0].appearanceKind).toBe("selection");
  });

  it("keeps expired publications visible alongside successful technical checks", () => {
    const [category] = sourceEvidenceCategories(
      [row(1, 1)],
      [prediction()],
      [
        {
          source_id: "radar",
          category_id: "best-picture",
          last_successful_check_at: "2026-11-19T04:17:00Z",
          last_failure_at: null,
          has_current_failure: false,
        },
      ],
      "2026-11-19T05:00:00Z",
    );
    expect(category.expired).toBe(true);
    expect(category.health).toBe("ok");
    expect(category.consideredCount).toBe(0);
    expect(category.publication.publishedAt).toBe("2026-10-14T00:00:00Z");
    expect(category.entries).toHaveLength(1);
  });
  it("does not mistake a failure in another category for the current category's health", () => {
    const [category] = sourceEvidenceCategories(
      [row(1, 1)],
      [prediction()],
      [
        {
          source_id: "radar",
          category_id: "actor",
          last_successful_check_at: null,
          last_failure_at: "2026-10-19T04:17:00Z",
          has_current_failure: true,
        },
        {
          source_id: "radar",
          category_id: "best-picture",
          last_successful_check_at: "2026-10-19T04:17:00Z",
          last_failure_at: null,
          has_current_failure: false,
        },
      ],
      "2026-10-19T05:00:00Z",
    );
    expect(category.health).toBe("ok");
    expect(category.expired).toBe(false);
  });
  it("uses category evidence age rather than the last technical capture", () => {
    expect(
      predictionEvidenceState("2026-09-17T04:17:00Z", "2026-10-19T04:17:00Z"),
    ).toEqual({
      freshnessAt: "2026-09-17T04:17:00Z",
      expiresAt: "2026-10-17T04:17:00.000Z",
      expired: true,
    });
  });
});
