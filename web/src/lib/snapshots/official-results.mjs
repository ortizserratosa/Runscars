import { createClient } from "@supabase/supabase-js";
import {
  canonicalJson,
  prepareBatch,
  sha256,
} from "../../../../supabase/functions/_shared/ingestion/core.mjs";

export const SNAPSHOT_SCHEMA_VERSION = "runscars-snapshot-v1";
export const SNAPSHOT_SCHEMA_VERSION_V2 = "runscars-snapshot-v2";

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Falta ${field}`);
  }
  return value.trim();
}

function isoInstant(value, field) {
  const date = new Date(requiredText(value, field));
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`${field} no es una fecha válida`);
  }
  return date.toISOString();
}

function httpsUrl(value, field) {
  const url = new URL(requiredText(value, field));
  if (url.protocol !== "https:") {
    throw new Error(`${field} debe usar HTTPS`);
  }
  return url.toString();
}

function normalizeEntries(kind, entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("El manifiesto necesita resultados");
  }
  const seen = new Set();
  const winnerCounts = new Map();
  const normalized = entries.map((entry) => {
    const categoryId = requiredText(entry.categoryId, "entry.categoryId");
    const candidateId = requiredText(entry.candidateId, "entry.candidateId");
    const filmId = entry.filmId
      ? requiredText(entry.filmId, "entry.filmId")
      : null;
    const personId = entry.personId
      ? requiredText(entry.personId, "entry.personId")
      : null;
    if ((filmId === null) === (personId === null)) {
      throw new Error("Cada resultado identifica una película o una persona");
    }
    const outcome = requiredText(entry.outcome, "entry.outcome");
    if (
      (kind === "nominations" && outcome !== "nominee") ||
      (kind === "winners" && outcome !== "winner")
    ) {
      throw new Error("El resultado no coincide con el tipo de manifiesto");
    }
    const key = `${categoryId}::${candidateId}`;
    if (seen.has(key)) {
      throw new Error(`Resultado duplicado: ${key}`);
    }
    seen.add(key);
    if (outcome === "winner") {
      winnerCounts.set(categoryId, (winnerCounts.get(categoryId) ?? 0) + 1);
    }
    return {
      categoryId,
      candidateId,
      filmId,
      personId,
      outcome,
    };
  });
  if (
    kind === "winners" &&
    [...winnerCounts.values()].some((count) => count !== 1)
  ) {
    throw new Error("Cada categoría debe tener exactamente un ganador");
  }
  return normalized.sort(
    (left, right) =>
      left.categoryId.localeCompare(right.categoryId, "en") ||
      left.candidateId.localeCompare(right.candidateId, "en"),
  );
}

export async function prepareOfficialResultsManifest(
  manifest,
  { capturedAt, lockedBy },
) {
  if (!manifest || manifest.formatVersion !== 1) {
    throw new Error("El manifiesto oficial debe usar formatVersion 1");
  }
  const kind = requiredText(manifest.kind, "kind");
  if (!["nominations", "winners"].includes(kind)) {
    throw new Error("kind debe ser nominations o winners");
  }
  const seasonId = requiredText(manifest.seasonId, "seasonId");
  const publishedAt = isoInstant(manifest.source?.publishedAt, "publishedAt");
  const normalizedCapturedAt = isoInstant(capturedAt, "capturedAt");
  const sourceId = requiredText(manifest.source?.sourceId, "sourceId");
  const sourceUrl = httpsUrl(manifest.source?.sourceUrl, "sourceUrl");
  const entries = normalizeEntries(kind, manifest.entries);
  const payload = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    seasonId,
    kind,
    source: {
      sourceId,
      sourceUrl,
      author:
        typeof manifest.source?.author === "string" &&
        manifest.source.author.trim()
          ? manifest.source.author.trim()
          : null,
      publishedAt,
      capturedAt: normalizedCapturedAt,
    },
    entries,
    originalData: manifest.originalData ?? {
      manually_entered: true,
      canonical_source_url: sourceUrl,
    },
  };
  const contentHash = await sha256(canonicalJson(payload));
  const correctionId = manifest.correctsResultSetId
    ? requiredText(manifest.correctsResultSetId, "correctsResultSetId")
    : null;
  const correctionReason = manifest.correctionReason
    ? requiredText(manifest.correctionReason, "correctionReason")
    : null;
  if ((correctionId === null) !== (correctionReason === null)) {
    throw new Error("Una corrección necesita referencia y motivo");
  }

  return {
    id:
      manifest.id ??
      [kind, seasonId, publishedAt.slice(0, 10), contentHash.slice(0, 12)].join(
        "-",
      ),
    contentHash,
    lockedAt: normalizedCapturedAt,
    lockedBy: requiredText(lockedBy, "lockedBy"),
    correctsResultSetId: correctionId,
    correctionReason,
    payload,
  };
}

export async function prepareOfficialArchiveV2(
  archive,
  filmIdentities,
  { lockedBy },
) {
  if (!archive || archive.formatVersion !== 2) {
    throw new Error("El archivo oficial debe usar formatVersion 2");
  }
  const seasonId = requiredText(archive.seasonId, "seasonId");
  const capturedAt = isoInstant(archive.capturedAt, "capturedAt");
  const sourceId = requiredText(archive.source?.sourceId, "sourceId");
  const sourceUrl = httpsUrl(archive.source?.sourceUrl, "sourceUrl");
  const rawCandidates = archive.categories.flatMap((category) =>
    category.candidates.map((candidate) => ({
      categoryId: category.categoryId,
      ...candidate,
    })),
  );
  const prepared = await prepareBatch(
    {
      connectorId: "academy-archive-2026",
      sourceId,
      extractorVersion: "academy-archive-v1",
      seasonId,
      capturedAt,
      sourceUrl,
      publications: [
        {
          externalId: "oscars-ceremony-2026",
          canonicalUrl: sourceUrl,
          title: "The 98th Academy Awards | 2026",
          author: archive.source.author ?? null,
          publishedAt: archive.source.winnersPublishedAt,
          originalData: archive,
          observations: rawCandidates.map((candidate) => ({
            dataType: "prediction_selection",
            subject: candidate.people?.length
              ? `${candidate.people.join(", ")} — ${candidate.filmTitle}`
              : candidate.filmTitle,
            filmSubject: candidate.filmTitle,
            peopleSubjects: candidate.people ?? [],
            workTitle: candidate.workTitle ?? null,
            originalValue: {
              official_nominee: true,
              official_winner: candidate.winner === true,
            },
            originalScale: null,
            categoryId: candidate.categoryId,
            predictionIntention: "nomination",
            participates: false,
            filmId: candidate.filmId,
            personId: null,
          })),
        },
      ],
    },
    filmIdentities,
  );
  const observations = prepared.publications[0].observations;
  const unresolved = observations.filter(
    (observation) => observation.review || !observation.candidate,
  );
  if (unresolved.length) {
    throw new Error(
      `Archivo 2026 pendiente de matching: ${unresolved
        .map((observation) => observation.subject)
        .join("; ")}`,
    );
  }

  const candidateByScope = new Map(
    observations.map((observation) => [
      `${observation.categoryId}::${observation.filmId}::${
        observation.peopleSubjects?.join("|") ?? ""
      }`,
      observation.candidate,
    ]),
  );
  const candidates = [
    ...new Map(
      observations.map((observation) => [
        observation.candidate.id,
        observation.candidate,
      ]),
    ).values(),
  ];

  async function resultSet(kind) {
    const publishedAt = isoInstant(
      kind === "nominations"
        ? archive.source.nominationsPublishedAt
        : archive.source.winnersPublishedAt,
      `${kind}.publishedAt`,
    );
    const selected =
      kind === "nominations"
        ? rawCandidates
        : rawCandidates.filter((candidate) => candidate.winner === true);
    const entries = selected
      .map((candidate) => {
        const canonical = candidateByScope.get(
          `${candidate.categoryId}::${candidate.filmId}::${
            candidate.people?.join("|") ?? ""
          }`,
        );
        if (!canonical) {
          throw new Error(`No existe candidatura para ${candidate.filmTitle}`);
        }
        return {
          categoryId: candidate.categoryId,
          candidateId: canonical.id,
          categoryCandidateId: canonical.id,
          outcome: kind === "nominations" ? "nominee" : "winner",
        };
      })
      .sort(
        (left, right) =>
          left.categoryId.localeCompare(right.categoryId, "en") ||
          left.candidateId.localeCompare(right.candidateId, "en"),
      );
    const payload = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION_V2,
      seasonId,
      kind,
      source: {
        sourceId,
        sourceUrl,
        author: archive.source.author ?? null,
        publishedAt,
        capturedAt,
      },
      entries,
      originalData: {
        connector: "academy-archive-2026",
        canonicalSourceUrl: sourceUrl,
        archivedCategories: archive.categories,
      },
    };
    const contentHash = await sha256(canonicalJson(payload));
    return {
      id: [
        kind,
        seasonId,
        publishedAt.slice(0, 10),
        contentHash.slice(0, 12),
      ].join("-"),
      contentHash,
      lockedAt: capturedAt,
      lockedBy: requiredText(lockedBy, "lockedBy"),
      correctsResultSetId: null,
      correctionReason: null,
      payload,
    };
  }

  return {
    candidates,
    resultSets: [await resultSet("nominations"), await resultSet("winners")],
  };
}

export class SupabaseOfficialResultsRepository {
  constructor({ supabaseUrl, serviceRoleKey }) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Faltan URL de Supabase o service role key");
    }
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  async lock(resultSet) {
    const result = await this.client.rpc("lock_official_result_set", {
      result_set_id: resultSet.id,
      result_season_id: resultSet.payload.seasonId,
      result_kind: resultSet.payload.kind,
      result_source_id: resultSet.payload.source.sourceId,
      result_source_url: resultSet.payload.source.sourceUrl,
      result_author: resultSet.payload.source.author,
      result_published_at: resultSet.payload.source.publishedAt,
      result_captured_at: resultSet.payload.source.capturedAt,
      result_schema_version: resultSet.payload.schemaVersion,
      result_content_hash: resultSet.contentHash,
      result_payload: resultSet.payload,
      result_locked_at: resultSet.lockedAt,
      result_locked_by: resultSet.lockedBy,
      corrected_result_set_id: resultSet.correctsResultSetId,
      result_correction_reason: resultSet.correctionReason,
    });
    if (result.error) {
      throw new Error(
        `No se pudieron bloquear los resultados: ${result.error.message}`,
      );
    }
    return result.data;
  }
}
