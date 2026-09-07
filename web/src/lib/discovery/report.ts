import "server-only";
import { cache } from "react";
import { PUBLIC_CATEGORIES } from "../categories/config";
import { getCategoryView, type ActiveCategoryView } from "../categories/data";
import { weekStart, WEEK_MS, weeklyMovements } from "./weekly";

const getCurrentViews = cache(async () =>
  Promise.all(
    PUBLIC_CATEGORIES.map(async (category) => ({
      category,
      view: (await getCategoryView(2027, category.id)) as ActiveCategoryView,
    })),
  ),
);
export const listDigestWeeks = cache(async () => {
  const categories = await getCurrentViews();
  return [
    ...new Set(
      categories.flatMap(
        ({ view }) =>
          view.snapshot?.cuts.map((cut) => weekStart(new Date(cut.lockedAt))) ??
          [],
      ),
    ),
  ]
    .sort()
    .reverse()
    .slice(0, 12);
});
export const getWeeklyReport = cache(async (week: string) => {
  const start = new Date(`${week}T00:00:00Z`).getTime();
  const end = start + WEEK_MS;
  const categories = await getCurrentViews();
  const reports = await Promise.all(
    categories.map(async ({ category, view }) => {
      const cuts = view.snapshot?.cuts ?? [];
      const final = cuts.find((cut) => Date.parse(cut.lockedAt) < end);
      const baseline = cuts.find((cut) => Date.parse(cut.lockedAt) < start);
      const inWeek = cuts.filter(
        (cut) =>
          Date.parse(cut.lockedAt) >= start && Date.parse(cut.lockedAt) < end,
      );
      const [current, previous] = await Promise.all([
        final
          ? (getCategoryView(2027, category.id, {
              snapshotId: final.id,
            }) as Promise<ActiveCategoryView>)
          : null,
        baseline
          ? (getCategoryView(2027, category.id, {
              snapshotId: baseline.id,
            }) as Promise<ActiveCategoryView>)
          : null,
      ]);
      const sources = [...new Set(inWeek.flatMap((cut) => cut.changedSources))];
      return {
        category,
        leader: current?.aggregate?.ranking[0] ?? null,
        cut: final ?? null,
        changes: inWeek.length,
        sources,
        movements: current?.aggregate
          ? weeklyMovements(
              current.aggregate,
              previous?.aggregate ?? null,
            ).slice(0, 3)
          : [],
        hasBaseline: Boolean(previous?.aggregate),
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
