import { describe, expect, it } from "vitest";
import {
  criticalCanonicalReviewId,
  criticalOriginalDisplay,
  criticalScaleLabel,
} from "../../src/lib/critical/presentation";

describe("critical presentation", () => {
  it("keeps Tomatometer as a percentage and preserves its denominator", () => {
    expect(
      criticalOriginalDisplay({
        dataType: "score_aggregate",
        numericValue: 94,
        scaleMax: 100,
        scaleLabel: "Tomatometer",
      }),
    ).toBe("94%");
    expect(
      criticalScaleLabel({
        minimum: 0,
        maximum: 100,
        unit: "Tomatometer approval",
        denominator: 500,
      }),
    ).toBe("Tomatometer · 500 críticas");
  });

  it("keeps Metascore on its original 0–100 scale", () => {
    expect(
      criticalOriginalDisplay({
        dataType: "score_aggregate",
        numericValue: 88,
        scaleMax: 100,
        scaleLabel: "Metascore",
      }),
    ).toBe("88/100");
    expect(criticalScaleLabel({ unit: "Metascore; 63 critic reviews" })).toBe(
      "Metascore · 63 críticas",
    );
  });

  it("prefers an explicit canonical review identity", () => {
    expect(
      criticalCanonicalReviewId(
        { canonical_review_id: "guardian-odyssey" },
        "aggregator-row-1",
      ),
    ).toBe("guardian-odyssey");
  });
});
