export const PREDICTION_FRESHNESS_DAYS = 30;

const PREDICTION_FRESHNESS_MS =
  PREDICTION_FRESHNESS_DAYS * 24 * 60 * 60 * 1_000;

/** A prediction remains eligible through its thirtieth day of age. */
export function isPredictionFresh(
  predictionDate: string,
  cutoffDate: string,
): boolean {
  return (
    Date.parse(cutoffDate) - Date.parse(predictionDate) <=
    PREDICTION_FRESHNESS_MS
  );
}
