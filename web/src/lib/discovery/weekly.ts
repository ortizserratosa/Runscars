import type { PredictionAggregateV2 } from "../aggregation/v2";
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export function weekStart(date: Date) {
  const copy = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  copy.setUTCDate(copy.getUTCDate() - ((copy.getUTCDay() + 6) % 7));
  return copy.toISOString().slice(0, 10);
}
export function validWeek(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    weekStart(date) === value &&
    value >= "2026-01-05" &&
    value <= weekStart(now)
  );
}
export function weeklyMovements(
  current: PredictionAggregateV2,
  previous: PredictionAggregateV2 | null,
) {
  if (
    !previous ||
    previous.methodVersion !== current.methodVersion ||
    previous.categoryId !== current.categoryId ||
    previous.intention !== current.intention ||
    previous.seasonId !== current.seasonId
  )
    return [];
  const positions = new Map(
    previous.ranking.map((candidate) => [
      candidate.candidateId,
      candidate.position,
    ]),
  );
  return current.ranking
    .map((candidate) => ({
      ...candidate,
      previousPosition: positions.get(candidate.candidateId) ?? null,
      movement: positions.has(candidate.candidateId)
        ? positions.get(candidate.candidateId)! - candidate.position
        : null,
    }))
    .filter((candidate) => candidate.movement !== 0)
    .sort(
      (a, b) =>
        Math.abs(b.movement ?? 0) - Math.abs(a.movement ?? 0) ||
        a.position - b.position,
    );
}
export function escapeXml(value: string) {
  return value.replace(
    /[<>&"']/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );
}
