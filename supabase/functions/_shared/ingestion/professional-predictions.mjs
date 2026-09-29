const CATEGORY_DEFINITIONS = Object.freeze([
  ["best-picture", ["BEST PICTURE", "Best Picture"]],
  ["directing", ["BEST DIRECTOR", "Best Director", "DIRECTOR"]],
  ["actress", ["BEST ACTRESS", "Best Actress", "ACTRESS"]],
  ["actor", ["BEST ACTOR", "Best Actor", "ACTOR"]],
  [
    "supporting-actress",
    [
      "BEST SUPPORTING ACTRESS",
      "Best Supporting Actress",
      "SUPPORTING ACTRESS",
    ],
  ],
  [
    "supporting-actor",
    ["BEST SUPPORTING ACTOR", "Best Supporting Actor", "SUPPORTING ACTOR"],
  ],
  [
    "adapted-screenplay",
    [
      "BEST ADAPTED SCREENPLAY",
      "Best Adapted Screenplay",
      "ADAPTED SCREENPLAY",
    ],
  ],
  [
    "original-screenplay",
    [
      "BEST ORIGINAL SCREENPLAY",
      "Best Original Screenplay",
      "ORIGINAL SCREENPLAY",
    ],
  ],
  ["casting", ["BEST CASTING", "Best Casting", "CASTING"]],
  [
    "cinematography",
    ["BEST CINEMATOGRAPHY", "Best Cinematography", "CINEMATOGRAPHY"],
  ],
  [
    "film-editing",
    [
      "BEST FILM EDITING",
      "Best Film Editing",
      "BEST EDITING",
      "Best Editing",
      "FILM EDITING",
      "EDITING",
    ],
  ],
  [
    "original-score",
    [
      "BEST ORIGINAL SCORE",
      "Best Original Score",
      "BEST SCORE",
      "Best Score",
      "ORIGINAL SCORE",
      "SCORE",
    ],
  ],
  [
    "original-song",
    ["BEST ORIGINAL SONG", "Best Original Song", "ORIGINAL SONG", "SONG"],
  ],
  ["sound", ["BEST SOUND", "Best Sound", "SOUND"]],
  [
    "visual-effects",
    ["BEST VISUAL EFFECTS", "Best Visual Effects", "VISUAL EFFECTS", "VFX"],
  ],
  [
    "animated-feature",
    [
      "BEST ANIMATED FEATURE",
      "Best Animated Feature",
      "ANIMATED FEATURE FILM",
      "ANIMATED FEATURE",
      "ANIMATED",
    ],
  ],
  [
    "documentary-feature",
    [
      "BEST DOCUMENTARY FEATURE",
      "Best Documentary Feature",
      "DOCUMENTARY FEATURE FILM",
      "DOCUMENTARY FEATURE",
      "DOC",
    ],
  ],
  [
    "international-feature",
    [
      "BEST INTERNATIONAL FEATURE FILM",
      "Best International Feature Film",
      "BEST INTERNATIONAL FEATURE",
      "Best International Feature",
      "INTERNATIONAL FEATURE FILM",
      "INTERNATIONAL FEATURE",
    ],
  ],
  [
    "costume-design",
    [
      "BEST COSTUME DESIGN",
      "Best Costume Design",
      "COSTUME DESIGN",
      "COSTUMES",
    ],
  ],
  [
    "makeup-hairstyling",
    [
      "BEST MAKEUP AND HAIRSTYLING",
      "Best Makeup and Hairstyling",
      "MAKEUP AND HAIRSTYLING",
      "MAKEUP AND HAIR",
      "MAKEUP",
    ],
  ],
  [
    "production-design",
    [
      "BEST PRODUCTION DESIGN",
      "Best Production Design",
      "PRODUCTION DESIGN",
      "PD",
    ],
  ],
]);

const PERSON_CATEGORIES = new Set([
  "directing",
  "actor",
  "actress",
  "supporting-actor",
  "supporting-actress",
]);
const TEAM_CATEGORIES = new Set([
  "directing",
  "original-screenplay",
  "adapted-screenplay",
]);
const SCREENPLAY_CATEGORIES = new Set([
  "original-screenplay",
  "adapted-screenplay",
]);
const SOURCE_FILM_ALIASES = new Map([
  ["adventures of cliff booth", "The Adventures of Cliff Booth"],
  ["dune iii", "Dune: Part Three"],
  ["la bola begra", "La Bola Negra"],
  ["sense and sensibillity", "Sense and Sensibility"],
  [
    "the further mis-adventures of cliff booth",
    "The Adventures of Cliff Booth",
  ],
  ["the social recknoing", "The Social Reckoning"],
  ["wewulf", "Werwulf"],
]);
const SOURCE_PERSON_ALIASES = new Map([
  ["cho yeo-jong", "Cho Yeo-jeong"],
  ["christian mungiu", "Cristian Mungiu"],
  ["inde navarette", "Inde Navarrette"],
  ["mariana di girolam o", "Mariana di Girolamo"],
  ["parke r posey", "Parker Posey"],
  ["sebastien stan", "Sebastian Stan"],
  ["seth rogan", "Seth Rogen"],
  ["sophie okonado", "Sophie Okonedo"],
]);

const HTML_ENTITIES = Object.freeze({
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  rsquo: "’",
});

function decodeEntities(value) {
  return value
    .replace(/&#x([a-f0-9]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&([a-z]+);/gi, (entity, name) => HTML_ENTITIES[name] ?? entity);
}

function stripTags(value) {
  return decodeEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlLines(html) {
  return decodeEntities(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(
      /<\/(?:p|div|li|tr|td|th|h[1-6]|br|section|article|button)>/gi,
      "\n",
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function divContentByClass(html, className) {
  const openingTags = /<div\b[^>]*>/gi;
  let opening;
  while ((opening = openingTags.exec(html))) {
    const classAttribute = opening[0].match(
      /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
    );
    const classes = classAttribute?.[1] ?? classAttribute?.[2] ?? "";
    if (!classes.split(/\s+/u).includes(className)) continue;

    const contentStart = openingTags.lastIndex;
    const nestedDivs = /<\/?div\b[^>]*>/gi;
    nestedDivs.lastIndex = contentStart;
    let depth = 1;
    let nested;
    while ((nested = nestedDivs.exec(html))) {
      depth += /^<\//u.test(nested[0]) ? -1 : 1;
      if (depth === 0) return html.slice(contentStart, nested.index);
    }
    return html.slice(contentStart);
  }
  return null;
}

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta ${field}`);
  }
  return value.trim();
}

function httpsUrl(value, field) {
  const url = new URL(requiredText(value, field));
  if (url.protocol !== "https:") throw new Error(`${field} debe usar HTTPS`);
  url.hash = "";
  return url.toString();
}

function canonicalUrl(html, fallback) {
  const element = [...html.matchAll(/<link\b[^>]*>/gi)].find((match) =>
    /\brel\s*=\s*(?:"canonical"|'canonical')/i.test(match[0]),
  )?.[0];
  const href = element?.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
  return httpsUrl(href?.[1] ?? href?.[2] ?? fallback, "canonicalUrl");
}

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta\\b[^>]*(?:property|name)=(?:"${escaped}"|'${escaped}')[^>]*content=(?:"([^"]*)"|'([^']*)')`,
      "i",
    ),
    new RegExp(
      `<meta\\b[^>]*content=(?:"([^"]*)"|'([^']*)')[^>]*(?:property|name)=(?:"${escaped}"|'${escaped}')`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.[1] ?? match?.[2];
    if (value) return stripTags(value);
  }
  return null;
}

function byline(html) {
  for (const className of ["posts-author", "jeg_meta_author"]) {
    const pattern = new RegExp(
      `<(span|div)\\b[^>]*class=(?:"[^"]*\\b${className}\\b[^"]*"|'[^']*\\b${className}\\b[^']*')[^>]*>([\\s\\S]*?)<\\/\\1>`,
      "i",
    );
    const content = html.match(pattern)?.[2];
    const author = content?.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    if (author) return stripTags(author);
    if (content && stripTags(content)) return stripTags(content);
  }
  return null;
}

function expectedCeremonyYear(seasonId) {
  return Number(seasonId?.match(/(20\d{2})$/)?.[1]) || null;
}

function assertPredictionSeason(evidence, seasonId, sourceId) {
  const expected = expectedCeremonyYear(seasonId);
  const years = [
    ...evidence.matchAll(/\b(20\d{2})\s+Oscars?\s+Predictions\b/gi),
  ].map((match) => Number(match[1]));
  if (expected && years.length && !years.includes(expected)) {
    throw new Error(`${sourceId} publicó predicciones de otra temporada`);
  }
}

function publicationMetadata(html, endpointUrl, sourceId, capturedAt) {
  const url = canonicalUrl(html, endpointUrl);
  const pathDate = new URL(url).pathname.match(
    /\/(\d{4})\/(\d{2})\/(\d{2})(?:\/|$)/,
  );
  const published =
    metaContent(html, "article:published_time") ??
    html.match(/<time\b[^>]*datetime=(?:"([^"]+)"|'([^']+)')/i)?.[1] ??
    html.match(/<time\b[^>]*datetime=(?:"([^"]+)"|'([^']+)')/i)?.[2] ??
    (pathDate
      ? `${pathDate[1]}-${pathDate[2]}-${pathDate[3]}T00:00:00Z`
      : null) ??
    null;
  const title =
    metaContent(html, "og:title") ||
    stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "") ||
    `${sourceId} Oscar predictions`;
  return {
    externalId: new URL(url).pathname.replace(/^\/|\/$/g, "") || sourceId,
    canonicalUrl: url,
    title,
    author: metaContent(html, "author") ?? byline(html),
    publishedAt:
      published && !Number.isNaN(new Date(published).valueOf())
        ? new Date(published).toISOString()
        : null,
    capturedAt: new Date(capturedAt).toISOString(),
  };
}

function headingCategory(line) {
  const normalized = line
    .replace(/\s+\d+\s*$/, "")
    .replace(/:\s*$/, "")
    .replace(/^THE\s+/i, "")
    .trim();
  for (const [categoryId, aliases] of CATEGORY_DEFINITIONS) {
    if (
      aliases.some(
        (alias) => normalized.toLocaleUpperCase() === alias.toLocaleUpperCase(),
      )
    ) {
      return categoryId;
    }
  }
  return null;
}

function updatedPredictionDate(lines) {
  const value = lines.find((line) =>
    /^Updated\s+[A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4}$/i.test(line),
  );
  if (!value) return null;
  const parsed = Date.parse(
    `${value
      .replace(/^Updated\s+/i, "")
      .replace(/(\d{1,2})(?:st|nd|rd|th)/i, "$1")} UTC`,
  );
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function peopleFromText(value) {
  if (
    /^(?:(?:The\s+)?Javiers|(?:Los\s+)?Javis|Los\s+Jovis)$/i.test(value.trim())
  ) {
    return ["Javier Ambrossi", "Javier Calvo"];
  }
  return value
    .split(/\s+(?:and|&)\s+|,\s*/i)
    .map((person) => person.replace(/\s+\([^()]+\)\s*$/u, "").trim())
    .filter(Boolean)
    .map(
      (person) =>
        SOURCE_PERSON_ALIASES.get(person.toLocaleLowerCase()) ?? person,
    );
}

function filmFromText(value) {
  const primaryFilm = value.replace(/\s+\(or\s+[^()]+\)\s*$/i, "").trim();
  return (
    SOURCE_FILM_ALIASES.get(primaryFilm.toLocaleLowerCase()) ?? primaryFilm
  );
}

function subjectParts(categoryId, raw) {
  const clean = raw
    .replace(/[⬆⬇↔]+/gu, "")
    .replace(/\s+(?:NEW|RETURNING|DEBUT)\s*$/, "")
    .replace(
      /\s+\(\s*(?:Netflix|NEON|A24|MUBI|TBD|Bleecker Street|[^()]*(?:Pictures|Studios|Studio|Films|Film|Entertainment|Universal|Amazon|Columbia|Focus|Searchlight|Warner|Lionsgate))[^()]*\)\s*$/i,
      "",
    )
    .replace(
      /\s+\((?:could|may|might)\s+be\s+[^()]*(?:original|adapted)[^()]*\)\s*$/i,
      "",
    )
    .replace(/\s+\((?:The|A|An)\s+[^()]+\)\s*$/i, "")
    .trim();
  if (SCREENPLAY_CATEGORIES.has(categoryId)) {
    const dash = clean.match(/^(.+?)\s+[–—-]\s+(.+)$/);
    if (dash) {
      return {
        subject: clean,
        filmSubject: filmFromText(dash[2].trim()),
        peopleSubjects: peopleFromText(dash[1]),
        workTitle: null,
      };
    }
  }
  if (!PERSON_CATEGORIES.has(categoryId)) {
    return {
      subject: clean,
      filmSubject: filmFromText(clean),
      peopleSubjects: [],
      workTitle: null,
    };
  }
  const dash = clean.match(/^(.+?)\s+[–—-]\s+(.+)$/);
  if (dash) {
    return {
      subject: clean,
      filmSubject: filmFromText(dash[2].trim()),
      peopleSubjects: peopleFromText(dash[1]),
      workTitle: null,
    };
  }
  const parts = clean.split(/,\s*/);
  if (parts.length >= 2) {
    return {
      subject: clean,
      filmSubject: filmFromText(parts.at(-1).trim()),
      peopleSubjects: parts.slice(0, -1).flatMap(peopleFromText),
      workTitle: null,
    };
  }
  return {
    subject: clean,
    filmSubject: null,
    peopleSubjects: peopleFromText(clean),
    workTitle: null,
  };
}

function observation(categoryId, rank, listLength, parts, raw) {
  return {
    dataType: rank === null ? "prediction_selection" : "prediction_ordered",
    subject: parts.subject,
    filmSubject: parts.filmSubject,
    peopleSubjects: parts.peopleSubjects,
    workTitle: parts.workTitle,
    originalValue: {
      ...(rank === null
        ? { selected: true }
        : { rank, list_length: listLength }),
      raw,
      film_subject: parts.filmSubject,
      people_subjects: parts.peopleSubjects,
    },
    originalScale: null,
    categoryId,
    predictionIntention: "nomination",
    participates: true,
  };
}

function buildBatch({
  connectorId,
  sourceId,
  extractorVersion,
  seasonId,
  capturedAt,
  sourceUrl,
  publication,
  rowsByCategory,
}) {
  const observations = [];
  for (const [categoryId, rows] of rowsByCategory) {
    const explicitRanks = rows.map((row) => row.rank);
    const isOrdered = explicitRanks.some((rank) => rank !== null);
    if (
      isOrdered &&
      explicitRanks.some(
        (rank, index) => !Number.isInteger(rank) || rank !== index + 1,
      )
    ) {
      throw new Error(
        `${sourceId} publicó posiciones no consecutivas en ${categoryId}`,
      );
    }
    const listLength = rows.length;
    observations.push(
      ...rows.map((row) =>
        observation(categoryId, row.rank, listLength, row.parts, row.raw),
      ),
    );
  }
  if (observations.length === 0) {
    throw new Error(`${sourceId} no contiene categorías reconocibles`);
  }
  return {
    connectorId,
    sourceId,
    extractorVersion,
    seasonId,
    capturedAt: new Date(capturedAt).toISOString(),
    sourceUrl,
    publications: [
      {
        ...publication,
        originalData: {
          source_id: sourceId,
          title: publication.title,
          canonical_url: publication.canonicalUrl,
          author: publication.author,
          publication_date: publication.publishedAt,
          categories: Object.fromEntries(rowsByCategory),
        },
        observations,
      },
    ],
  };
}

function awardsRadarCardRows(html, categoryId) {
  const updateMarker = html.search(
    /Updated\s+[A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4}/i,
  );
  const content = updateMarker >= 0 ? html.slice(updateMarker) : html;
  const rows = [];
  for (const match of content.matchAll(
    /<h([2-4])\b[^>]*class=(?:"[^"]*\belementor-image-box-title\b[^"]*"|'[^']*\belementor-image-box-title\b[^']*')[^>]*>([\s\S]*?)<\/h\1>/gi,
  )) {
    const label = stripTags(match[2]);
    const ranked = label.match(/^(\d+)\s*[.)]\s+(.+)$/);
    if (!ranked) continue;
    const rank = Number(ranked[1]);
    rows.push({
      rank,
      raw: label,
      parts: subjectParts(categoryId, ranked[2].trim()),
    });
  }
  return rows.toSorted((left, right) => left.rank - right.rank);
}

function parseHeadingLists(
  lines,
  { numbered, contentStart = 0, removeConsensus = false, maxRows = 25 },
) {
  const rowsByCategory = new Map();
  let categoryId = null;
  let inAlternates = false;
  for (const line of lines.slice(contentStart)) {
    const heading = headingCategory(line);
    if (heading) {
      categoryId = heading;
      inAlternates = false;
      if (!rowsByCategory.has(heading)) rowsByCategory.set(heading, []);
      continue;
    }
    if (
      !numbered &&
      /^(?:\(?alts?(?:[.:\s)]|$)|\(?next|also consider)/i.test(line)
    ) {
      inAlternates = true;
    }
    if (!categoryId || inAlternates || /^-+$/.test(line)) continue;
    const rankMatch = line.match(/^(\d+)\s*[.)]\s+(.+)$/);
    if (numbered && !rankMatch) continue;
    if (!numbered && /^\(?next|^also consider/i.test(line)) continue;
    const rank = rankMatch ? Number(rankMatch[1]) : null;
    let raw = rankMatch ? rankMatch[2].trim() : line;
    if (removeConsensus) {
      raw = raw
        .replace(/\s*-\s*(?:A\s*LL|ALL)$/i, "")
        .replace(/\s+-\s+[A-Z][\s\S]*$/, "")
        .trim();
    }
    const rows = rowsByCategory.get(categoryId);
    if (!raw) continue;
    if (rows.length >= maxRows) {
      throw new Error(
        `La lista ${categoryId} excede el límite esperado de ${maxRows} filas`,
      );
    }
    rows.push({
      rank,
      raw: line,
      parts: subjectParts(categoryId, raw),
    });
  }
  return new Map([...rowsByCategory].filter(([, rows]) => rows.length > 0));
}

export function parseAwardsDailyFixture(
  html,
  { connectorId, capturedAt, endpointUrl, seasonId },
) {
  const publication = publicationMetadata(
    html,
    endpointUrl,
    "awards-daily",
    capturedAt,
  );
  assertPredictionSeason(publication.title, seasonId, "awards-daily");
  const articleLines = htmlLines(
    divContentByClass(html, "content-inner") ?? html,
  );
  const footerStart = articleLines.findIndex((line) => /^Tags:/i.test(line));
  const lines =
    footerStart === -1 ? articleLines : articleLines.slice(0, footerStart);
  const predictionsMarker = lastIndexMatching(lines, (line) =>
    /^Predictions:?$/i.test(line),
  );
  const start =
    predictionsMarker >= 0
      ? lines.findIndex(
          (line, index) =>
            index > predictionsMarker &&
            headingCategory(line) === "best-picture",
        )
      : lastIndexMatching(
          lines,
          (line) => headingCategory(line) === "best-picture",
        );
  if (start < 0) {
    throw new Error(
      "awards-daily no contiene un bloque de predicciones Best Picture",
    );
  }
  const rowsByCategory = parseHeadingLists(lines, {
    numbered: false,
    contentStart: start,
    maxRows: 10,
  });
  return buildBatch({
    connectorId,
    sourceId: "awards-daily",
    extractorVersion: "awards-daily-v8",
    seasonId,
    capturedAt,
    sourceUrl: publication.canonicalUrl,
    publication,
    rowsByCategory,
  });
}

export function parseAwardsRadarFixture(
  html,
  {
    connectorId,
    capturedAt,
    endpointUrl,
    seasonId,
    categoryId = /** @type {string | null} */ (null),
  },
) {
  const metadata = publicationMetadata(
    html,
    endpointUrl,
    "awards-radar",
    capturedAt,
  );
  const lines = htmlLines(html);
  assertPredictionSeason(
    lines
      .filter((line) => /^20\d{2} Oscars? Predictions$/i.test(line))
      .join(" "),
    seasonId,
    "awards-radar",
  );
  const updatedAt = updatedPredictionDate(lines);
  const publication = {
    ...metadata,
    publishedAt: updatedAt ?? metadata.publishedAt,
  };
  const updateMarker = lines.findIndex((line) => /^Updated\s+/i.test(line));
  if (categoryId && (updateMarker < 0 || !updatedAt)) {
    throw new Error("awards-radar no contiene el marcador de actualización");
  }
  const categoryHeading = categoryId
    ? CATEGORY_DEFINITIONS.find(([id]) => id === categoryId)?.[1]?.[0]
    : null;
  const parsingLines =
    categoryId && categoryHeading
      ? [categoryHeading, ...lines.slice(Math.max(updateMarker + 1, 0))]
      : lines;
  const start = categoryId
    ? 0
    : Math.max(
        parsingLines.findIndex((line) => line === "BEST PICTURE"),
        0,
      );
  const cardRows = categoryId ? awardsRadarCardRows(html, categoryId) : [];
  const rowsByCategory = cardRows.length
    ? new Map([[categoryId, cardRows]])
    : parseHeadingLists(parsingLines, {
        numbered: true,
        contentStart: start,
        maxRows: Number.POSITIVE_INFINITY,
      });
  // Source typos verified against the film's official credits; keep raw intact.
  for (const rows of rowsByCategory.values()) {
    for (const row of rows) {
      if (row.parts.filmSubject?.toLocaleLowerCase() === "artifical") {
        row.parts.filmSubject = "Artificial";
      }
      row.parts.peopleSubjects = row.parts.peopleSubjects.map((person) =>
        person.toLocaleLowerCase() === "guy peace" ? "Guy Pearce" : person,
      );
    }
  }
  return buildBatch({
    connectorId,
    sourceId: "awards-radar",
    extractorVersion: "awards-radar-v6",
    seasonId,
    capturedAt,
    sourceUrl: publication.canonicalUrl,
    publication,
    rowsByCategory,
  });
}

export function parseMidnightCriticsFixture(
  html,
  { connectorId, capturedAt, endpointUrl, seasonId },
) {
  const publication = publicationMetadata(
    html,
    endpointUrl,
    "midnight-critics",
    capturedAt,
  );
  const lines = htmlLines(html);
  const marker = lines.findIndex(
    (line) => line === `${expectedCeremonyYear(seasonId)} Oscar Predictions`,
  );
  if (marker < 0) {
    throw new Error("midnight-critics no contiene el marcador de predicciones");
  }
  const start = lines.findIndex(
    (line, index) => index > marker && line === "BEST PICTURE",
  );
  if (start < 0) {
    throw new Error(
      "midnight-critics no contiene el bloque de predicciones Best Picture",
    );
  }
  return buildBatch({
    connectorId,
    sourceId: "midnight-critics",
    extractorVersion: "midnight-critics-v1",
    seasonId,
    capturedAt,
    sourceUrl: publication.canonicalUrl,
    publication,
    rowsByCategory: parseHeadingLists(lines, {
      numbered: true,
      contentStart: start,
      removeConsensus: true,
      maxRows: 25,
    }),
  });
}

function lastIndexOf(lines, value) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index] === value) return index;
  }
  return -1;
}

function lastIndexMatching(lines, predicate) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (predicate(lines[index], index)) return index;
  }
  return -1;
}

export function parseNextBestPictureFixture(
  html,
  { connectorId, capturedAt, endpointUrl, seasonId },
) {
  const metadata = publicationMetadata(
    html,
    endpointUrl,
    "next-best-picture",
    capturedAt,
  );
  const publication = {
    ...metadata,
    // The page-level time is the site clock, not a prediction publication date.
    publishedAt: null,
  };
  assertPredictionSeason(
    metaContent(html, "description") ?? "",
    seasonId,
    "next-best-picture",
  );
  const lines = htmlLines(html);
  const headingPositions = CATEGORY_DEFINITIONS.flatMap(
    ([categoryId, aliases]) => {
      const positions = aliases
        .map((alias) => lastIndexOf(lines, alias))
        .filter((position) => position >= 0);
      return positions.length
        ? [{ categoryId, position: Math.max(...positions) }]
        : [];
    },
  ).sort((left, right) => left.position - right.position);
  const rowsByCategory = new Map();

  for (let index = 0; index < headingPositions.length; index += 1) {
    const current = headingPositions[index];
    const end = headingPositions[index + 1]?.position ?? lines.length;
    const section = lines
      .slice(current.position + 1, end)
      .filter((line) => !/^[A-Z][a-z]{2}\s+\d{1,2}$/.test(line));
    const rows = [];
    let numericBuffer = [];
    for (let cursor = 0; cursor < section.length;) {
      const line = section[cursor];
      if (/^\d+$/.test(line)) {
        numericBuffer.push(Number(line));
        cursor += 1;
        continue;
      }
      if (line === "See more" || line === "View all") break;
      const detail = section[cursor + 1];
      if (numericBuffer.length === 0) {
        cursor += 1;
        continue;
      }
      const rank = numericBuffer[0];
      let parts;
      if (PERSON_CATEGORIES.has(current.categoryId)) {
        if (!detail || /^\d+$/.test(detail)) {
          cursor += 1;
          continue;
        }
        parts = {
          subject: `${line} — ${detail}`,
          filmSubject: detail,
          peopleSubjects: peopleFromText(line),
          workTitle: null,
        };
      } else {
        const usableDetail = detail && !/^\d+$/.test(detail) ? detail : "";
        const peopleText = usableDetail.includes("|")
          ? TEAM_CATEGORIES.has(current.categoryId)
            ? usableDetail.split("|")[0].trim()
            : ""
          : "";
        parts = {
          subject: line,
          filmSubject: line,
          peopleSubjects: peopleText ? peopleFromText(peopleText) : [],
          workTitle: null,
        };
      }
      rows.push({ rank, raw: `${line} | ${detail ?? ""}`, parts });
      numericBuffer = [];
      cursor += detail && !/^\d+$/.test(detail) ? 2 : 1;
    }
    const seenRows = new Set();
    const uniqueRows = rows.filter((row) => {
      const key = `${row.rank}:${row.parts.subject.trim().toLocaleLowerCase("en")}`;
      if (seenRows.has(key)) return false;
      seenRows.add(key);
      return true;
    });
    if (uniqueRows.length) rowsByCategory.set(current.categoryId, uniqueRows);
  }

  const batch = buildBatch({
    connectorId,
    sourceId: "next-best-picture",
    extractorVersion: "next-best-picture-v3",
    seasonId,
    capturedAt,
    sourceUrl: publication.canonicalUrl,
    publication,
    rowsByCategory,
  });
  // Correct attribution from the explicit page title without changing the raw
  // capture identity or renewing freshness when the ranking is unchanged.
  batch.publications[0].author =
    metadata.author ??
    metadata.title.match(
      /^Oscar Predictions\s+[-–—]\s+(.+?)\s+[-–—]\s+Next Best Picture$/i,
    )?.[1] ??
    null;
  return batch;
}

function awardsWatchCategorySection(article, categoryId) {
  const headings = [
    ...article.matchAll(/<h[2-6]\b[^>]*>([\s\S]*?)<\/h[2-6]>/gi),
  ]
    .map((match) => ({
      categoryId: headingCategory(stripTags(match[1])),
      index: match.index,
      end: match.index + match[0].length,
    }))
    .filter((heading) => heading.categoryId);
  const start = headings.findLast(
    (heading) => heading.categoryId === categoryId,
  );
  if (!start) {
    if (headings.length)
      throw new Error(`AwardsWatch no contiene la sección ${categoryId}`);
    return article;
  }
  const next = headings.find((heading) => heading.index > start.index);
  return article.slice(start.end, next?.index ?? article.length);
}

function awardsWatchPanel(section, categoryId, panelAuthor) {
  const tables = [...section.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
  if (
    !tables.some((table) =>
      [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].some(
        (row) => [...row[1].matchAll(/<t[dh]\b/gi)].length > 1,
      ),
    )
  )
    return null;
  let column = -1;
  let columnCount = 0;
  let foundAuthor = false;
  const rows = [];
  const alternates = [];
  const authors = [];
  for (const table of tables) {
    const tableRows = [
      ...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi),
    ].map((match) =>
      [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
        (cell) => stripTags(cell[1]),
      ),
    );
    const header = tableRows.find((cells) => cells.some(Boolean));
    if (!header) continue;
    if (header.every((cell) => /^\*category placement tbd$/i.test(cell)))
      continue;
    const authorIndex = header.findIndex(
      (cell) => cell.toLocaleLowerCase() === panelAuthor.toLocaleLowerCase(),
    );
    const isNext = header.every((cell) => /^NEXT$/i.test(cell));
    if (authorIndex >= 0) {
      if (foundAuthor)
        throw new Error(
          "AwardsWatch repite la tabla del autor en una categoría",
        );
      column = authorIndex;
      columnCount = header.length;
      foundAuthor = true;
      authors.push(...header);
    } else if (!isNext || !foundAuthor) {
      throw new Error(
        `AwardsWatch no contiene la columna configurada ${panelAuthor}`,
      );
    }
    for (const cells of tableRows.slice(tableRows.indexOf(header) + 1)) {
      if (cells.every((cell) => !cell)) continue;
      if (cells.length !== columnCount || !cells[column]) {
        throw new Error("AwardsWatch contiene una fila de panel incompleta");
      }
      const raw = cells[column];
      const match = raw.match(/^(\d+)\s*[.)]\s+(.+)$/);
      const row = {
        rank: match ? Number(match[1]) : null,
        raw,
        parts: subjectParts(categoryId, match?.[2] ?? raw),
      };
      // An unnumbered NEXT block is an alternate tier, not a nomination vote.
      if (isNext && row.rank === null) alternates.push(row);
      else rows.push(row);
    }
  }
  if (!foundAuthor || !rows.length) {
    throw new Error(
      `AwardsWatch no contiene la columna configurada ${panelAuthor}`,
    );
  }
  return { rows, alternates, authors };
}

export function parseAwardsWatchArticleFixture(
  html,
  {
    connectorId,
    capturedAt,
    endpointUrl,
    seasonId,
    categoryId,
    panelAuthor = "Erik Anderson",
  },
) {
  const metadata = publicationMetadata(
    html,
    endpointUrl,
    "awardswatch",
    capturedAt,
  );
  assertPredictionSeason(metadata.title, seasonId, "awardswatch");
  const article = html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? html;
  const section = awardsWatchCategorySection(article, categoryId);
  const panel = awardsWatchPanel(section, categoryId, panelAuthor);
  const rows = panel?.rows ?? [];
  if (!panel) {
    for (const line of htmlLines(section)) {
      if (/^Full list|alphabetical/i.test(line)) break;
      const match = line.match(/^(\d+)\.\s+(.+)$/);
      if (!match) continue;
      rows.push({
        rank: Number(match[1]),
        raw: line,
        parts: subjectParts(categoryId, match[2].trim()),
      });
    }
  }
  const publication = {
    ...metadata,
    ...(panel ? { author: panelAuthor } : {}),
  };
  const batch = buildBatch({
    connectorId,
    sourceId: "awardswatch",
    extractorVersion: "awardswatch-multicategory-v6",
    seasonId,
    capturedAt,
    sourceUrl: publication.canonicalUrl,
    publication,
    rowsByCategory: new Map([[categoryId, rows]]),
  });
  if (panel) {
    batch.publications[0].originalData.panel = {
      selected_author: panelAuthor,
      available_authors: panel.authors,
      selection_rule: "configured-author",
      alternates: panel.alternates,
    };
  }
  return batch;
}

export function discoverAwardsWatchCategoryUrls(html) {
  const discovered = new Map();
  for (const match of html.matchAll(
    /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const categoryId = headingCategory(stripTags(match[3]));
    const url = match[1] ?? match[2];
    if (categoryId && url && !discovered.has(categoryId)) {
      discovered.set(categoryId, httpsUrl(url, "AwardsWatch category URL"));
    }
  }
  return discovered;
}

function datedUrlValue(value) {
  const match = new URL(value).pathname.match(
    /\/(\d{4})\/(\d{2})\/(\d{2})(?:\/|$)/,
  );
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

export function discoverWordPressPredictionUrls(payload, ceremonyYear = 2027) {
  if (!Array.isArray(payload)) {
    throw new Error("El discovery WordPress no devolvió una lista");
  }
  const titlePattern = new RegExp(
    `${ceremonyYear}\\s+Oscar\\s+Predictions`,
    "i",
  );
  return payload
    .flatMap((entry) => {
      if (
        !entry ||
        entry.subtype !== "post" ||
        typeof entry.title !== "string" ||
        typeof entry.url !== "string" ||
        !titlePattern.test(stripTags(entry.title))
      ) {
        return [];
      }
      try {
        return [httpsUrl(entry.url, "WordPress prediction URL")];
      } catch {
        return [];
      }
    })
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .sort(
      (left, right) =>
        datedUrlValue(right).localeCompare(datedUrlValue(left)) ||
        right.localeCompare(left),
    );
}

const AWARDSWATCH_TITLE_PATTERNS = Object.freeze({
  "best-picture": /\bBEST PICTURE\b/i,
  directing: /\bBEST DIRECTOR\b/i,
  actor: /\bBEST ACTOR\b/i,
  actress: /\bBEST ACTRESS\b/i,
  "supporting-actor": /\bSUPPORTING ACTOR\b/i,
  "supporting-actress": /\bSUPPORTING ACTRESS\b/i,
  "original-screenplay": /\bORIGINAL SCREENPLAY\b/i,
  "adapted-screenplay": /\bADAPTED SCREENPLAY\b/i,
});

export function discoverLatestAwardsWatchArticle(
  html,
  ceremonyYear = 2027,
  categoryId = /** @type {string | null} */ (null),
) {
  const candidates = [];
  const categoryPattern = categoryId
    ? AWARDSWATCH_TITLE_PATTERNS[categoryId]
    : null;
  for (const match of html.matchAll(
    /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const label = stripTags(match[3]);
    const url = match[1] ?? match[2];
    if (
      url &&
      new RegExp(`${ceremonyYear} Oscar Predictions`, "i").test(label) &&
      (!categoryPattern || categoryPattern.test(label)) &&
      !/\/category\//.test(url)
    ) {
      candidates.push(httpsUrl(url, "AwardsWatch article URL"));
    }
  }
  return candidates[0] ?? null;
}

export function discoverLatestRingerBestPictureArticle(
  html,
  ceremonyYear = 2027,
) {
  const candidates = [];
  for (const match of html.matchAll(
    /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const label = stripTags(match[3]);
    const rawUrl = match[1] ?? match[2];
    if (!rawUrl) continue;
    let url;
    try {
      url = new URL(rawUrl, "https://www.theringer.com/").toString();
    } catch {
      continue;
    }
    if (
      new URL(url).hostname === "www.theringer.com" &&
      new RegExp(`${ceremonyYear}.*(?:Oscar|Best Picture)`, "i").test(label) &&
      /\/oscars\//.test(new URL(url).pathname)
    ) {
      candidates.push(httpsUrl(url, "The Ringer prediction URL"));
    }
  }
  return (
    candidates
      .filter((url, index, urls) => urls.indexOf(url) === index)
      .sort(
        (left, right) =>
          datedUrlValue(right).localeCompare(datedUrlValue(left)) ||
          right.localeCompare(left),
      )[0] ?? null
  );
}

export function parseRingerSelectionFixture(
  html,
  { connectorId, capturedAt, endpointUrl, seasonId },
) {
  const publication = publicationMetadata(
    html,
    endpointUrl,
    "the-ringer",
    capturedAt,
  );
  const article = html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? html;
  const films = [];
  for (const line of htmlLines(article)) {
    const match = line.match(/^(.+?)\s+\(dir\.\s+[^)]+\)$/i);
    const label = match?.[1]?.trim();
    if (label && !films.includes(label)) films.push(label);
  }
  if (films.length === 0) {
    throw new Error("The Ringer no contiene selecciones reconocibles");
  }
  return {
    connectorId,
    sourceId: "the-ringer",
    extractorVersion: "the-ringer-v1",
    seasonId,
    capturedAt: new Date(capturedAt).toISOString(),
    sourceUrl: publication.canonicalUrl,
    publications: [
      {
        ...publication,
        originalData: {
          title: publication.title,
          canonical_url: publication.canonicalUrl,
          selections: films,
        },
        observations: films.map((film) => ({
          dataType: "prediction_selection",
          subject: film,
          filmSubject: film,
          peopleSubjects: [],
          workTitle: null,
          originalValue: { selected: true, raw: film },
          originalScale: null,
          categoryId: "best-picture",
          predictionIntention: "nomination",
          participates: true,
        })),
      },
    ],
  };
}
