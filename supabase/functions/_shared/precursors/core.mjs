import { sha256, normalizeFestivalTitle } from "../festivals/core.mjs";

const KINDS = new Set(["schedule", "nominations", "winners"]);
const OFFICIAL_HOSTS = {
  "actor-awards": [
    "actorawards.org",
    "www.actorawards.org",
    "sagaftra.org",
    "www.sagaftra.org",
  ],
  dga: ["dga.org", "www.dga.org"],
  pga: ["producersguild.org", "www.producersguild.org"],
  wga: [
    "wga.org",
    "www.wga.org",
    "awards.wga.org",
    "wgaeast.org",
    "www.wgaeast.org",
  ],
  "critics-choice": ["criticschoice.com", "www.criticschoice.com"],
  bafta: ["bafta.org", "www.bafta.org", "awards.bafta.org"],
};

function required(value, name) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} es obligatorio`);
  return value.trim();
}

function instant(value, name, optional = false) {
  if (value == null && optional) return null;
  const text = required(value, name);
  if (Number.isNaN(Date.parse(text))) throw new Error(`${name} no es válida`);
  return new Date(text).toISOString();
}

function day(value, name) {
  if (value == null) return null;
  const text = required(value, name);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) !== text
  ) {
    throw new Error(`${name} no es una fecha de calendario válida`);
  }
  return text;
}

export function matchPrecursorFilm(entry, catalogue, seasonId) {
  const normalizedTitle = normalizeFestivalTitle(entry.originalTitle);
  const matches = catalogue.filter(
    (film) =>
      (!film.seasonIds || film.seasonIds.includes(seasonId)) &&
      [film.title, ...(film.alternateTitles ?? [])].some(
        (title) => normalizeFestivalTitle(title) === normalizedTitle,
      ),
  );
  const ids = [...new Set(matches.map((film) => film.id))];
  return {
    normalizedTitle,
    filmId: ids.length === 1 ? ids[0] : null,
    status:
      ids.length === 1
        ? "matched"
        : ids.length
          ? "pending_review"
          : "unmatched",
    candidateFilmIds: ids,
    reason:
      ids.length === 1
        ? "Título exacto y único dentro de la temporada"
        : ids.length
          ? "Varias películas de la temporada comparten título"
          : "Título sin correspondencia en la temporada",
  };
}

export async function preparePrecursorSet(manifest, catalogue = []) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest))
    throw new Error("El conjunto precursor debe ser un objeto");
  const editionId = required(manifest.editionId, "editionId");
  const organizationId = required(manifest.organizationId, "organizationId");
  const seasonId = required(manifest.seasonId, "seasonId");
  const ceremonyYear = manifest.ceremonyYear;
  if (
    !Number.isInteger(ceremonyYear) ||
    ceremonyYear < 2000 ||
    ceremonyYear > 2100 ||
    editionId !== `${organizationId}-${ceremonyYear}` ||
    seasonId !== `oscars-${ceremonyYear}`
  )
    throw new Error("Edición, ceremonia y temporada precursoras no coinciden");
  const kind = required(manifest.kind, "kind");
  if (!KINDS.has(kind))
    throw new Error(`Tipo de conjunto precursor inválido: ${kind}`);
  const sourceUrl = new URL(required(manifest.source?.url, "source.url"));
  if (
    sourceUrl.protocol !== "https:" ||
    !OFFICIAL_HOSTS[organizationId]?.includes(sourceUrl.hostname)
  )
    throw new Error(
      "El recibo precursor debe proceder de la web oficial del organismo",
    );
  const source = {
    url: sourceUrl.href,
    title: required(manifest.source?.title, "source.title"),
    author:
      manifest.source?.author == null
        ? null
        : required(manifest.source.author, "source.author"),
    publishedAt: instant(
      manifest.source?.publishedAt,
      "source.publishedAt",
      true,
    ),
  };
  const capturedAt = instant(manifest.capturedAt, "capturedAt");
  if (source.publishedAt && source.publishedAt > capturedAt)
    throw new Error("La publicación no puede ser posterior a su captura");
  const schedule = {
    ceremonyOn: day(manifest.schedule?.ceremonyOn, "schedule.ceremonyOn"),
    nominationsOn: day(
      manifest.schedule?.nominationsOn,
      "schedule.nominationsOn",
    ),
    milestones: (manifest.schedule?.milestones ?? []).map((item) => ({
      name: required(item.name, "milestone.name"),
      date: day(item.date, "milestone.date"),
    })),
  };
  if (
    schedule.ceremonyOn &&
    Number(schedule.ceremonyOn.slice(0, 4)) !== ceremonyYear
  )
    throw new Error("La fecha de ceremonia pertenece a otra edición");
  if (
    schedule.nominationsOn &&
    schedule.ceremonyOn &&
    schedule.nominationsOn > schedule.ceremonyOn
  )
    throw new Error(
      "Las nominaciones no pueden ser posteriores a la ceremonia",
    );
  if (
    kind === "schedule" &&
    !schedule.ceremonyOn &&
    !schedule.nominationsOn &&
    !schedule.milestones.length
  )
    throw new Error("El calendario debe contener fechas oficiales verificadas");
  if (!Array.isArray(manifest.entries))
    throw new Error("entries debe ser una lista");
  if (kind === "schedule" && manifest.entries.length)
    throw new Error("Un calendario no contiene nominados ni ganadores");
  if (kind !== "schedule" && !manifest.entries.length)
    throw new Error("Un resultado precursor no puede estar vacío");
  if (kind === "winners" && !schedule.ceremonyOn)
    throw new Error("Los ganadores requieren una fecha oficial de ceremonia");
  if (kind === "nominations" && !schedule.nominationsOn && !source.publishedAt)
    throw new Error(
      "Las nominaciones requieren una fecha oficial de anuncio o publicación",
    );
  if (
    kind === "winners" &&
    schedule.ceremonyOn &&
    schedule.ceremonyOn > capturedAt.slice(0, 10)
  )
    throw new Error("No se pueden registrar ganadores antes de su ceremonia");
  if (
    kind === "nominations" &&
    schedule.nominationsOn &&
    schedule.nominationsOn > capturedAt.slice(0, 10)
  )
    throw new Error("No se pueden registrar nominaciones antes de su anuncio");
  const keys = new Set();
  const entries = manifest.entries.map((entry, index) => {
    const originalCategory = required(
      entry.originalCategory,
      "originalCategory",
    );
    const originalTitle = required(entry.originalTitle, "originalTitle");
    const originalRecipient =
      entry.originalRecipient == null
        ? null
        : required(entry.originalRecipient, "originalRecipient");
    const categoryId =
      entry.categoryId == null
        ? null
        : required(entry.categoryId, "categoryId");
    const categoryRelation = entry.categoryRelation ?? "related";
    if (!["corresponding", "related", "none"].includes(categoryRelation))
      throw new Error("Relación de categoría inválida");
    if ((categoryRelation === "none") !== (categoryId == null))
      throw new Error("Una categoría sin relación no tiene categoryId");
    const key = `${originalCategory}:${originalTitle}:${originalRecipient ?? ""}`;
    if (keys.has(key))
      throw new Error("El conjunto contiene una entrada duplicada");
    keys.add(key);
    return {
      entryOrder: index + 1,
      originalCategory,
      originalTitle,
      originalRecipient,
      categoryId,
      categoryRelation,
      originalData: entry.originalData ?? { ...entry },
      ...matchPrecursorFilm(entry, catalogue, seasonId),
    };
  });
  const extractorVersion = required(
    manifest.extractorVersion,
    "extractorVersion",
  );
  const coverage = {
    es: required(manifest.coverage?.es, "coverage.es"),
    en: required(manifest.coverage?.en, "coverage.en"),
  };
  const correctsSetId = manifest.correctsSetId ?? null;
  const correctionReason =
    manifest.correctionReason == null
      ? null
      : required(manifest.correctionReason, "correctionReason");
  if (Boolean(correctsSetId) !== Boolean(correctionReason))
    throw new Error(
      "Una corrección debe enlazar el conjunto anterior y explicar el motivo",
    );
  // Matching and capture time cannot turn the same official facts into a new receipt.
  const identity = {
    editionId,
    organizationId,
    seasonId,
    ceremonyYear,
    kind,
    source,
    schedule,
    coverage,
    extractorVersion,
    entries: entries.map(
      ({
        filmId: _filmId,
        status: _status,
        normalizedTitle: _normalizedTitle,
        candidateFilmIds: _candidateFilmIds,
        reason: _reason,
        ...original
      }) => original,
    ),
  };
  return {
    ...identity,
    entries,
    capturedAt,
    contentHash: await sha256(identity),
    rawCapture: manifest.rawCapture ?? manifest,
    correctsSetId,
    correctionReason,
  };
}

export function precursorConsensusPoints() {
  return 0;
}
