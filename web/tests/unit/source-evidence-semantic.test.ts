import { describe, expect, it } from "vitest";
import {
  aggregatePredictionsV2,
  aggregatePredictionsV4,
  type PredictionAggregateV2,
  type PredictionObservationV2,
} from "../../src/lib/aggregation/v2";
import { hasEffectiveProviderChanges } from "../../src/lib/snapshots/provider-cuts";
import type { CurrentCategoryPredictionView } from "../../src/lib/repositories/signals";
import {
  sourceEvidenceCategories,
  type PredictionEvidenceRow,
} from "../../src/lib/repositories/source-evidence";

const cutoffDate = "2026-10-19T00:00:00Z";
const options = {
  seasonId: "oscars-2027",
  categoryId: "actor",
  intention: "nomination" as const,
  cutoffDate,
};

function observations(length: number): PredictionObservationV2[] {
  return Array.from({ length }, (_, i) => ({
    id: String(i + 1),
    sourceId: "source",
    sourceName: "Source",
    publicationId: "original",
    publicationUrl: "https://example.com/original",
    author: "Author",
    publishedAt: "2026-10-18T00:00:00Z",
    capturedAt: cutoffDate,
    seasonId: options.seasonId,
    categoryId: options.categoryId,
    intention: "nomination",
    candidate: {
      id: `candidate-${i + 1}`,
      label: `Candidate ${i + 1}`,
      seasonId: options.seasonId,
      categoryId: options.categoryId,
      film: { id: `film-${i + 1}`, title: `Film ${i + 1}` },
      workTitle: null,
      people: [],
    },
    dataType: "prediction_ordered",
    rank: i + 1,
    listLength: length,
    originalValue: `Original ${i + 1}`,
    participates: true,
    state: "published",
  }));
}

function evidence(rows: PredictionObservationV2[]): PredictionEvidenceRow[] {
  return rows.map((item, i) => ({
    id: 1000 + i,
    source_id: item.sourceId,
    source_name: item.sourceName,
    category_id: item.categoryId,
    prediction_intention: item.intention,
    category_candidate_id: item.candidate.id,
    candidate_label: item.candidate.label,
    original_subject: item.candidate.label,
    original_value: {
      rank: item.rank,
      list_length: item.listLength,
      raw: "Latest raw value",
    },
    data_type: item.dataType,
    participates: item.participates,
    published_at: item.publishedAt,
    captured_at: "2026-10-19T04:17:00Z",
    freshness_at: item.publishedAt!,
    extractor_version: "test-v2",
    publication_external_id: "new-immutable-revision",
    publication_title: "Latest prediction",
    publication_url: item.publicationUrl,
    author: item.author,
  }));
}

function prediction(
  aggregate: PredictionAggregateV2,
): CurrentCategoryPredictionView {
  return {
    categoryId: "actor",
    categorySlug: "actor",
    categoryName: "Actor",
    lockedAt: cutoffDate,
    changedSourceIds: [],
    sourceLastChangedAt: {},
    aggregate,
  };
}

function render(
  rows: PredictionEvidenceRow[],
  aggregate: PredictionAggregateV2,
  now = cutoffDate,
) {
  return sourceEvidenceCategories(rows, [prediction(aggregate)], [], now)[0];
}

describe("latest evidence and frozen semantic provider votes", () => {
  it("preserves considered head votes after a new immutable tail-only capture without a provider cut", () => {
    const aggregate = aggregatePredictionsV4(observations(20), options);
    const frozen = JSON.stringify(aggregate);
    const latest = observations(30);
    expect(
      hasEffectiveProviderChanges(
        aggregatePredictionsV4(latest, options),
        aggregate,
      ),
    ).toBe(false);
    const category = render(evidence(latest), aggregate);
    expect(category.consideredCount).toBe(10);
    expect(category.originalCount).toBe(30);
    expect(category.entries[0]).toMatchObject({
      observationId: "1000",
      rank: 1,
      listLength: 30,
      considered: true,
      points: 1,
      originalValue: { raw: "Latest raw value" },
    });
    expect(category.entries[9]).toMatchObject({
      rank: 10,
      considered: true,
      points: 0.1,
    });
    expect(category.entries[10]).toMatchObject({
      rank: 11,
      considered: false,
      points: 0,
    });
    expect(JSON.stringify(aggregate)).toBe(frozen);
  });

  it("retains latest provenance when a new article has the same complete effective ballot", () => {
    const aggregate = aggregatePredictionsV4(observations(20), options);
    const rows = evidence(observations(20)).map((row) => ({
      ...row,
      publication_url: "https://example.com/new-article",
    }));
    const category = render(rows, aggregate);
    expect(category.publication.url).toBe("https://example.com/new-article");
    expect(category.consideredCount).toBe(10);
    expect(category.entries[1].points).toBe(0.9);
  });

  it.each([
    "candidate",
    "rank",
    "missing",
    "nonparticipating",
    "duplicate",
    "selection",
  ])(
    "rejects every semantic bridge when the latest head has a %s change",
    (change) => {
      const aggregate = aggregatePredictionsV4(observations(20), options);
      const rows = evidence(observations(20));
      rows[0].id = 1; // A partial exact-ID overlap cannot validate the other head rows.
      if (change === "candidate")
        rows[1].category_candidate_id = "new-candidate";
      if (change === "rank") {
        rows[1].original_value = { rank: 3, list_length: 20 };
        rows[2].original_value = { rank: 2, list_length: 20 };
      }
      if (change === "missing") rows.splice(1, 1);
      if (change === "nonparticipating") rows[1].participates = false;
      if (change === "duplicate") rows.push({ ...rows[1], id: 9999 });
      if (change === "selection") rows[1].data_type = "prediction_selection";
      const category = render(rows, aggregate);
      expect(category.consideredCount).toBe(0);
      expect(
        category.entries.every((item) => !item.considered && item.points === 0),
      ).toBe(true);
    },
  );

  it("does not bridge a newly resolved candidate inside a previously incomplete matched head", () => {
    const before = observations(20).filter((row) => row.rank !== 3);
    const aggregate = aggregatePredictionsV4(before, options);
    expect(aggregate.sourceLists[0].consideredCount).toBe(9);
    expect(render(evidence(observations(20)), aggregate).consideredCount).toBe(
      0,
    );
  });

  it("does not reuse legacy points after the original list length changes", () => {
    const aggregate = aggregatePredictionsV2(observations(5), options);
    const rows = evidence(observations(5)).map((row) => ({
      ...row,
      original_value: { ...(row.original_value as object), list_length: 10 },
    }));
    expect(render(rows, aggregate).consideredCount).toBe(0);
  });

  it.each([undefined, 0, -1, 1.5, Number.NaN])(
    "rejects a v4 payload with invalid scoringDepth %s",
    (scoringDepth) => {
      const aggregate = {
        ...aggregatePredictionsV4(observations(20), options),
        scoringDepth,
      };
      expect(
        render(evidence(observations(20)), aggregate).consideredCount,
      ).toBe(0);
    },
  );

  it.each([false, true])(
    "retains unchanged legacy selections with an ordered block=%s",
    (mixed) => {
      const ordered = observations(5);
      const selection = {
        ...observations(6)[5],
        id: "selection",
        dataType: "prediction_selection" as const,
        rank: null,
        listLength: null,
      };
      const rows = mixed ? [...ordered, selection] : [selection];
      const aggregate = aggregatePredictionsV2(rows, options);
      expect(render(evidence(rows), aggregate).consideredCount).toBe(
        rows.length,
      );
    },
  );

  it("zeros expired source points while retaining the separate locked aggregate values", () => {
    const aggregate = aggregatePredictionsV4(observations(20), options);
    const category = render(
      evidence(observations(20)),
      aggregate,
      "2026-11-19T00:00:00Z",
    );
    expect(category.expired).toBe(true);
    expect(category.consideredCount).toBe(0);
    expect(
      category.entries.every((item) => !item.considered && item.points === 0),
    ).toBe(true);
    expect(category.entries[0].aggregateScore).toBe(100);
    expect(aggregate.ranking[0].sourceContributions[0].points).toBe(1);
  });

  it("checks the entire unordered selection and retains all explicit members", () => {
    const choices = observations(25).map((row) => ({
      ...row,
      dataType: "prediction_selection" as const,
      rank: null,
      listLength: null,
    }));
    const aggregate = aggregatePredictionsV4(choices, options);
    expect(render(evidence(choices), aggregate).consideredCount).toBe(25);
    expect(render(evidence(choices).slice(1), aggregate).consideredCount).toBe(
      0,
    );
  });

  it("compares mixed ordered and selection blocks without granting a selected candidate's tail row coverage", () => {
    const ordered = observations(20);
    const selection = {
      ...ordered[19],
      id: "selection",
      dataType: "prediction_selection" as const,
      rank: null,
      listLength: null,
    };
    const aggregate = aggregatePredictionsV4([...ordered, selection], options);
    const category = render(evidence([...ordered, selection]), aggregate);
    expect(category.consideredCount).toBe(11);
    expect(category.entries.find((item) => item.rank === 20)).toMatchObject({
      considered: false,
      points: 0,
    });
    expect(
      category.entries.find((item) => item.appearanceKind === "selection"),
    ).toMatchObject({ considered: true, points: 0 });
  });
});
