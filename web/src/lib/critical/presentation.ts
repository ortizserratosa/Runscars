import type { CriticalScoreObservation } from "../aggregation";

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function unitLabel(value: string) {
  const normalized = value.toLocaleLowerCase("en");
  if (normalized.includes("tomatometer") || normalized.includes("approval")) {
    return "Tomatometer";
  }
  if (normalized.includes("metascore")) return "Metascore";
  return value;
}

function reviewCount(scale: Record<string, unknown>, unit: string) {
  const explicit = numeric(
    scale.denominator ??
      scale.reviewCount ??
      scale.criticReviewCount ??
      scale.reviews,
  );
  if (explicit !== null) return explicit;
  const embedded = unit.match(/(\d[\d,]*)\s+(?:critic\s+)?reviews?/i);
  return embedded ? Number(embedded[1].replaceAll(",", "")) : null;
}

export function criticalOriginalDisplay(input: {
  dataType: CriticalScoreObservation["dataType"];
  numericValue: number | null;
  scaleMax: number | null;
  scaleLabel: string;
}) {
  if (input.numericValue === null) return "Valor original no numérico";
  const normalizedLabel = input.scaleLabel.toLocaleLowerCase("en");
  if (
    input.dataType === "score_aggregate" &&
    (normalizedLabel.includes("tomatometer") ||
      normalizedLabel.includes("approval") ||
      normalizedLabel.includes("percent"))
  ) {
    return `${input.numericValue}%`;
  }
  return input.scaleMax === null
    ? String(input.numericValue)
    : `${input.numericValue}/${input.scaleMax}`;
}

export function criticalScaleLabel(scale: unknown) {
  const record =
    typeof scale === "object" && scale !== null && !Array.isArray(scale)
      ? (scale as Record<string, unknown>)
      : {};
  const unit = typeof record.unit === "string" ? record.unit : "";
  const label = unitLabel(unit || "escala original");
  const count = reviewCount(record, unit);
  return count === null ? label : `${label} · ${count} críticas`;
}

export function criticalCanonicalReviewId(
  originalValue: Record<string, unknown>,
  fallback: string,
) {
  const explicit =
    originalValue.canonicalReviewId ?? originalValue.canonical_review_id;
  return typeof explicit === "string" && explicit.trim() ? explicit : fallback;
}
