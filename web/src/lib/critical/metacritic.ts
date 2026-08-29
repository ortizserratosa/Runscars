export type MetascoreTone = "positive" | "mixed" | "negative";

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegativeInteger(value: unknown) {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : null;
}

export function metascoreTone(score: number): MetascoreTone {
  if (score >= 61) return "positive";
  if (score >= 40) return "mixed";
  return "negative";
}

export function parseMetacriticValues(
  originalValue: unknown,
  originalScale: unknown,
) {
  const value =
    typeof originalValue === "object" &&
    originalValue !== null &&
    !Array.isArray(originalValue)
      ? (originalValue as Record<string, unknown>)
      : {};
  const scale =
    typeof originalScale === "object" &&
    originalScale !== null &&
    !Array.isArray(originalScale)
      ? (originalScale as Record<string, unknown>)
      : {};
  const score = finiteNumber(value.score ?? value.value);
  if (score === null || !Number.isInteger(score) || score < 0 || score > 100)
    return null;
  const reviewCount = nonNegativeInteger(
    value.critic_review_count ??
      value.criticReviewCount ??
      scale.denominator ??
      scale.reviewCount,
  );
  return { score, reviewCount };
}

export function isMetacriticTitleUrl(value: string) {
  try {
    const url = new URL(value);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    return (
      url.protocol === "https:" &&
      (url.hostname === "metacritic.com" ||
        url.hostname === "www.metacritic.com") &&
      pathSegments.length === 2 &&
      pathSegments[0] === "movie"
    );
  } catch {
    return false;
  }
}
