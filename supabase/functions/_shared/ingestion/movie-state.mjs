import { normalizeIdentity } from "./core.mjs";
import { fetchResponse } from "../network.mjs";

export const MOVIE_STATE_CATEGORIES = Object.freeze({
  "Best Picture": "best-picture",
  "Best Director": "directing",
  "Best Actress": "actress",
  "Best Actor": "actor",
  "Best Supporting Actress": "supporting-actress",
  "Best Supporting Actor": "supporting-actor",
  "Best Original Screenplay": "original-screenplay",
  "Best Adapted Screenplay": "adapted-screenplay",
});

function text(value) {
  const entities = {
    amp: "&",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ldquo: "“",
    rdquo: "”",
    rsquo: "’",
  };
  return value
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

function meta(html, name) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (
      (attribute(match[0], "property") ?? attribute(match[0], "name")) === name
    )
      return attribute(match[0], "content");
  }
  return null;
}

function articleUrl(value, ceremonyYear) {
  const url = new URL(value, "https://themoviestate.com/");
  const match = url.pathname.match(
    new RegExp(
      `^/(\\d{4})/(\\d{2})/(\\d{2})/${ceremonyYear}-oscar-predictions/$`,
    ),
  );
  if (
    url.protocol !== "https:" ||
    url.hostname !== "themoviestate.com" ||
    !match ||
    ![ceremonyYear - 1, ceremonyYear].includes(Number(match[1]))
  ) {
    throw new Error("The Movie State: URL de temporada no válida");
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function discoverMovieStatePredictionUrls(html, ceremonyYear = 2027) {
  const urls = new Set();
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = attribute(match[0], "href");
    if (!href) continue;
    try {
      urls.add(articleUrl(href, ceremonyYear));
    } catch {
      /* Other seasons and articles are discovery context only. */
    }
  }
  return [...urls].sort().reverse();
}

function date(value, field, capturedAt) {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`The Movie State: falta fecha válida ${field}`);
  }
  if (Date.parse(value) > Date.parse(capturedAt))
    throw new Error(`The Movie State: fecha futura ${field}`);
  return new Date(value).toISOString();
}

function parts(categoryId, value) {
  if (
    ["best-picture", "original-screenplay", "adapted-screenplay"].includes(
      categoryId,
    )
  ) {
    return {
      subject: value,
      filmSubject: value,
      peopleSubjects: [],
      workTitle: null,
    };
  }
  const match = value.match(/^(.+?),\s*[“"]([^”"]+)[”"]$/u);
  if (!match)
    throw new Error(`The Movie State: candidatura ambigua en ${categoryId}`);
  const people = /^Los Javis$/i.test(match[1])
    ? ["Javier Ambrossi", "Javier Calvo"]
    : match[1].split(/\s+(?:and|&)\s+|,\s*/i).map((person) => person.trim());
  return {
    subject: value,
    filmSubject: match[2],
    peopleSubjects: people,
    workTitle: null,
  };
}

/**
 * @param {string} html
 * @param {{ capturedAt: string, endpointUrl: string, seasonId?: string, ceremonyYear?: number, connectorId?: string }} options
 */
export function parseMovieStateFixture(
  html,
  {
    capturedAt,
    endpointUrl,
    seasonId = "oscars-2027",
    ceremonyYear = 2027,
    connectorId = "movie-state-predictions",
  },
) {
  if (
    seasonId !== `oscars-${ceremonyYear}` ||
    !Number.isFinite(Date.parse(capturedAt))
  )
    throw new Error("The Movie State: temporada o captura no válida");
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (!article) throw new Error("The Movie State: falta artículo editorial");
  const title = text(article.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  if (
    title !== `${ceremonyYear} Oscar Predictions` ||
    !/ranked predictions for who will be nominated/i.test(text(article))
  )
    throw new Error("The Movie State: temporada o intención no reconocible");
  const canonicalTag = [...html.matchAll(/<link\b[^>]*>/gi)].find(
    (match) => attribute(match[0], "rel") === "canonical",
  )?.[0];
  const canonicalUrl = articleUrl(
    attribute(canonicalTag ?? "", "href") ?? endpointUrl,
    ceremonyYear,
  );
  if (canonicalUrl !== articleUrl(endpointUrl, ceremonyYear))
    throw new Error("The Movie State: canonical inesperada");
  const author = text(
    [...article.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].find(
      (match) => attribute(match[1], "rel") === "author",
    )?.[2] ?? "",
  );
  if (author !== "Ben Sears")
    throw new Error("The Movie State: autor no verificado");
  const publishedAt = date(
    meta(html, "article:published_time"),
    "publicación",
    capturedAt,
  );
  const modifiedAt = meta(html, "article:modified_time")
    ? date(meta(html, "article:modified_time"), "modificación", capturedAt)
    : null;
  if (modifiedAt && modifiedAt < publishedAt)
    throw new Error("The Movie State: modificación anterior a publicación");
  const observations = [];
  const categories = {};
  for (const table of article.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const headings = [
      ...(
        table[1].match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] ?? ""
      ).matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi),
    ].map((match) => text(match[1]));
    const categoryIds = headings.map(
      (heading) => MOVIE_STATE_CATEGORIES[heading] ?? null,
    );
    if (!categoryIds.some(Boolean)) continue;
    const tbody =
      table[1].match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
    const rows = [...tbody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((match) =>
        [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
          (cell) => cell[1],
        ),
      )
      .filter((cells) => cells.some((cell) => text(cell)));
    if (rows.length !== 1 || rows[0].length !== headings.length)
      throw new Error("The Movie State: estructura de tabla no reconocible");
    categoryIds.forEach((categoryId, column) => {
      if (!categoryId) return;
      if (categories[categoryId])
        throw new Error(`The Movie State: categoría duplicada ${categoryId}`);
      const values = rows[0][column]
        .split(/<br\s*\/?>/i)
        .map(text)
        .filter(Boolean);
      const expected = categoryId === "best-picture" ? 10 : 5;
      if (values.length !== expected)
        throw new Error(
          `The Movie State: cobertura incompleta en ${categoryId}`,
        );
      const seen = new Set();
      categories[categoryId] = values;
      values.forEach((raw, index) => {
        const match = raw.match(/^(\d+)\.\s+(.+)$/);
        if (!match || Number(match[1]) !== index + 1)
          throw new Error(
            `The Movie State: posiciones no consecutivas en ${categoryId}`,
          );
        const identity = normalizeIdentity(match[2]);
        if (seen.has(identity))
          throw new Error(
            `The Movie State: candidatura duplicada en ${categoryId}`,
          );
        seen.add(identity);
        const candidate = parts(categoryId, match[2]);
        observations.push({
          dataType: "prediction_ordered",
          ...candidate,
          originalValue: {
            rank: index + 1,
            list_length: values.length,
            raw,
            film_subject: candidate.filmSubject,
            people_subjects: candidate.peopleSubjects,
          },
          originalScale: null,
          categoryId,
          predictionIntention: "nomination",
          participates: true,
        });
      });
    });
  }
  if (
    Object.values(MOVIE_STATE_CATEGORIES).some(
      (categoryId) => !categories[categoryId],
    )
  )
    throw new Error("The Movie State: faltan categorías requeridas");
  return {
    connectorId,
    sourceId: "the-movie-state",
    extractorVersion: "movie-state-v1",
    seasonId,
    capturedAt: new Date(capturedAt).toISOString(),
    sourceUrl: canonicalUrl,
    publications: [
      {
        externalId: new URL(canonicalUrl).pathname.replace(/^\/|\/$/g, ""),
        canonicalUrl,
        title,
        author,
        publishedAt,
        capturedAt: new Date(capturedAt).toISOString(),
        isMutable: true,
        originalData: {
          source_id: "the-movie-state",
          canonical_url: canonicalUrl,
          title,
          author,
          publication_date: publishedAt,
          modification_date: modifiedAt,
          categories,
        },
        observations,
      },
    ],
  };
}

export async function runMovieStateConnector({
  connector,
  capturedAt,
  fetcher = fetch,
}) {
  const ceremonyYear = connector.configuration.ceremony_year ?? 2027;
  const request = {
    headers: { Accept: "text/html", "User-Agent": "Runscars/0.1" },
  };
  const timeoutMs =
    Number(connector.configuration.request_timeout_ms) || 15_000;
  const listing = await (
    await fetchResponse(connector.endpoint_url, request, fetcher, { timeoutMs })
  ).text();
  const candidates = discoverMovieStatePredictionUrls(listing, ceremonyYear);
  if (!candidates.length)
    throw new Error("The Movie State: no hay predicción de la temporada");
  const article = await (
    await fetchResponse(candidates[0], request, fetcher, { timeoutMs })
  ).text();
  const batch = parseMovieStateFixture(article, {
    capturedAt,
    endpointUrl: candidates[0],
    connectorId: connector.id,
    seasonId: connector.configuration.season_id,
    ceremonyYear,
  });
  return {
    ...batch,
    discovery: {
      mode: "season-archive",
      indexUrl: connector.endpoint_url,
      checkedAt: batch.capturedAt,
      publicationUrls: [candidates[0]],
      latestCategoryUrls: Object.fromEntries(
        Object.values(MOVIE_STATE_CATEGORIES).map((categoryId) => [
          categoryId,
          candidates[0],
        ]),
      ),
      skippedUrls: [],
    },
  };
}
