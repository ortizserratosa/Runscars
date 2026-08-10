import type { RealProviderCut } from "./provider-cuts";

export type ConnectorFreshnessState = {
  lastSuccessfulCheckAt: string | null;
  lastFailureAt: string | null;
};

export type SourceFreshnessView = {
  sourceId: string;
  sourceName: string;
  publicationUrl: string;
  publishedAt: string | null;
  lastChangedAt: string;
  lastSuccessfulCheckAt: string | null;
  lastFailureAt: string | null;
  status: "ok" | "failed" | "unknown";
  changedInSelectedCut: boolean;
};

function freshnessStatus(state: ConnectorFreshnessState | undefined) {
  if (!state) return "unknown" as const;
  const successful = state.lastSuccessfulCheckAt
    ? Date.parse(state.lastSuccessfulCheckAt)
    : Number.NEGATIVE_INFINITY;
  const failed = state.lastFailureAt
    ? Date.parse(state.lastFailureAt)
    : Number.NEGATIVE_INFINITY;
  if (failed > successful) return "failed" as const;
  if (Number.isFinite(successful)) return "ok" as const;
  return "unknown" as const;
}

export function sourceFreshnessForCut(
  cuts: RealProviderCut[],
  selectedIndex: number,
  connectorStates: Map<string, ConnectorFreshnessState>,
): SourceFreshnessView[] {
  const selected = cuts[selectedIndex];
  if (!selected) return [];

  return selected.aggregate.sourceLists
    .map((source): SourceFreshnessView => {
      const lastChanged = cuts
        .slice(0, selectedIndex + 1)
        .reverse()
        .find((cut) => cut.changedSourceIds.includes(source.sourceId));
      const connector = connectorStates.get(source.sourceId);
      return {
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        publicationUrl: source.publicationUrl,
        publishedAt: source.publishedAt,
        lastChangedAt: lastChanged?.lockedAt ?? selected.lockedAt,
        lastSuccessfulCheckAt: connector?.lastSuccessfulCheckAt ?? null,
        lastFailureAt: connector?.lastFailureAt ?? null,
        status: freshnessStatus(connector),
        changedInSelectedCut: selected.changedSourceIds.includes(
          source.sourceId,
        ),
      };
    })
    .sort((left, right) =>
      left.sourceName.localeCompare(right.sourceName, "es"),
    );
}
