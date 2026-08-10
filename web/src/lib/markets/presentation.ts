export type PresentableMarket = {
  provider: "kalshi" | "polymarket";
  intention: "nomination" | "winner";
  outcome: string;
  probability: number | null;
  volume: number | null;
};

export function selectMarketSignals<T extends PresentableMarket>(
  markets: T[],
  limitPerIntention = 4,
): Record<"kalshi" | "polymarket", T[]> {
  return Object.fromEntries(
    (["kalshi", "polymarket"] as const).map((provider) => [
      provider,
      (["nomination", "winner"] as const).flatMap((intention) =>
        markets
          .filter(
            (market) =>
              market.provider === provider && market.intention === intention,
          )
          .sort(
            (left, right) =>
              (right.probability ?? -1) - (left.probability ?? -1) ||
              (right.volume ?? 0) - (left.volume ?? 0) ||
              left.outcome.localeCompare(right.outcome, "es"),
          )
          .slice(0, limitPerIntention),
      ),
    ]),
  ) as Record<"kalshi" | "polymarket", T[]>;
}
