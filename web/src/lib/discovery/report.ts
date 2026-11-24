import "server-only";
import { cache } from "react";
import { PUBLIC_CATEGORIES } from "../categories/config";
import type { ActiveCategoryView } from "../categories/data";
import type { PredictionAggregateV2 } from "../aggregation/v2";
import { isSupabaseConfigured } from "../environment";
import { weekStart, WEEK_MS, weeklyMovements } from "./weekly";
import {
  canCompareSnapshotMovements,
  compareSnapshotMovements,
} from "../snapshots/movements";
import {
  getCurrentPublicSnapshotPointers,
  getPublicHistorySelection,
  type PublicHistorySelection,
} from "../snapshots/public-history";

type DigestSelection = {
  aggregate: PredictionAggregateV2 | null;
  comparisonDateIncomplete: boolean;
};
type DigestHistory = {
  category: (typeof PUBLIC_CATEGORIES)[number];
  cuts: NonNullable<ActiveCategoryView["snapshot"]>["cuts"];
  loadCut: (snapshotId: string) => Promise<DigestSelection>;
};

function digestSelection(selection: PublicHistorySelection): DigestSelection {
  const { selected, previous } = selection;
  return {
    aggregate: selected
      ? compareSnapshotMovements(
          selected.aggregate,
          previous &&
            !selected.comparisonDateIncomplete &&
            !previous.comparisonDateIncomplete &&
            canCompareSnapshotMovements(selected.aggregate, previous.aggregate)
            ? previous.aggregate
            : null,
        )
      : null,
    comparisonDateIncomplete: selected?.comparisonDateIncomplete ?? false,
  };
}

// Reuse the public history leaves keyed by snapshot pointer and integrity
// corrections. Weekly reports do not need live markets, connector health or
// source-status queries for each current/final/baseline category view.
const getCurrentHistories = cache(async (): Promise<DigestHistory[]> => {
  if (!isSupabaseConfigured()) {
    // Keep the established fixture/unconfigured behaviour without loading any
    // of the category-page context on the production database path.
    const { getCategoryView } = await import("../categories/data");
    return Promise.all(
      PUBLIC_CATEGORIES.map(async (category) => {
        const view = (await getCategoryView(
          2027,
          category.id,
        )) as ActiveCategoryView;
        return {
          category,
          cuts: view.snapshot?.cuts ?? [],
          loadCut: async (snapshotId: string) => {
            const selected = (await getCategoryView(2027, category.id, {
              snapshotId,
            })) as ActiveCategoryView;
            return {
              aggregate: selected.aggregate,
              comparisonDateIncomplete:
                selected.snapshot?.comparisonDateIncomplete ?? false,
            };
          },
        };
      }),
    );
  }

  const pointers = await getCurrentPublicSnapshotPointers();
  const pointerByCategory = new Map(
    pointers.map((pointer) => [pointer.category_id, pointer.snapshot_id]),
  );
  return Promise.all(
    PUBLIC_CATEGORIES.map(async (category) => {
      const pointerId = pointerByCategory.get(category.id);
      const selection = pointerId
        ? await getPublicHistorySelection(category.id, pointerId)
        : null;
      return {
        category,
        cuts: selection
          ? [...selection.cuts].reverse().map((cut) => ({
              id: cut.id,
              lockedAt: cut.lockedAt,
              changedSources: cut.changedSourceIds.map(
                (sourceId) => selection.sourceNames[sourceId] ?? sourceId,
              ),
              isSelected: cut.id === selection.selected?.id,
            }))
          : [],
        loadCut: async (snapshotId: string) =>
          digestSelection(
            selection?.selected?.id === snapshotId
              ? selection
              : await getPublicHistorySelection(
                  category.id,
                  pointerId!,
                  snapshotId,
                ),
          ),
      };
    }),
  );
});

export const listDigestWeeks = cache(async () => {
  const categories = await getCurrentHistories();
  return [
    ...new Set(
      categories.flatMap(({ cuts }) =>
        cuts.map((cut) => weekStart(new Date(cut.lockedAt))),
      ),
    ),
  ]
    .sort()
    .reverse();
});
export const getWeeklyReport = cache(async (week: string) => {
  const start = new Date(`${week}T00:00:00Z`).getTime();
  const end = start + WEEK_MS;
  const categories = await getCurrentHistories();
  const reports = await Promise.all(
    categories.map(async ({ category, cuts, loadCut }) => {
      const final = cuts.find((cut) => Date.parse(cut.lockedAt) < end);
      const baseline = cuts.find((cut) => Date.parse(cut.lockedAt) < start);
      const inWeek = cuts.filter(
        (cut) =>
          Date.parse(cut.lockedAt) >= start && Date.parse(cut.lockedAt) < end,
      );
      const [current, previous] = await Promise.all([
        final ? loadCut(final.id) : null,
        baseline ? loadCut(baseline.id) : null,
      ]);
      const sources = [...new Set(inWeek.flatMap((cut) => cut.changedSources))];
      const comparisonLimited = Boolean(
        current?.aggregate &&
        previous?.aggregate &&
        (current.comparisonDateIncomplete || previous.comparisonDateIncomplete),
      );
      return {
        category,
        leader: current?.aggregate?.ranking[0] ?? null,
        cut: final ?? null,
        changes: inWeek.length,
        sources,
        movements:
          current?.aggregate && !comparisonLimited
            ? weeklyMovements(
                current.aggregate,
                previous?.aggregate ?? null,
              ).slice(0, 3)
            : [],
        methodologyChanged: Boolean(
          current?.aggregate &&
          previous?.aggregate &&
          !canCompareSnapshotMovements(current.aggregate, previous.aggregate),
        ),
        comparisonLimited,
        hasBaseline: Boolean(
          current?.aggregate &&
          previous?.aggregate &&
          !comparisonLimited &&
          canCompareSnapshotMovements(current.aggregate, previous.aggregate),
        ),
      };
    }),
  );
  return {
    week,
    endsOn: new Date(end - 1).toISOString().slice(0, 10),
    categories: reports,
    changes: reports.reduce((sum, report) => sum + report.changes, 0),
    updatedAt:
      reports
        .flatMap((report) =>
          report.changes && report.cut ? [report.cut.lockedAt] : [],
        )
        .sort()
        .at(-1) ?? null,
  };
});
