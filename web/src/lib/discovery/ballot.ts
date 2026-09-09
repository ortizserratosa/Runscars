export const draftKey = (categoryId: string) =>
  `runscars:ballot:oscars-2027:${categoryId}`;
export function readDraft(
  raw: string | null,
  candidates: string[],
  limit: number,
  now = Date.now(),
): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("savedAt" in value) ||
      typeof value.savedAt !== "number" ||
      value.savedAt > now ||
      now - value.savedAt > 30 * 86400000 ||
      !("ids" in value) ||
      !Array.isArray(value.ids)
    )
      return [];
    const allowed = new Set(candidates);
    return [
      ...new Set(
        value.ids.filter(
          (id): id is string => typeof id === "string" && allowed.has(id),
        ),
      ),
    ].slice(0, limit);
  } catch {
    return [];
  }
}

export function serializeDraft(ids: string[], savedAt = Date.now()) {
  return JSON.stringify({ savedAt, ids });
}
