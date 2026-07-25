import {
  SNAPSHOT_SCHEMA_VERSION,
  type LockedOfficialResults,
  type LockedPredictionSnapshot,
  type OfficialResultEntry,
  type OfficialResultKind,
  type OfficialResultsPayload,
  type PredictionSnapshotKind,
  type PredictionSnapshotPayload,
} from "./types";
import type { PredictionAggregate } from "../aggregation";

export * from "./types";
export * from "./evaluation";

function requiredText(value: string, field: string) {
  if (!value.trim()) {
    throw new Error(`Falta ${field}`);
  }
  return value.trim();
}

function isoInstant(value: string, field: string) {
  const instant = new Date(value);
  if (Number.isNaN(instant.valueOf())) {
    throw new Error(`${field} no es una fecha válida`);
  }
  return instant.toISOString();
}

function validateTimeZone(value: string) {
  const timeZone = requiredText(value, "timeZone");
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
  } catch {
    throw new Error(`Zona horaria no válida: ${timeZone}`);
  }
  return timeZone;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

export function canonicalJson(value: unknown): string {
  if (value === undefined) {
    throw new Error("El JSON canónico no admite undefined");
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(
            (value as Record<string, unknown>)[key],
          )}`,
      )
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("Valor no serializable en JSON canónico");
  }
  return serialized;
}

export async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(
    typeof value === "string" ? value : canonicalJson(value),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

type PredictionSnapshotOptions = {
  kind: PredictionSnapshotKind;
  cutoffAt: string;
  timeZone: string;
  selectionSize?: number | null;
};

export function createPredictionSnapshotPayload(
  aggregate: PredictionAggregate,
  options: PredictionSnapshotOptions,
): PredictionSnapshotPayload {
  const cutoffAt = isoInstant(options.cutoffAt, "cutoffAt");
  const aggregateCutoff = isoInstant(
    aggregate.cutoffDate.length === 10
      ? `${aggregate.cutoffDate}T23:59:59.999Z`
      : aggregate.cutoffDate,
    "aggregate.cutoffDate",
  );
  if (cutoffAt !== aggregateCutoff) {
    throw new Error(
      `El corte ${cutoffAt} no coincide con el agregado ${aggregate.cutoffDate}`,
    );
  }

  if (
    (options.kind === "nomination_final" &&
      aggregate.intention !== "nomination") ||
    (options.kind === "winner_final" && aggregate.intention !== "winner")
  ) {
    throw new Error("El tipo de snapshot no coincide con su intención");
  }

  const requestedSelectionSize =
    options.kind === "winner_final" ? 1 : (options.selectionSize ?? null);
  if (
    options.kind !== "periodic" &&
    (requestedSelectionSize === null ||
      !Number.isInteger(requestedSelectionSize) ||
      requestedSelectionSize <= 0 ||
      requestedSelectionSize > aggregate.ranking.length)
  ) {
    throw new Error("Un cierre final necesita un tamaño de selección válido");
  }
  if (options.kind === "periodic" && requestedSelectionSize !== null) {
    throw new Error("Un snapshot periódico no fija una selección final");
  }

  const activeSourceIds = uniqueSorted(
    aggregate.sourceLists.map((source) => source.sourceId),
  );
  if (
    aggregate.ranking.length === 0 ||
    aggregate.includedObservationIds.length === 0 ||
    activeSourceIds.length === 0
  ) {
    throw new Error("No se puede bloquear un snapshot sin evidencia");
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    kind: options.kind,
    seasonId: aggregate.seasonId,
    categoryId: aggregate.categoryId,
    intention: aggregate.intention,
    cutoffAt,
    timeZone: validateTimeZone(options.timeZone),
    methodVersion: aggregate.methodVersion,
    activeSourceIds,
    includedObservationIds: uniqueSorted(aggregate.includedObservationIds),
    excludedObservationIds: uniqueSorted(aggregate.excludedObservationIds),
    selectionSize: requestedSelectionSize,
    selectedCandidateIds:
      requestedSelectionSize === null
        ? []
        : aggregate.ranking
            .slice(0, requestedSelectionSize)
            .map((candidate) => candidate.filmId),
    aggregate,
  };
}

type LockOptions = {
  id?: string;
  lockedAt: string;
  lockedBy: string;
  correctsSnapshotId?: string | null;
  correctionReason?: string | null;
};

function correctionFields(
  correctedId: string | null | undefined,
  reason: string | null | undefined,
  label: string,
) {
  const normalizedId = correctedId
    ? requiredText(correctedId, `${label} corregido`)
    : null;
  const normalizedReason = reason
    ? requiredText(reason, "motivo de corrección")
    : null;
  if ((normalizedId === null) !== (normalizedReason === null)) {
    throw new Error(
      "Una corrección necesita referencia original y motivo explícito",
    );
  }
  return { correctedId: normalizedId, reason: normalizedReason };
}

export async function lockPredictionSnapshot(
  payload: PredictionSnapshotPayload,
  options: LockOptions,
): Promise<LockedPredictionSnapshot> {
  const contentHash = await sha256(payload);
  const correction = correctionFields(
    options.correctsSnapshotId,
    options.correctionReason,
    "snapshot",
  );
  const defaultId = [
    payload.kind.replaceAll("_", "-"),
    payload.seasonId,
    payload.categoryId,
    payload.intention,
    payload.cutoffAt.slice(0, 10),
    contentHash.slice(0, 12),
  ].join("-");

  return {
    id: requiredText(options.id ?? defaultId, "snapshot.id"),
    contentHash,
    lockedAt: isoInstant(options.lockedAt, "lockedAt"),
    lockedBy: requiredText(options.lockedBy, "lockedBy"),
    correctsSnapshotId: correction.correctedId,
    correctionReason: correction.reason,
    payload,
  };
}

function normalizeOfficialEntries(
  kind: OfficialResultKind,
  entries: OfficialResultEntry[],
) {
  if (entries.length === 0) {
    throw new Error("Un resultado oficial necesita candidaturas");
  }
  const seen = new Set<string>();
  const winnersByCategory = new Map<string, number>();
  const normalized = entries.map((entry) => {
    const categoryId = requiredText(entry.categoryId, "categoryId");
    const candidateId = requiredText(entry.candidateId, "candidateId");
    const filmId = entry.filmId ? requiredText(entry.filmId, "filmId") : null;
    const personId = entry.personId
      ? requiredText(entry.personId, "personId")
      : null;
    if ((filmId === null) === (personId === null)) {
      throw new Error("Cada resultado identifica una película o una persona");
    }
    if (
      (kind === "nominations" && entry.outcome !== "nominee") ||
      (kind === "winners" && entry.outcome !== "winner")
    ) {
      throw new Error("El resultado no coincide con el tipo de publicación");
    }
    const key = `${categoryId}::${candidateId}`;
    if (seen.has(key)) {
      throw new Error(`Resultado oficial duplicado: ${key}`);
    }
    seen.add(key);
    if (entry.outcome === "winner") {
      winnersByCategory.set(
        categoryId,
        (winnersByCategory.get(categoryId) ?? 0) + 1,
      );
    }
    return {
      categoryId,
      candidateId,
      filmId,
      personId,
      outcome: entry.outcome,
    };
  });
  if (
    kind === "winners" &&
    [...winnersByCategory.values()].some((count) => count !== 1)
  ) {
    throw new Error("Cada categoría debe tener exactamente un ganador");
  }
  return normalized.sort(
    (left, right) =>
      left.categoryId.localeCompare(right.categoryId, "en") ||
      left.candidateId.localeCompare(right.candidateId, "en"),
  );
}

type OfficialResultsInput = Omit<
  OfficialResultsPayload,
  "schemaVersion" | "entries" | "source"
> & {
  source: OfficialResultsPayload["source"];
  entries: OfficialResultEntry[];
};

export function createOfficialResultsPayload(
  input: OfficialResultsInput,
): OfficialResultsPayload {
  const sourceUrl = new URL(requiredText(input.source.sourceUrl, "sourceUrl"));
  if (sourceUrl.protocol !== "https:") {
    throw new Error("La procedencia oficial debe usar HTTPS");
  }
  if (
    input.originalData === null ||
    Array.isArray(input.originalData) ||
    typeof input.originalData !== "object"
  ) {
    throw new Error("originalData debe ser un objeto");
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    seasonId: requiredText(input.seasonId, "seasonId"),
    kind: input.kind,
    source: {
      sourceId: requiredText(input.source.sourceId, "sourceId"),
      sourceUrl: sourceUrl.toString(),
      author: input.source.author?.trim() || null,
      publishedAt: isoInstant(input.source.publishedAt, "publishedAt"),
      capturedAt: isoInstant(input.source.capturedAt, "capturedAt"),
    },
    entries: normalizeOfficialEntries(input.kind, input.entries),
    originalData: input.originalData,
  };
}

type OfficialLockOptions = {
  id?: string;
  lockedAt: string;
  lockedBy: string;
  correctsResultSetId?: string | null;
  correctionReason?: string | null;
};

export async function lockOfficialResults(
  payload: OfficialResultsPayload,
  options: OfficialLockOptions,
): Promise<LockedOfficialResults> {
  const contentHash = await sha256(payload);
  const correction = correctionFields(
    options.correctsResultSetId,
    options.correctionReason,
    "resultado",
  );
  const defaultId = [
    payload.kind,
    payload.seasonId,
    payload.source.publishedAt.slice(0, 10),
    contentHash.slice(0, 12),
  ].join("-");

  return {
    id: requiredText(options.id ?? defaultId, "resultSet.id"),
    contentHash,
    lockedAt: isoInstant(options.lockedAt, "lockedAt"),
    lockedBy: requiredText(options.lockedBy, "lockedBy"),
    correctsResultSetId: correction.correctedId,
    correctionReason: correction.reason,
    payload,
  };
}
