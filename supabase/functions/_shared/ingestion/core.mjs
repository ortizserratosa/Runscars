export const INGESTION_EXTRACTORS = Object.freeze({
  "guardian-content-api": "guardian-v1",
  "roger-ebert-rss": "roger-ebert-v1",
  "awardswatch-best-picture": "awardswatch-v1",
  "manual-editorial": "manual-v1",
});

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Falta ${field}`);
  }
  return value.trim();
}

function requiredHttpsUrl(value, field) {
  const url = new URL(requiredText(value, field));
  if (url.protocol !== "https:") {
    throw new Error(`${field} debe usar HTTPS`);
  }
  url.hash = "";
  return url.toString();
}

function isoDate(value, field, nullable = false) {
  if (nullable && (value === null || value === undefined || value === "")) {
    return null;
  }
  const date = new Date(requiredText(value, field));
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`${field} no es una fecha válida`);
  }
  return date.toISOString();
}

export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(
    typeof value === "string" ? value : canonicalJson(value),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function normalizeIdentity(value) {
  return requiredText(value, "identidad")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/&/g, " and ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function filmSubjectFromReviewTitle(title) {
  return title
    .replace(/\s+(?:movie\s+)?review\b.*$/i, "")
    .replace(/\s+\|\s+Roger Ebert.*$/i, "")
    .trim();
}

function asArray(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function creditCategoryPriority(categoryId, credit) {
  const department = normalizeIdentity(credit.department ?? "unknown");
  const role = normalizeIdentity(credit.role ?? "unknown");
  if (categoryId === "directing") {
    return department === "directing" || role.includes("director") ? 0 : 1;
  }
  if (
    categoryId === "original-screenplay" ||
    categoryId === "adapted-screenplay"
  ) {
    return department === "writing" || /writer|screenplay|story/.test(role)
      ? 0
      : 1;
  }
  if (
    ["actor", "actress", "supporting-actor", "supporting-actress"].includes(
      categoryId,
    )
  ) {
    return department === "acting" || /actor|actress|self/.test(role) ? 0 : 1;
  }
  return 0;
}

function decodeEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([a-f0-9]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&([a-z]+);/gi, (entity, name) => named[name] ?? entity);
}

function stripTags(value) {
  return decodeEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstTag(source, tagName) {
  const match = source.match(
    new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"),
  );
  return match ? stripTags(match[1]) : "";
}

function firstClass(source, className) {
  const pattern = new RegExp(
    `<([a-z0-9]+)[^>]*class=(?:"[^"]*\\b${className}\\b[^"]*"|'[^']*\\b${className}\\b[^']*')[^>]*>([\\s\\S]*?)<\\/\\1>`,
    "i",
  );
  const match = source.match(pattern);
  return match ? stripTags(match[2]) : "";
}

function attribute(source, selectorPattern, attributeName) {
  const element = source.match(selectorPattern)?.[0] ?? "";
  return (
    element
      .match(
        new RegExp(`${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"),
      )
      ?.slice(1)
      .find(Boolean) ?? ""
  );
}

function baseObservation({
  dataType,
  subject,
  originalValue,
  originalScale = null,
  categoryId = null,
  predictionIntention = null,
  participates = false,
}) {
  return {
    dataType,
    subject: requiredText(subject, "observation.subject"),
    originalValue,
    originalScale,
    categoryId,
    predictionIntention,
    participates,
  };
}

export function parseGuardianFixture(
  payload,
  {
    capturedAt,
    endpointUrl = "https://content.guardianapis.com/search",
    seasonId = "oscars-2027",
  },
) {
  if (!payload || payload.response?.status !== "ok") {
    throw new Error("Guardian devolvió una respuesta inválida");
  }

  const publications = asArray(payload.response.results).map((result) => {
    const fields = result.fields ?? {};
    const title = requiredText(
      fields.headline ?? result.webTitle,
      "Guardian headline",
    );
    const subject = filmSubjectFromReviewTitle(title);
    const url = requiredHttpsUrl(result.webUrl, "Guardian webUrl");
    const publishedAt = isoDate(
      result.webPublicationDate,
      "Guardian webPublicationDate",
      true,
    );
    const author =
      typeof fields.byline === "string" && fields.byline.trim()
        ? fields.byline.trim()
        : (asArray(result.tags)
            .map((tag) => tag?.webTitle)
            .find(Boolean) ?? null);
    const observations = [
      baseObservation({
        dataType: "review",
        subject,
        originalValue: { linked_review: true },
      }),
    ];

    if (fields.starRating !== undefined && fields.starRating !== null) {
      const rating = Number(fields.starRating);
      if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
        throw new Error(`Guardian publicó una nota inválida para ${title}`);
      }
      observations.push(
        baseObservation({
          dataType: "score_individual",
          subject,
          originalValue: { score: rating },
          originalScale: { minimum: 0, maximum: 5, unit: "stars" },
          participates: true,
        }),
      );
    }

    return {
      externalId: requiredText(result.id, "Guardian id"),
      canonicalUrl: url,
      title,
      author,
      publishedAt,
      originalData: {
        id: result.id,
        headline: title,
        web_url: url,
        publication_date: publishedAt,
        byline: author,
        star_rating: fields.starRating ?? null,
      },
      observations,
    };
  });

  return {
    connectorId: "guardian-content-api",
    sourceId: "guardian",
    extractorVersion: INGESTION_EXTRACTORS["guardian-content-api"],
    seasonId,
    capturedAt: isoDate(capturedAt, "capturedAt"),
    sourceUrl: requiredHttpsUrl(endpointUrl, "endpointUrl"),
    publications,
  };
}

export function parseRogerEbertFixture(
  xml,
  {
    capturedAt,
    endpointUrl = "https://www.rogerebert.com/feed",
    seasonId = "oscars-2027",
  },
) {
  const document = requiredText(xml, "RSS");
  const items = [
    ...document.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
  ].map((match) => match[1]);
  const publications = items
    .map((item) => {
      const canonicalUrl = requiredHttpsUrl(firstTag(item, "link"), "RSS link");
      if (new URL(canonicalUrl).pathname.startsWith("/reviews/") === false) {
        return null;
      }
      const title = requiredText(firstTag(item, "title"), "RSS title");
      const publishedAt = isoDate(
        firstTag(item, "pubDate"),
        "RSS pubDate",
        true,
      );
      const author = firstTag(item, "dc:creator") || null;
      const externalId =
        firstTag(item, "guid") || new URL(canonicalUrl).pathname;

      return {
        externalId,
        canonicalUrl,
        title,
        author,
        publishedAt,
        originalData: {
          guid: externalId,
          title,
          link: canonicalUrl,
          publication_date: publishedAt,
          author,
        },
        observations: [
          baseObservation({
            dataType: "review",
            subject: filmSubjectFromReviewTitle(title),
            originalValue: { linked_review: true },
          }),
        ],
      };
    })
    .filter((publication) => publication !== null);

  return {
    connectorId: "roger-ebert-rss",
    sourceId: "roger-ebert",
    extractorVersion: INGESTION_EXTRACTORS["roger-ebert-rss"],
    seasonId,
    capturedAt: isoDate(capturedAt, "capturedAt"),
    sourceUrl: requiredHttpsUrl(endpointUrl, "endpointUrl"),
    publications,
  };
}

function awardsWatchTitle(cellText) {
  const withoutRank = cellText.replace(/^\s*\d+\s*[.)-]\s*/, "").trim();
  return withoutRank
    .replace(/[⬆⬇↔]+/gu, "")
    .replace(
      /\s+\([^()]*(?:Pictures|Studios|Studio|Films|Film|Netflix|MUBI|NEON|A24|Lionsgate|Universal|Amazon|Columbia|Focus|Searchlight|Warner)[^()]*\)\s*$/i,
      "",
    )
    .trim();
}

export function parseAwardsWatchFixture(
  html,
  {
    capturedAt,
    endpointUrl,
    seasonId = "oscars-2027",
    categoryId = "best-picture",
    intention = "nomination",
  },
) {
  const document = requiredText(html, "AwardsWatch HTML");
  const canonicalUrl = requiredHttpsUrl(
    attribute(
      document,
      /<link\b[^>]*\brel=(?:"canonical"|'canonical')[^>]*>/i,
      "href",
    ) || endpointUrl,
    "AwardsWatch canonical",
  );
  const article =
    document.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? document;
  const title = requiredText(
    firstClass(article, "entry-title") || firstTag(article, "h1"),
    "AwardsWatch title",
  );
  const author = firstClass(article, "posts-author") || null;
  const publishedText = firstClass(article, "posts-date");
  const publishedAt = isoDate(publishedText, "AwardsWatch date", true);
  const headings = [...article.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)];
  const bestPictureHeading = headings.find(
    (heading) => stripTags(heading[1]).toUpperCase() === "BEST PICTURE",
  );
  const sectionStart = bestPictureHeading?.index ?? -1;
  const afterHeading = sectionStart >= 0 ? article.slice(sectionStart) : "";
  const nextHeadingIndex = afterHeading
    .slice(bestPictureHeading?.[0].length ?? 0)
    .search(/<h[23]\b/i);
  const section =
    nextHeadingIndex >= 0
      ? afterHeading.slice(
          0,
          (bestPictureHeading?.[0].length ?? 0) + nextHeadingIndex,
        )
      : afterHeading;
  const cells = [...section.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
  const rows = cells
    .map((cell) => {
      const raw = stripTags(cell[1]);
      const parsedRank = Number.parseInt(raw.match(/^\s*(\d+)/)?.[1] ?? "", 10);
      const subject = awardsWatchTitle(raw);
      if (!subject || !Number.isInteger(parsedRank)) return null;
      return { rank: parsedRank, subject, raw };
    })
    .filter((row) => row !== null);

  if (rows.length === 0) {
    throw new Error(
      "AwardsWatch no contiene una tabla BEST PICTURE reconocible",
    );
  }

  const listLength = rows.length;
  const externalId =
    attribute(article, /^<article\b[^>]*>/i, "id").replace(/^post-/, "") ||
    new URL(canonicalUrl).pathname.replace(/^\/|\/$/g, "");

  return {
    connectorId: "awardswatch-best-picture",
    sourceId: "awardswatch",
    extractorVersion: INGESTION_EXTRACTORS["awardswatch-best-picture"],
    seasonId,
    capturedAt: isoDate(capturedAt, "capturedAt"),
    sourceUrl: canonicalUrl,
    publications: [
      {
        externalId: requiredText(externalId, "AwardsWatch externalId"),
        canonicalUrl,
        title,
        author,
        publishedAt,
        originalData: {
          title,
          canonical_url: canonicalUrl,
          author,
          publication_date: publishedAt,
          category: "BEST PICTURE",
          rows,
        },
        observations: rows.map((row) =>
          baseObservation({
            dataType: "prediction_ordered",
            subject: row.subject,
            originalValue: {
              rank: row.rank,
              list_length: listLength,
              raw: row.raw,
            },
            categoryId,
            predictionIntention: intention,
            participates: true,
          }),
        ),
      },
    ],
  };
}

export function parseManualManifest(manifest, { capturedAt }) {
  if (!manifest || manifest.formatVersion !== 1) {
    throw new Error("El manifiesto manual debe usar formatVersion 1");
  }
  const sourceId = requiredText(manifest.sourceId, "sourceId");
  const seasonId = requiredText(manifest.seasonId, "seasonId");
  const publications = asArray(manifest.publications).map((publication) => {
    const canonicalUrl = requiredHttpsUrl(
      publication.canonicalUrl,
      "publication.canonicalUrl",
    );
    const discoveredVia = asArray(publication.discoveredVia).map(
      (discovery) => ({
        sourceId: requiredText(
          discovery.sourceId,
          "publication.discoveredVia.sourceId",
        ),
        url: requiredHttpsUrl(discovery.url, "publication.discoveredVia.url"),
        discoveredAt: isoDate(
          discovery.discoveredAt,
          "publication.discoveredVia.discoveredAt",
          true,
        ),
      }),
    );
    return {
      externalId: requiredText(
        publication.externalId,
        "publication.externalId",
      ),
      canonicalUrl,
      title: requiredText(publication.title, "publication.title"),
      author:
        typeof publication.author === "string" && publication.author.trim()
          ? publication.author.trim()
          : null,
      publishedAt: isoDate(
        publication.publishedAt,
        "publication.publishedAt",
        true,
      ),
      discoveredVia,
      originalData: publication.originalData ?? {
        manually_entered: true,
        title: publication.title,
        canonical_url: canonicalUrl,
      },
      observations: asArray(publication.observations).map((observation) => {
        const dataType = requiredText(observation.dataType, "dataType");
        if (
          ![
            "review",
            "score_individual",
            "score_aggregate",
            "prediction_ordered",
            "prediction_selection",
          ].includes(dataType)
        ) {
          throw new Error(
            `Tipo de observación manual no admitido: ${dataType}`,
          );
        }
        return {
          ...baseObservation({
            dataType,
            subject: observation.subject,
            originalValue: observation.originalValue,
            originalScale: observation.originalScale ?? null,
            categoryId: observation.categoryId ?? null,
            predictionIntention: observation.predictionIntention ?? null,
            participates: observation.participates === true,
          }),
          filmId: observation.filmId ?? null,
          personId: observation.personId ?? null,
        };
      }),
    };
  });

  return {
    connectorId: "manual-editorial",
    sourceId,
    extractorVersion: INGESTION_EXTRACTORS["manual-editorial"],
    seasonId,
    capturedAt: isoDate(capturedAt, "capturedAt"),
    sourceUrl: publications[0]?.canonicalUrl,
    publications,
  };
}

export function matchFilm(subject, filmIdentities) {
  const normalized = normalizeIdentity(subject);
  return filmIdentities.filter((film) => {
    return [film.title, ...(film.alternate_titles ?? [])].some(
      (title) => normalizeIdentity(title) === normalized,
    );
  });
}

export async function prepareBatch(batch, filmIdentities) {
  const preparedPublications = [];

  for (const publication of batch.publications) {
    const contentHash = await sha256(publication.originalData);
    const structuredContentHash = await sha256({
      extractor_version: batch.extractorVersion,
      original_data: publication.originalData,
      observations: publication.observations,
    });
    const publicationExternalId =
      publication.isMutable === true
        ? `${publication.externalId}@${structuredContentHash.slice(0, 16)}`
        : publication.externalId;
    const preparedObservations = [];

    for (const observation of publication.observations) {
      const isPrediction =
        observation.dataType === "prediction_ordered" ||
        observation.dataType === "prediction_selection";
      const explicitFilm = observation.filmId
        ? filmIdentities.filter((film) => film.id === observation.filmId)
        : null;
      const matches =
        explicitFilm ??
        matchFilm(
          observation.filmSubject ?? observation.subject,
          filmIdentities,
        );
      const matchedFilm = matches.length === 1 ? matches[0] : null;
      const filmId = matchedFilm?.id ?? null;
      const peopleSubjects = asArray(observation.peopleSubjects).filter(
        (value) => typeof value === "string" && value.trim(),
      );
      const matchedPeople = [];
      const ambiguousPeople = [];
      for (const personSubject of peopleSubjects) {
        const personMatches = (matchedFilm?.credits ?? [])
          .filter((credit) =>
            [credit.person.name, ...(credit.person.alternate_names ?? [])].some(
              (name) =>
                normalizeIdentity(name) === normalizeIdentity(personSubject),
            ),
          )
          .toSorted(
            (left, right) =>
              creditCategoryPriority(observation.categoryId, left) -
                creditCategoryPriority(observation.categoryId, right) ||
              (left.billingOrder ?? Number.MAX_SAFE_INTEGER) -
                (right.billingOrder ?? Number.MAX_SAFE_INTEGER) ||
              String(left.role).localeCompare(String(right.role), "en"),
          );
        const uniquePeople = personMatches.filter(
          (credit, index, credits) =>
            credits.findIndex(
              (candidate) => candidate.person.id === credit.person.id,
            ) === index,
        );
        if (uniquePeople.length === 1) {
          matchedPeople.push({
            id: uniquePeople[0].person.id,
            name: uniquePeople[0].person.name,
            role: uniquePeople[0].role,
            displayOrder: matchedPeople.length,
          });
        } else {
          ambiguousPeople.push({
            subject: personSubject,
            candidateIds: uniquePeople.map((credit) => credit.person.id),
          });
        }
      }
      const categoryRequiresPerson = [
        "directing",
        "actor",
        "actress",
        "supporting-actor",
        "supporting-actress",
      ].includes(observation.categoryId);
      const filmNeedsReview =
        !observation.workTitle &&
        (matches.length !== 1 || matchedFilm === null);
      const personNeedsReview =
        isPrediction &&
        (ambiguousPeople.length > 0 ||
          (categoryRequiresPerson && matchedPeople.length === 0));
      const needsReview = isPrediction
        ? filmNeedsReview || personNeedsReview
        : observation.personId === null || observation.personId === undefined
          ? filmId === null
          : false;
      let candidate = null;
      if (isPrediction && !needsReview) {
        const identityKey = await sha256({
          season_id: batch.seasonId,
          category_id: observation.categoryId,
          film_id: filmId,
          work_title: observation.workTitle
            ? normalizeIdentity(observation.workTitle)
            : null,
          person_ids: matchedPeople.map((person) => person.id).sort(),
        });
        const peopleLabel = matchedPeople
          .map((person) => person.name)
          .join(", ");
        const workLabel =
          matchedFilm?.title ?? observation.workTitle ?? observation.subject;
        candidate = {
          id: `candidate-${identityKey.slice(0, 24)}`,
          identityKey,
          seasonId: batch.seasonId,
          categoryId: observation.categoryId,
          filmId,
          workTitle: observation.workTitle ?? null,
          displayLabel: peopleLabel
            ? `${peopleLabel} — ${workLabel}`
            : workLabel,
          people: matchedPeople,
        };
      }
      const dedupeKey = await sha256({
        source_id: batch.sourceId,
        publication_id: publicationExternalId,
        author: publication.author,
        subject_id:
          candidate?.id ??
          filmId ??
          observation.personId ??
          normalizeIdentity(observation.subject),
        data_type: observation.dataType,
        category_id: observation.categoryId,
        prediction_intention: observation.predictionIntention,
        original_value: observation.originalValue,
      });

      preparedObservations.push({
        ...observation,
        dedupeKey,
        filmId,
        personId: observation.personId ?? null,
        candidate,
        categoryCandidateId: candidate?.id ?? null,
        state: needsReview ? "pending_review" : "published",
        participates: needsReview ? false : observation.participates,
        review: needsReview
          ? {
              kind: personNeedsReview ? "person_match" : "film_match",
              subjectLabel: observation.subject,
              candidateFilmIds: matches.map((match) => match.id),
              candidatePersonIds: ambiguousPeople.flatMap(
                (person) => person.candidateIds,
              ),
              queueKey: await sha256({
                connector_id: batch.connectorId,
                dedupe_key: dedupeKey,
                kind: personNeedsReview ? "person_match" : "film_match",
              }),
            }
          : null,
      });
    }

    preparedPublications.push({
      ...publication,
      externalId: publicationExternalId,
      contentHash,
      observations: preparedObservations,
    });
  }

  return { ...batch, publications: preparedPublications };
}
