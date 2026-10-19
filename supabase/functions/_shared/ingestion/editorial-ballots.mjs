import { normalizeIdentity } from "./core.mjs";
import { fetchResponse } from "../network.mjs";

export const EDITORIAL_BALLOT_CATEGORIES = Object.freeze({
  "Best Picture": "best-picture",
  "Best Director": "directing",
  "Best Actor": "actor",
  "Best Actress": "actress",
  "Best Supporting Actor": "supporting-actor",
  "Best Supporting Actress": "supporting-actress",
  "Best Original Screenplay": "original-screenplay",
  "Best Adapted Screenplay": "adapted-screenplay",
});
export const ANKLER_BALLOT_URL =
  "https://anklerpundits.com/pundit/christopher-rosen/";
export const ROLLING_TAPE_BALLOT_URL =
  "https://therollingtape.com/danny-jarabek-oscar-predictions/";
export const ROLLING_TAPE_API_URL =
  "https://therollingtape.com/wp-json/op/v1/predictors/danny-jarabek";
const ROLLING_CATEGORY_IDS = Object.freeze({
  picture: "best-picture",
  director: "directing",
  "actor-in-a-leading-role": "actor",
  "actress-in-a-leading-role": "actress",
  "actor-in-a-supporting-role": "supporting-actor",
  "actress-in-a-supporting-role": "supporting-actress",
  "writing-original-screenplay": "original-screenplay",
  "writing-adapted-screenplay": "adapted-screenplay",
});

function text(value) {
  const entities = {
    amp: "&",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    rsquo: "’",
    lsquo: "‘",
    ldquo: "“",
    rdquo: "”",
  };
  return String(value ?? "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([a-f0-9]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (raw, name) => entities[name] ?? raw)
    .replace(/\s+/g, " ")
    .trim();
}
function attribute(tag, name) {
  return (
    tag
      .match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))
      ?.slice(1)
      .find((value) => value !== undefined) ?? null
  );
}
function optionsFor(options, source) {
  const { capturedAt, seasonId = "oscars-2027", ceremonyYear = 2027 } = options;
  // These fixed editorial profiles have been verified for the 2027 nominations
  // cycle. A season rollover or the transition to winner ballots needs review.
  if (
    seasonId !== "oscars-2027" ||
    ceremonyYear !== 2027 ||
    !Number.isFinite(Date.parse(capturedAt)) ||
    capturedAt < "2026-03-16" ||
    capturedAt >= "2027-01-22"
  )
    throw new Error(
      `${source}: temporada o captura fuera del ciclo verificado`,
    );
  return {
    ...options,
    seasonId,
    ceremonyYear,
    capturedAt: new Date(capturedAt).toISOString(),
  };
}
function editorialDate(value, capturedAt, source) {
  const calendarDate = typeof value === "string" ? value.slice(0, 10) : "";
  const [year, month, day] = calendarDate.split("-").map(Number);
  const validCalendar =
    Number.isFinite(Date.UTC(year, month - 1, day)) &&
    new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) ===
      calendarDate;
  if (
    !validCalendar ||
    !value ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value)) ||
    Date.parse(value) > Date.parse(capturedAt) ||
    value < "2026-03-16" ||
    value >= "2027-01-22"
  )
    throw new Error(`${source}: fecha editorial inválida o futura`);
  return new Date(value).toISOString();
}
function parts(categoryId, subject, filmSubject) {
  if (
    ["best-picture", "original-screenplay", "adapted-screenplay"].includes(
      categoryId,
    )
  )
    return {
      subject,
      filmSubject: subject,
      peopleSubjects: [],
      workTitle: null,
    };
  if (!filmSubject || !subject)
    throw new Error(`Candidatura incompleta en ${categoryId}`);
  const peopleSubjects =
    categoryId === "directing"
      ? subject.split(/\s+(?:and|&)\s+|,\s*/i)
      : [subject];
  if (peopleSubjects.some((person) => !person.trim()))
    throw new Error(`Persona ambigua en ${categoryId}`);
  return {
    subject: `${subject} — ${filmSubject}`,
    filmSubject,
    peopleSubjects: peopleSubjects.map((person) => person.trim()),
    workTitle: null,
  };
}
function publication({
  sourceId,
  canonicalUrl,
  author,
  categoryId,
  publishedAt,
  originalDate,
  rows,
  capturedAt,
}) {
  const expected =
    categoryId === "best-picture"
      ? sourceId === "ankler"
        ? 10
        : 20
      : sourceId === "ankler"
        ? 5
        : 10;
  if (rows.length !== expected)
    throw new Error(`${sourceId}: longitud incompleta en ${categoryId}`);
  const seen = new Set();
  const observations = rows.map((row, index) => {
    if (!Number.isInteger(row.rank) || row.rank !== index + 1 || !row.subject)
      throw new Error(`${sourceId}: puestos no consecutivos en ${categoryId}`);
    const candidate = parts(categoryId, row.subject, row.filmSubject);
    const identity = normalizeIdentity(candidate.subject);
    if (seen.has(identity))
      throw new Error(`${sourceId}: candidatura duplicada en ${categoryId}`);
    seen.add(identity);
    return {
      dataType: "prediction_ordered",
      ...candidate,
      originalValue: {
        rank: row.rank,
        list_length: rows.length,
        raw: row.raw,
        film_subject: candidate.filmSubject,
        people_subjects: candidate.peopleSubjects,
      },
      originalScale: null,
      categoryId,
      predictionIntention: "nomination",
      participates: true,
    };
  });
  return {
    externalId: `${new URL(canonicalUrl).pathname.replace(/^\/|\/$/g, "")}/${categoryId}`,
    canonicalUrl,
    title: `2027 Oscar nomination predictions · ${categoryId}`,
    author,
    publishedAt,
    capturedAt,
    isMutable: true,
    originalData: {
      source_id: sourceId,
      canonical_url: canonicalUrl,
      author,
      ceremony_year: 2027,
      category_id: categoryId,
      prediction_intention: "nomination",
      publication_date: publishedAt,
      original_publication_date: originalDate,
      rows: rows.map((row) => row.raw),
    },
    observations,
  };
}
function batchFor(
  publications,
  options,
  { sourceId, extractorVersion, defaultConnectorId, sourceUrl },
) {
  const required = Object.values(EDITORIAL_BALLOT_CATEGORIES);
  if (
    publications.length !== required.length ||
    required.some(
      (id) =>
        publications.filter(
          (publication) => publication.originalData.category_id === id,
        ).length !== 1,
    )
  )
    throw new Error(
      `${sourceId}: faltan categorías requeridas o hay duplicados`,
    );
  return {
    connectorId: options.connectorId ?? defaultConnectorId,
    sourceId,
    extractorVersion,
    seasonId: options.seasonId,
    capturedAt: options.capturedAt,
    sourceUrl,
    publications,
  };
}

export function parseAnklerFixture(html, incoming) {
  const options = optionsFor(incoming, "Ankler");
  if (options.endpointUrl !== ANKLER_BALLOT_URL)
    throw new Error("Ankler: endpoint inesperado");
  const canonical = [...html.matchAll(/<link\b[^>]*>/gi)].find(
    (match) => attribute(match[0], "rel") === "canonical",
  )?.[0];
  const description = [...html.matchAll(/<meta\b[^>]*>/gi)].find(
    (match) => attribute(match[0], "name") === "description",
  )?.[0];
  const authors = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(
    (match) => text(match[1]),
  );
  if (
    attribute(canonical ?? "", "href") !== ANKLER_BALLOT_URL ||
    !authors.includes("Christopher Rosen") ||
    !/Christopher Rosen's Oscar predictions for 2027/.test(
      text(attribute(description ?? "", "content")),
    )
  )
    throw new Error("Ankler: fuente, autor o ceremonia no verificables");
  const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  const publications = [];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  headings.forEach((heading, index) => {
    const categoryId = EDITORIAL_BALLOT_CATEGORIES[text(heading[1])];
    if (!categoryId) return;
    const block = html.slice(
      heading.index + heading[0].length,
      headings[index + 1]?.index ?? html.length,
    );
    const dateMatch = text(block).match(
      /^Updated ([A-Z][a-z]{2})\. (\d{1,2}), (\d{4})\b/,
    );
    const month = monthNames.indexOf(dateMatch?.[1]);
    if (!dateMatch || month < 0)
      throw new Error(`Ankler: falta fecha editorial de ${categoryId}`);
    const dateText = dateMatch[0];
    const publishedAt = editorialDate(
      `${dateMatch[3]}-${String(month + 1).padStart(2, "0")}-${dateMatch[2].padStart(2, "0")}T00:00:00Z`,
      options.capturedAt,
      "Ankler",
    );
    const rankMarkers = [...block.matchAll(/<p\b[^>]*>\s*(\d+)\s*<\/p>/gi)];
    const titles = [...block.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)];
    if (rankMarkers.length !== titles.length)
      throw new Error(`Ankler: puestos o sujetos incompletos en ${categoryId}`);
    const rows = titles.map((title, rowIndex) => {
      const marker = rankMarkers[rowIndex];
      if (
        marker.index >= title.index ||
        (rowIndex && marker.index <= titles[rowIndex - 1].index)
      )
        throw new Error("Ankler: asociación de puesto ambigua");
      const afterTitle = block.slice(
        title.index + title[0].length,
        rankMarkers[rowIndex + 1]?.index ?? block.length,
      );
      const detail = text(
        afterTitle.match(
          /<div\b[^>]*data-widget_type=["']text-editor\.default["'][^>]*>([\s\S]*?)<\/div>/i,
        )?.[1] ?? "",
      );
      const subject = text(title[1]);
      return {
        rank: Number(marker[1]),
        subject,
        filmSubject: detail,
        raw: { rank: text(marker[1]), subject, detail },
      };
    });
    publications.push(
      publication({
        sourceId: "ankler",
        canonicalUrl: ANKLER_BALLOT_URL,
        author: "Christopher Rosen",
        categoryId,
        publishedAt,
        originalDate: dateText,
        rows,
        capturedAt: options.capturedAt,
      }),
    );
  });
  return batchFor(publications, options, {
    sourceId: "ankler",
    extractorVersion: "ankler-rosen-v1",
    defaultConnectorId: "ankler-predictions",
    sourceUrl: ANKLER_BALLOT_URL,
  });
}

export function parseRollingTapeFixture(payload, incoming) {
  const options = optionsFor(incoming, "The Rolling Tape");
  if (
    options.endpointUrl !== ROLLING_TAPE_API_URL ||
    payload?.predictor?.name !== "Danny Jarabek" ||
    payload.predictor.profile_url !== ROLLING_TAPE_BALLOT_URL ||
    payload.predictor.social_trt_author_url !==
      "https://therollingtape.com/danny-jarabek/" ||
    payload.nominations_locked !== false ||
    payload.historical_date !== null ||
    !Array.isArray(payload.categories)
  )
    throw new Error(
      "The Rolling Tape: fuente, autor o intención no verificables",
    );
  const publications = [];
  for (const category of payload.categories) {
    const categoryId = ROLLING_CATEGORY_IDS[category.slug];
    if (!categoryId) continue;
    if (
      !Array.isArray(category.picks) ||
      category.nominee_slot_count !== (categoryId === "best-picture" ? 10 : 5)
    )
      throw new Error("The Rolling Tape: categoría no válida");
    const publishedAt = editorialDate(
      category.last_updated,
      options.capturedAt,
      "The Rolling Tape",
    );
    const rows = category.picks.map((pick) => {
      if (typeof pick.nominee !== "string")
        throw new Error("The Rolling Tape: sujeto no válido");
      const rawSubject = pick.nominee;
      const personCategory = ![
        "best-picture",
        "original-screenplay",
        "adapted-screenplay",
      ].includes(categoryId);
      const candidate = personCategory
        ? rawSubject.match(/^(.+) \((.+)\)$/u)
        : null;
      if (personCategory && !candidate)
        throw new Error("The Rolling Tape: película o persona ambigua");
      return {
        rank: pick.rank,
        subject: candidate ? candidate[1].trim() : rawSubject.trim(),
        filmSubject: candidate?.[2].trim(),
        raw: { rank: pick.rank, nominee: rawSubject },
      };
    });
    publications.push(
      publication({
        sourceId: "the-rolling-tape",
        canonicalUrl: ROLLING_TAPE_BALLOT_URL,
        author: "Danny Jarabek",
        categoryId,
        publishedAt,
        originalDate: category.last_updated,
        rows,
        capturedAt: options.capturedAt,
      }),
    );
  }
  return batchFor(publications, options, {
    sourceId: "the-rolling-tape",
    extractorVersion: "rolling-tape-jarabek-v1",
    defaultConnectorId: "rolling-tape-predictions",
    sourceUrl: ROLLING_TAPE_API_URL,
  });
}

async function runEditorialConnector(
  { connector, capturedAt, fetcher = fetch },
  { sourceId, endpointUrl, parse, json },
) {
  if (connector.source_id && connector.source_id !== sourceId)
    throw new Error("Fuente del conector no válida");
  if (connector.endpoint_url !== endpointUrl)
    throw new Error("Endpoint del conector no válido");
  const response = await fetchResponse(
    endpointUrl,
    {
      headers: {
        Accept: json ? "application/json" : "text/html",
        "User-Agent": "Runscars/0.1",
      },
    },
    fetcher,
    { timeoutMs: Number(connector.configuration.request_timeout_ms) || 15_000 },
  );
  const batch = parse(json ? await response.json() : await response.text(), {
    capturedAt,
    endpointUrl,
    connectorId: connector.id,
    seasonId: connector.configuration.season_id,
    ceremonyYear: connector.configuration.ceremony_year,
  });
  return {
    ...batch,
    discovery: {
      mode: "fixed-editorial-profile",
      indexUrl: endpointUrl,
      checkedAt: batch.capturedAt,
      publicationUrls: [
        ...new Set(
          batch.publications.map((publication) => publication.canonicalUrl),
        ),
      ],
      latestCategoryUrls: Object.fromEntries(
        batch.publications.map((publication) => [
          publication.originalData.category_id,
          publication.canonicalUrl,
        ]),
      ),
      skippedUrls: [],
    },
  };
}
export const runAnklerConnector = (options) =>
  runEditorialConnector(options, {
    sourceId: "ankler",
    endpointUrl: ANKLER_BALLOT_URL,
    parse: parseAnklerFixture,
    json: false,
  });
export const runRollingTapeConnector = (options) =>
  runEditorialConnector(options, {
    sourceId: "the-rolling-tape",
    endpointUrl: ROLLING_TAPE_API_URL,
    parse: parseRollingTapeFixture,
    json: true,
  });
