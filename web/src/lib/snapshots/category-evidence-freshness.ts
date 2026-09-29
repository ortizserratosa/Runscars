export const CATEGORY_FRESHNESS_SOURCE_IDS = [
  "next-best-picture",
  "midnight-critics",
] as const;

const PERSONAL_CATEGORIES = new Set([
  "directing",
  "actor",
  "actress",
  "supporting-actor",
  "supporting-actress",
]);
const SCREENPLAY_CATEGORIES = new Set([
  "original-screenplay",
  "adapted-screenplay",
]);

export type CategoryEvidenceCapture = {
  id: string;
  sourceId: string;
  publicationUrl: string;
  capturedAt: string;
  originalData: unknown;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string"
    ? value.normalize("NFC").trim().replace(/\s+/gu, " ")
    : "";
}

/** Only the complete, pre-matching NBP/MCC capture format is supported. */
function categorySignature(
  capture: CategoryEvidenceCapture,
  categoryId: string,
) {
  if (!CATEGORY_FRESHNESS_SOURCE_IDS.some((id) => id === capture.sourceId)) {
    return null;
  }
  const original = record(capture.originalData);
  if (
    !original ||
    (original.source_id && original.source_id !== capture.sourceId) ||
    original.publication_date
  ) {
    return null;
  }
  const categories = record(original.categories);
  const rows = categories?.[categoryId];
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const entries: { subject: string; rank: number | null }[] = [];
  for (const value of rows) {
    const row = record(value);
    const parts = record(row?.parts);
    const subject = text(parts?.subject);
    const film = text(parts?.filmSubject);
    if (!row || !parts || !subject || !film) return null;
    if (
      PERSONAL_CATEGORIES.has(categoryId) &&
      (!Array.isArray(parts.peopleSubjects) ||
        parts.peopleSubjects.length === 0 ||
        parts.peopleSubjects.some((person) => !text(person)))
    ) {
      return null;
    }
    if (
      row.rank !== null &&
      (typeof row.rank !== "number" ||
        !Number.isInteger(row.rank) ||
        row.rank <= 0)
    ) {
      return null;
    }
    entries.push({
      // Screenplay candidacies are films; CMS writer/distributor credits are
      // not changes to the film being predicted. Personal subjects retain names.
      subject: SCREENPLAY_CATEGORIES.has(categoryId) ? film : subject,
      rank: row.rank,
    });
  }
  if (new Set(entries.map((entry) => entry.subject)).size !== entries.length) {
    return null;
  }
  const ordered = entries.some((entry) => entry.rank !== null);
  entries.sort(
    (left, right) =>
      (left.rank ?? 0) - (right.rank ?? 0) ||
      left.subject.localeCompare(right.subject, "en"),
  );
  if (ordered && entries.some((entry, index) => entry.rank !== index + 1)) {
    return null;
  }
  return JSON.stringify({
    dataType: ordered ? "prediction_ordered" : "prediction_selection",
    listLength: entries.length,
    entries,
  });
}

/** Dates consecutive unchanged category evidence without rewriting captures. */
export function categoryEvidenceFreshness(
  captures: readonly CategoryEvidenceCapture[],
  categoryId: string,
): Map<string, string> {
  const dates = new Map<string, string>();
  const previousByPage = new Map<
    string,
    { signature: string | null; freshnessAt: string }
  >();
  const ordered = [...captures].sort(
    (left, right) =>
      Date.parse(left.capturedAt) - Date.parse(right.capturedAt) ||
      left.id.localeCompare(right.id, "en", { numeric: true }),
  );
  for (const capture of ordered) {
    if (!Number.isFinite(Date.parse(capture.capturedAt))) continue;
    const key = JSON.stringify([capture.sourceId, capture.publicationUrl]);
    const signature = categorySignature(capture, categoryId);
    const previous = previousByPage.get(key);
    const freshnessAt =
      signature !== null && previous?.signature === signature
        ? previous.freshnessAt
        : capture.capturedAt;
    previousByPage.set(key, { signature, freshnessAt });
    if (signature !== null) dates.set(capture.id, freshnessAt);
  }
  return dates;
}
