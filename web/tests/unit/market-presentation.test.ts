import { describe, expect, it } from "vitest";
import { selectMarketSignals } from "../../src/lib/markets/presentation";

describe("market presentation", () => {
  it("keeps providers and intentions separate and ranks by probability", () => {
    const selected = selectMarketSignals(
      [
        {
          provider: "kalshi" as const,
          intention: "nomination" as const,
          outcome: "B",
          probability: 0.62,
          volume: 20,
        },
        {
          provider: "kalshi" as const,
          intention: "nomination" as const,
          outcome: "A",
          probability: 0.72,
          volume: 10,
        },
        {
          provider: "kalshi" as const,
          intention: "winner" as const,
          outcome: "C",
          probability: 0.31,
          volume: 50,
        },
        {
          provider: "polymarket" as const,
          intention: "winner" as const,
          outcome: "D",
          probability: 0.34,
          volume: 5,
        },
      ],
      1,
    );
    expect(selected.kalshi.map((market) => market.outcome)).toEqual(["A", "C"]);
    expect(selected.polymarket.map((market) => market.outcome)).toEqual(["D"]);
  });
});
