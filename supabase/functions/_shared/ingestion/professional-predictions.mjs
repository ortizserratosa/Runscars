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
  const match = html.match(
    /<link\b[^>]*\brel=(?:"canonical"|'canonical')[^>]*\bhref=(?:"([^"]+)"|'([^']+)')[^>]*>/i,
  );
  return httpsUrl(match?.[1] ?? match?.[2] ?? fallback, "canonicalUrl");
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

function publicationMetadata(html, endpointUrl, sourceId, capturedAt) {
  const url = canonicalUrl(html, endpointUrl);
  const published =
    metaContent(html, "article:published_time") ??
    html.match(/<time\b[^>]*datetime=(?:"([^"]+)"|'([^']+)')/i)?.[1] ??
    html.match(/<time\b[^>]*datetime=(?:"([^"]+)"|'([^']+)')/i)?.[2] ??
    null;
  const title =
    metaContent(html, "og:title") ??
    stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "") ??
    `${sourceId} Oscar predictions`;
  return {
    externalId: new URL(url).pathname.replace(/^\/|\/$/g, "") || sourceId,
    canonicalUrl: url,
    title,
    author: metaContent(html, "author"),
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
    .replace(/^THE\s+/i, "")
    .trim();
  for (const [categoryId, aliases] of CATEGORY_DEFINITIONS) {
    if (aliases.some((alias) => normalized === alias)) return categoryId;
  }
  return null;
}

function peopleFromText(value) {
  return value
    .split(/\s+(?:and|&)\s+|,\s*/i)
    .map((person) => person.replace(/\s+\([^()]+\)\s*$/u, "").trim())
    .filter(Boolean);
}

function subjectParts(categoryId, raw) {
  const clean = raw
    .replace(/[⬆⬇↔]+/gu, "")
    .replace(/\s+(?:NEW|RETURNING|DEBUT)\s*$/i, "")
    .replace(
      /\s+\((?:Netflix|NEON|A24|MUBI|TBD|[^()]*(?:Pictures|Studios|Studio|Films|Film|Entertainment|Universal|Amazon|Columbia|Focus|Searchlight|Warner|Lionsgate))[^()]*\)\s*$/i,
      "",
    )
    .replace(
      /\s+\((?:could|may|might)\s+be\s+[^()]*(?:original|adapted)[^()]*\)\s*$/i,
      "",
    )
    .replace(/\s+\((?:The|A|An)\s+[^()]+\)\s*$/i, "")
    .trim();
  if (!PERSON_CATEGORIES.has(categoryId)) {
    return {
      subject: clean,
      filmSubject: clean,
      peopleSubjects: [],
      workTitle: null,
    };
  }
  const dash = clean.match(/^(.+?)\s+[–—-]\s+(.+)$/);
  if (dash) {
    return {
      subject: clean,
      filmSubject: dash[2].trim(),
      peopleSubjects: peopleFromText(dash[1]),
      workTitle: null,
    };
  }
  const parts = clean.split(/,\s*/);
  if (parts.length >= 2) {
    return {
      subject: clean,
      filmSubject: parts.at(-1).trim(),
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
    dataType: "prediction_ordered",
    subject: parts.subject,
    filmSubject: parts.filmSubject,
    peopleSubjects: parts.peopleSubjects,
    workTitle: parts.workTitle,
    originalValue: {
      rank,
      list_length: listLength,
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
    const listLength = rows.length;
    observations.push(
      ...rows.map((row, index) =>
        observation(
          categoryId,
          row.rank ?? index + 1,
          listLength,
          row.parts,
          row.raw,
        ),
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

function parseHeadingLists(
  lines,
  { numbered, contentStart = 0, removeConsensus = false, maxRows = 25 },
) {
  const rowsByCategory = new Map();
  let categoryId = null;
  for (const line of lines.slice(contentStart)) {
    const heading = headingCategory(line);
    if (heading) {
      categoryId = heading;
      if (!rowsByCategory.has(heading)) rowsByCategory.set(heading, []);
      continue;
    }
    if (!categoryId || /^\(?alts?:/i.test(line) || /^-+$/.test(line)) {
      continue;
    }
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
    if (
      !raw ||
      rows.length >= maxRows ||
      rows.some((row) => row.rank === rank && rank !== null)
    ) {
      continue;
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
  const lines = htmlLines(html);
  const start = Math.max(
    lines.findIndex((line) => line === "Best Picture"),
    0,
  );
  const rowsByCategory = parseHeadingLists(lines, {
    numbered: false,
    contentStart: start,
    maxRows: 10,
  });
  return buildBatch({
    connectorId,
    sourceId: "awards-daily",
    extractorVersion: "awards-daily-v1",
    seasonId,
    capturedAt,
    sourceUrl: publication.canonicalUrl,
    publication,
    rowsByCategory,
  });
}

export function parseAwardsRadarFixture(
  html,
  { connectorId, capturedAt, endpointUrl, seasonId },
) {
  const publication = publicationMetadata(
    html,
    endpointUrl,
    "awards-radar",
    capturedAt,
  );
  const lines = htmlLines(html);
  const start = Math.max(
    lines.findIndex((line) => line === "BEST PICTURE"),
    0,
  );
  return buildBatch({
    connectorId,
    sourceId: "awards-radar",
    extractorVersion: "awards-radar-v1",
    seasonId,
    capturedAt,
    sourceUrl: publication.canonicalUrl,
    publication,
    rowsByCategory: parseHeadingLists(lines, {
      numbered: true,
      contentStart: start,
      maxRows: 10,
    }),
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
  const marker = lines.findIndex((line) => line === "2027 Oscar Predictions");
  const start = lines.findIndex(
    (line, index) => index > marker && line === "BEST PICTURE",
  );
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
      contentStart: Math.max(start, 0),
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

export function parseNextBestPictureFixture(
  html,
  { connectorId, capturedAt, endpointUrl, seasonId },
) {
  const publication = publicationMetadata(
    html,
    endpointUrl,
    "next-best-picture",
    capturedAt,
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
      if (!detail || /^\d+$/.test(detail) || numericBuffer.length === 0) {
        cursor += 1;
        continue;
      }
      const rank = numericBuffer[0];
      let parts;
      if (PERSON_CATEGORIES.has(current.categoryId)) {
        parts = {
          subject: `${line} — ${detail}`,
          filmSubject: detail,
          peopleSubjects: peopleFromText(line),
          workTitle: null,
        };
      } else {
        const peopleText = detail.includes("|")
          ? TEAM_CATEGORIES.has(current.categoryId)
            ? detail.split("|")[0].trim()
            : ""
          : "";
        parts = {
          subject: line,
          filmSubject: line,
          peopleSubjects: peopleText ? peopleFromText(peopleText) : [],
          workTitle: null,
        };
      }
      rows.push({ rank, raw: `${line} | ${detail}`, parts });
      numericBuffer = [];
      cursor += 2;
    }
    if (rows.length) rowsByCategory.set(current.categoryId, rows);
  }

  return buildBatch({
    connectorId,
    sourceId: "next-best-picture",
    extractorVersion: "next-best-picture-v1",
    seasonId,
    capturedAt,
    sourceUrl: publication.canonicalUrl,
    publication,
    rowsByCategory,
  });
}

export function parseAwardsWatchArticleFixture(
  html,
  { connectorId, capturedAt, endpointUrl, seasonId, categoryId },
) {
  const publication = publicationMetadata(
    html,
    endpointUrl,
    "awardswatch",
    capturedAt,
  );
  const lines = htmlLines(html);
  const categoryAliases =
    CATEGORY_DEFINITIONS.find(([id]) => id === categoryId)?.[1] ?? [];
  const sectionStart = lines.reduce(
    (latest, line, index) =>
      categoryAliases.some(
        (alias) => line.toLocaleUpperCase() === alias.toLocaleUpperCase(),
      )
        ? index + 1
        : latest,
    0,
  );
  const rows = [];
  for (const line of lines.slice(sectionStart)) {
    const match = line.match(/^(\d+)\.\s+(.+)$/);
    if (!match) continue;
    const rank = Number(match[1]);
    if (rank !== rows.length + 1) {
      if (rows.length > 0) break;
      continue;
    }
    const raw = match[2].trim();
    rows.push({
      rank,
      raw: line,
      parts: subjectParts(categoryId, raw),
    });
  }
  return buildBatch({
    connectorId,
    sourceId: "awardswatch",
    extractorVersion: "awardswatch-multicategory-v2",
    seasonId,
    capturedAt,
    sourceUrl: publication.canonicalUrl,
    publication,
    rowsByCategory: new Map([[categoryId, rows]]),
  });
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

export function discoverLatestAwardsWatchArticle(html, ceremonyYear = 2027) {
  const candidates = [];
  for (const match of html.matchAll(
    /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const label = stripTags(match[3]);
    const url = match[1] ?? match[2];
    if (
      url &&
      new RegExp(`${ceremonyYear} Oscar Predictions`, "i").test(label) &&
      !/\/category\//.test(url)
    ) {
      candidates.push(httpsUrl(url, "AwardsWatch article URL"));
    }
  }
  return candidates[0] ?? null;
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
