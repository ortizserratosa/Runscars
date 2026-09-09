const SET_KINDS = new Set(["selection", "awards"]);
const MATCH_STATUSES = new Set(["matched", "pending_review", "unmatched"]);

const EXCLUDED_LABELS = [
  /short\s*films?/i,
  /cortometrajes?/i,
  /episodic/i,
  /series?/i,
  /immersive/i,
  /restoration/i,
  /restaurad[ao]s?/i,
  /honou?rary/i,
  /honor[ií]fic[ao]/i,
  /market/i,
  /industry/i,
  /la\s+cinef/i,
  /pardi\s+di\s+domani/i,
];

function present(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} es obligatorio`);
  }
  return value.trim();
}

function httpsUrl(value, label) {
  const url = present(value, label);
  if (!url.startsWith("https://")) {
    throw new Error(`${label} debe usar HTTPS`);
  }
  return url;
}

function validDate(value, label, required = true) {
  if (value == null && !required) return null;
  const text = present(value, label);
  if (Number.isNaN(Date.parse(text))) throw new Error(`${label} no es válida`);
  return new Date(text).toISOString();
}

export function normalizeFestivalTitle(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replaceAll(/[’‘]/g, "'")
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isEligibleFestivalEntry(entry) {
  if (entry.isFeature === false) return false;
  if (entry.isOfficial === false) return false;
  const scope = [entry.section, entry.awardType, entry.entryType]
    .filter(Boolean)
    .join(" ");
  return !EXCLUDED_LABELS.some((pattern) => pattern.test(scope));
}

function catalogueIndex(catalogue) {
  const indexed = new Map();
  for (const film of catalogue) {
    for (const title of [film.title, ...(film.alternateTitles ?? [])]) {
      const normalized = normalizeFestivalTitle(title);
      if (!normalized) continue;
      const matches = indexed.get(normalized) ?? [];
      if (!matches.some((candidate) => candidate.id === film.id)) {
        matches.push({ id: film.id, title: film.title });
      }
      indexed.set(normalized, matches);
    }
  }
  return indexed;
}

export function matchFestivalEntry(entry, catalogue) {
  const normalizedTitle = normalizeFestivalTitle(entry.originalTitle);
  const matches = catalogueIndex(catalogue).get(normalizedTitle) ?? [];
  if (matches.length === 1) {
    return {
      normalizedTitle,
      status: "matched",
      filmId: matches[0].id,
      candidateFilmIds: [matches[0].id],
      reason: "Coincidencia exacta con título principal o alternativo",
    };
  }
  if (matches.length > 1) {
    return {
      normalizedTitle,
      status: "pending_review",
      filmId: null,
      candidateFilmIds: matches.map((film) => film.id),
      reason: "El título exacto coincide con varias películas",
    };
  }
  return {
    normalizedTitle,
    status: "unmatched",
    filmId: null,
    candidateFilmIds: [],
    reason: "El título oficial aún no existe en el catálogo",
  };
}

export async function prepareFestivalSet(manifest, catalogue = []) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("El manifiesto festivalero debe ser un objeto");
  }
  const editionId = present(manifest.editionId, "editionId");
  const kind = present(manifest.kind, "kind");
  if (!SET_KINDS.has(kind))
    throw new Error(`Tipo de conjunto inválido: ${kind}`);
  const source = {
    url: httpsUrl(manifest.source?.url, "source.url"),
    title: present(manifest.source?.title, "source.title"),
    publishedAt: validDate(
      manifest.source?.publishedAt,
      "source.publishedAt",
      false,
    ),
  };
  const capturedAt = validDate(manifest.capturedAt, "capturedAt");
  const extractorVersion = present(
    manifest.extractorVersion,
    "extractorVersion",
  );
  if (!Array.isArray(manifest.entries)) {
    throw new Error("entries debe ser una lista");
  }
  const eligible = manifest.entries.filter(isEligibleFestivalEntry);
  if (eligible.length === 0) {
    throw new Error(
      "El conjunto no contiene largometrajes oficiales elegibles",
    );
  }
  const entries = eligible.map((entry, index) => {
    const originalTitle = present(entry.originalTitle, "originalTitle");
    const normalized = {
      entryOrder: index + 1,
      section: present(entry.section, "section"),
      originalTitle,
      originalRecipient:
        typeof entry.originalRecipient === "string" &&
        entry.originalRecipient.trim()
          ? entry.originalRecipient.trim()
          : null,
      awardType:
        kind === "awards" ? present(entry.awardType, "awardType") : null,
      isFeature: true,
      originalData:
        entry.originalData && typeof entry.originalData === "object"
          ? entry.originalData
          : { ...entry },
    };
    return { ...normalized, ...matchFestivalEntry(normalized, catalogue) };
  });
  const identity = {
    editionId,
    kind,
    source,
    entries: entries.map(({ originalData: _raw, ...entry }) => entry),
  };
  const correctsSetId =
    typeof manifest.correctsSetId === "string" ? manifest.correctsSetId : null;
  const correctionReason =
    typeof manifest.correctionReason === "string"
      ? manifest.correctionReason.trim()
      : null;
  if (Boolean(correctsSetId) !== Boolean(correctionReason)) {
    throw new Error(
      "Toda corrección debe enlazar el conjunto y explicar el motivo",
    );
  }
  return {
    editionId,
    kind,
    source,
    capturedAt,
    extractorVersion,
    rawCapture:
      manifest.rawCapture && typeof manifest.rawCapture === "object"
        ? manifest.rawCapture
        : manifest,
    entries,
    contentHash: await sha256(identity),
    correctsSetId,
    correctionReason,
  };
}

export function assertMatchShape(entry) {
  if (!MATCH_STATUSES.has(entry.status)) {
    throw new Error(`Estado de matching inválido: ${entry.status}`);
  }
  if ((entry.status === "matched") !== Boolean(entry.filmId)) {
    throw new Error("El estado matched y filmId deben aparecer juntos");
  }
}

export function awardsPublicationIncident(edition, now = new Date()) {
  if (
    edition.awards_status !== "pending" ||
    !edition.ends_on ||
    Number.isNaN(Date.parse(edition.ends_on))
  ) {
    return false;
  }
  const deadline = Date.parse(`${edition.ends_on}T23:59:59Z`) + 86_400_000;
  return now.valueOf() > deadline;
}

export function festivalConsensusPoints() {
  return 0;
}
