import type { PredictionAggregateV2 } from "../aggregation/v2";
import { sha256 } from ".";

export const SNAPSHOT_SCHEMA_VERSION_V2 = "runscars-snapshot-v2";
export const EVALUATION_METHOD_VERSION_V2 = "runscars-evaluation-v2";

export type PredictionSnapshotPayloadV2 = {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION_V2;
  kind: "periodic" | "nomination_final" | "winner_final";
  seasonId: string;
  categoryId: string;
  intention: "nomination" | "winner";
  cutoffAt: string;
  timeZone: string;
  methodVersion: PredictionAggregateV2["methodVersion"];
  activeSourceIds: string[];
  includedObservationIds: string[];
  excludedObservationIds: string[];
  selectionSize: number | null;
  selectedCandidateIds: string[];
  aggregate: PredictionAggregateV2;
};

export type LockedPredictionSnapshotV2 = {
  id: string;
  contentHash: string;
  lockedAt: string;
  lockedBy: string;
  correctsSnapshotId: string | null;
  correctionReason: string | null;
  payload: PredictionSnapshotPayloadV2;
};

export type OfficialResultEntryV2 = {
  categoryId: string;
  candidateId: string;
  categoryCandidateId: string;
  outcome: "nominee" | "winner";
};

export type OfficialResultsPayloadV2 = {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION_V2;
  seasonId: string;
  kind: "nominations" | "winners";
  source: {
    sourceId: string;
    sourceUrl: string;
    author: string | null;
    publishedAt: string;
    capturedAt: string;
  };
  entries: OfficialResultEntryV2[];
  originalData: Record<string, unknown>;
};

function isoInstant(value: string, field: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`${field} no es una fecha válida`);
  }
  return date.toISOString();
}

function requiredText(value: string, field: string) {
  if (!value.trim()) throw new Error(`Falta ${field}`);
  return value.trim();
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

export function createPredictionSnapshotPayloadV2(
  aggregate: PredictionAggregateV2,
  options: {
    kind: PredictionSnapshotPayloadV2["kind"];
    cutoffAt: string;
    timeZone: string;
    selectionSize?: number | null;
  },
): PredictionSnapshotPayloadV2 {
  const cutoffAt = isoInstant(options.cutoffAt, "cutoffAt");
  const aggregateCutoff = isoInstant(
    aggregate.cutoffDate.length === 10
      ? `${aggregate.cutoffDate}T23:59:59.999Z`
      : aggregate.cutoffDate,
    "aggregate.cutoffDate",
  );
  if (cutoffAt !== aggregateCutoff) {
    throw new Error("El corte no coincide con el agregado v2");
  }
  if (
    (options.kind === "nomination_final" &&
      aggregate.intention !== "nomination") ||
    (options.kind === "winner_final" && aggregate.intention !== "winner")
  ) {
    throw new Error("El tipo de snapshot no coincide con su intención");
  }
  const selectionSize =
    options.kind === "winner_final" ? 1 : (options.selectionSize ?? null);
  if (
    options.kind !== "periodic" &&
    (selectionSize === null ||
      !Number.isInteger(selectionSize) ||
      selectionSize <= 0 ||
      selectionSize > aggregate.ranking.length)
  ) {
    throw new Error("Un cierre final necesita una selección válida");
  }
  if (options.kind === "periodic" && selectionSize !== null) {
    throw new Error("Un snapshot periódico no fija selección");
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
  new Intl.DateTimeFormat("en", { timeZone: options.timeZone }).format();

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION_V2,
    kind: options.kind,
    seasonId: aggregate.seasonId,
    categoryId: aggregate.categoryId,
    intention: aggregate.intention,
    cutoffAt,
    timeZone: requiredText(options.timeZone, "timeZone"),
    methodVersion: aggregate.methodVersion,
    activeSourceIds,
    includedObservationIds: uniqueSorted(aggregate.includedObservationIds),
    excludedObservationIds: uniqueSorted(aggregate.excludedObservationIds),
    selectionSize,
    selectedCandidateIds:
      selectionSize === null
        ? []
        : aggregate.ranking
            .slice(0, selectionSize)
            .map((candidate) => candidate.candidateId),
    aggregate,
  };
}

export async function lockPredictionSnapshotV2(
  payload: PredictionSnapshotPayloadV2,
  options: {
    id?: string;
    lockedAt: string;
    lockedBy: string;
    correctsSnapshotId?: string | null;
    correctionReason?: string | null;
  },
): Promise<LockedPredictionSnapshotV2> {
  const contentHash = await sha256(payload);
  const correctedId = options.correctsSnapshotId?.trim() || null;
  const correctionReason = options.correctionReason?.trim() || null;
  if ((correctedId === null) !== (correctionReason === null)) {
    throw new Error("Una corrección exige snapshot y motivo");
  }
  return {
    id:
      options.id?.trim() ||
      [
        payload.kind.replaceAll("_", "-"),
        payload.seasonId,
        payload.categoryId,
        payload.intention,
        payload.cutoffAt.slice(0, 10),
        contentHash.slice(0, 12),
      ].join("-"),
    contentHash,
    lockedAt: isoInstant(options.lockedAt, "lockedAt"),
    lockedBy: requiredText(options.lockedBy, "lockedBy"),
    correctsSnapshotId: correctedId,
    correctionReason,
    payload,
  };
}

export function createOfficialResultsPayloadV2(
  input: Omit<OfficialResultsPayloadV2, "schemaVersion">,
): OfficialResultsPayloadV2 {
  const sourceUrl = new URL(requiredText(input.source.sourceUrl, "sourceUrl"));
  if (sourceUrl.protocol !== "https:") {
    throw new Error("La procedencia oficial debe usar HTTPS");
  }
  const seen = new Set<string>();
  const winnersByCategory = new Map<string, number>();
  const entries = input.entries
    .map((entry) => {
      const categoryId = requiredText(entry.categoryId, "categoryId");
      const categoryCandidateId = requiredText(
        entry.categoryCandidateId,
        "categoryCandidateId",
      );
      if (entry.candidateId !== categoryCandidateId) {
        throw new Error("candidateId debe ser la candidatura canónica v2");
      }
      if (
        (input.kind === "nominations" && entry.outcome !== "nominee") ||
        (input.kind === "winners" && entry.outcome !== "winner")
      ) {
        throw new Error("El resultado no coincide con el tipo de publicación");
      }
      const key = `${categoryId}::${categoryCandidateId}`;
      if (seen.has(key)) throw new Error(`Resultado duplicado: ${key}`);
      seen.add(key);
      if (entry.outcome === "winner") {
        winnersByCategory.set(
          categoryId,
          (winnersByCategory.get(categoryId) ?? 0) + 1,
        );
      }
      return {
        categoryId,
        candidateId: categoryCandidateId,
        categoryCandidateId,
        outcome: entry.outcome,
      };
    })
    .sort(
      (left, right) =>
        left.categoryId.localeCompare(right.categoryId, "en") ||
        left.candidateId.localeCompare(right.candidateId, "en"),
    );
  if (
    input.kind === "winners" &&
    [...winnersByCategory.values()].some((count) => count !== 1)
  ) {
    throw new Error("Cada categoría debe tener un ganador");
  }
  if (entries.length === 0) {
    throw new Error("Un resultado oficial necesita candidaturas");
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION_V2,
    seasonId: requiredText(input.seasonId, "seasonId"),
    kind: input.kind,
    source: {
      sourceId: requiredText(input.source.sourceId, "sourceId"),
      sourceUrl: sourceUrl.toString(),
      author: input.source.author?.trim() || null,
      publishedAt: isoInstant(input.source.publishedAt, "publishedAt"),
      capturedAt: isoInstant(input.source.capturedAt, "capturedAt"),
    },
    entries,
    originalData: input.originalData,
  };
}
