import {
  normalizeIdentity,
  parseAwardsWatchFixture,
  parseGuardianFixture,
  parseRogerEbertFixture,
} from "./core.mjs";
import {
  discoverAwardsWatchCategoryUrls,
  discoverLatestAwardsWatchArticle,
  discoverLatestRingerBestPictureArticle,
  discoverWordPressPredictionUrls,
  parseAwardsDailyFixture,
  parseAwardsRadarFixture,
  parseAwardsWatchArticleFixture,
  parseMidnightCriticsFixture,
  parseNextBestPictureFixture,
  parseRingerSelectionFixture,
} from "./professional-predictions.mjs";

async function fetchText(url, init, fetcher) {
  const response = await fetcher(url, init);
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} al consultar ${new URL(url).host}`,
    );
  }
  return response.text();
}

async function fetchJson(url, init, fetcher) {
  const response = await fetcher(url, init);
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} al consultar ${new URL(url).host}`,
    );
  }
  return response.json();
}

function categoryPublicationUrls(publications) {
  const latest = new Map();
  for (const publication of publications) {
    const effectiveAt = publication.publishedAt ?? publication.capturedAt ?? "";
    for (const categoryId of new Set(
      publication.observations.map((observation) => observation.categoryId),
    )) {
      const previous = latest.get(categoryId);
      if (!previous || effectiveAt > previous.effectiveAt) {
        latest.set(categoryId, {
          effectiveAt,
          url: publication.canonicalUrl,
        });
      }
    }
  }
  return Object.fromEntries(
    [...latest].map(([categoryId, value]) => [categoryId, value.url]),
  );
}

function withDiscovery(batch, values) {
  return {
    ...batch,
    discovery: {
      checkedAt: batch.capturedAt,
      publicationUrls: batch.publications.map(
        (publication) => publication.canonicalUrl,
      ),
      latestCategoryUrls: categoryPublicationUrls(batch.publications),
      ...values,
    },
  };
}

function mutableBatch(batch, { publishedAt } = {}) {
  return {
    ...batch,
    publications: batch.publications.map((publication) => {
      const stablePublishedAt =
        publishedAt === undefined ? publication.publishedAt : publishedAt;
      return {
        ...publication,
        isMutable: true,
        publishedAt: stablePublishedAt,
        originalData: {
          ...publication.originalData,
          publication_date: stablePublishedAt,
        },
      };
    }),
  };
}

function mergeBatches(batches, values) {
  const first = batches[0];
  if (!first) throw new Error("El discovery no encontró publicaciones válidas");
  return withDiscovery(
    {
      connectorId: first.connectorId,
      sourceId: first.sourceId,
      extractorVersion: values.extractorVersion ?? first.extractorVersion,
      seasonId: first.seasonId,
      capturedAt: first.capturedAt,
      sourceUrl: values.indexUrl,
      publications: batches.flatMap((batch) => batch.publications),
    },
    values,
  );
}

function latestCategoryBatches(batches) {
  const coveredCategories = new Set();
  const selected = [];
  const supersededUrls = [];
  for (const batch of batches) {
    const categories = new Set(
      batch.publications.flatMap((publication) =>
        publication.observations.map((observation) => observation.categoryId),
      ),
    );
    if (
      [...categories].some((categoryId) => !coveredCategories.has(categoryId))
    ) {
      selected.push(batch);
      for (const categoryId of categories) coveredCategories.add(categoryId);
    } else {
      supersededUrls.push(
        ...batch.publications.map((publication) => publication.canonicalUrl),
      );
    }
  }
  return { selected, supersededUrls };
}

const AWARDS_RADAR_CATEGORY_URLS = Object.freeze({
  "best-picture": "https://awardsradar.com/best-picture/",
  directing: "https://awardsradar.com/best-director/",
  actor: "https://awardsradar.com/best-actor/",
  actress: "https://awardsradar.com/best-actress/",
  "supporting-actor": "https://awardsradar.com/best-supporting-actor/",
  "supporting-actress": "https://awardsradar.com/best-supporting-actress/",
  "original-screenplay": "https://awardsradar.com/best-original-screenplay/",
  "adapted-screenplay": "https://awardsradar.com/best-adapted-screenplay/",
});

export const CONNECTORS = Object.freeze({
  "guardian-content-api": async ({
    connector,
    capturedAt,
    fetcher = fetch,
    secrets = {},
    filmIdentities = /** @type {Array<{
      title: string;
      alternate_titles?: string[];
    }>} */ ([]),
  }) => {
    const apiKey = secrets.GUARDIAN_CONTENT_API_KEY;
    if (!apiKey) {
      throw new Error("Guardian está desactivado hasta configurar su API key");
    }
    const url = new URL(connector.endpoint_url);
    url.searchParams.set("api-key", apiKey);
    url.searchParams.set("q", connector.configuration.query ?? "film review");
    url.searchParams.set("tag", "film/film,tone/reviews");
    url.searchParams.set("show-fields", "headline,byline,starRating");
    url.searchParams.set("show-tags", "contributor");
    url.searchParams.set("order-by", "newest");
    url.searchParams.set("page-size", "50");
    const response = await fetcher(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} al consultar Guardian`);
    }
    const batch = parseGuardianFixture(await response.json(), {
      capturedAt,
      endpointUrl: connector.endpoint_url,
      seasonId: connector.configuration.season_id,
    });
    if (connector.configuration.catalog_only !== true) return batch;

    const catalogTitles = new Set(
      filmIdentities.flatMap((film) =>
        [film.title, ...(film.alternate_titles ?? [])].map(normalizeIdentity),
      ),
    );
    return {
      ...batch,
      publications: batch.publications.filter((publication) =>
        publication.observations.some((observation) =>
          catalogTitles.has(normalizeIdentity(observation.subject)),
        ),
      ),
    };
  },

  "roger-ebert-rss": async ({ connector, capturedAt, fetcher = fetch }) => {
    const xml = await fetchText(
      connector.endpoint_url,
      { headers: { Accept: "application/rss+xml, application/xml" } },
      fetcher,
    );
    return parseRogerEbertFixture(xml, {
      capturedAt,
      endpointUrl: connector.endpoint_url,
      seasonId: connector.configuration.season_id,
    });
  },

  "awardswatch-best-picture": async ({
    connector,
    capturedAt,
    fetcher = fetch,
  }) => {
    const html = await fetchText(
      connector.endpoint_url,
      { headers: { Accept: "text/html", "User-Agent": "Runscars/0.1" } },
      fetcher,
    );
    return parseAwardsWatchFixture(html, {
      capturedAt,
      endpointUrl: connector.endpoint_url,
      seasonId: connector.configuration.season_id,
      categoryId: connector.configuration.category_id,
      intention: connector.configuration.intention,
    });
  },

  "awards-daily-predictions": async ({
    connector,
    capturedAt,
    fetcher = fetch,
  }) => {
    const headers = {
      Accept: "application/json",
      "User-Agent": "Runscars/0.1",
    };
    const discoveryUrl =
      connector.configuration.discovery_url ?? connector.endpoint_url;
    const candidates = discoverWordPressPredictionUrls(
      await fetchJson(discoveryUrl, { headers }, fetcher),
      connector.configuration.ceremony_year ?? 2027,
    );
    const limit = connector.configuration.discovery_limit ?? 12;
    const batches = [];
    const skippedUrls = [];
    const ignoredUrls = [];
    for (const articleUrl of candidates.slice(0, limit)) {
      try {
        const html = await fetchText(
          articleUrl,
          {
            headers: {
              Accept: "text/html",
              "User-Agent": "Runscars/0.1",
            },
          },
          fetcher,
        );
        batches.push(
          mutableBatch(
            parseAwardsDailyFixture(html, {
              connectorId: connector.id,
              capturedAt,
              endpointUrl: articleUrl,
              seasonId: connector.configuration.season_id,
            }),
          ),
        );
      } catch (error) {
        const item = {
          url: articleUrl,
          reason: error instanceof Error ? error.message : "error desconocido",
        };
        if (/no contiene categorías reconocibles$/.test(item.reason)) {
          ignoredUrls.push(item);
        } else {
          skippedUrls.push(item);
        }
      }
    }
    const latest = latestCategoryBatches(batches);
    return mergeBatches(latest.selected, {
      mode: "wordpress-search",
      indexUrl: discoveryUrl,
      extractorVersion: "awards-daily-v3",
      candidatesFound: candidates.length,
      ignoredUrls,
      supersededUrls: latest.supersededUrls,
      skippedUrls,
    });
  },

  "awards-radar-predictions": async ({
    connector,
    capturedAt,
    fetcher = fetch,
  }) => {
    const categoryUrls = {
      ...AWARDS_RADAR_CATEGORY_URLS,
      ...(connector.configuration.category_urls ?? {}),
    };
    const batches = [];
    const skippedUrls = [];
    for (const [categoryId, categoryUrl] of Object.entries(categoryUrls)) {
      try {
        const html = await fetchText(
          categoryUrl,
          { headers: { Accept: "text/html", "User-Agent": "Runscars/0.1" } },
          fetcher,
        );
        batches.push(
          mutableBatch(
            parseAwardsRadarFixture(html, {
              connectorId: connector.id,
              capturedAt,
              endpointUrl: categoryUrl,
              seasonId: connector.configuration.season_id,
              categoryId,
            }),
          ),
        );
      } catch (error) {
        skippedUrls.push({
          categoryId,
          url: categoryUrl,
          reason: error instanceof Error ? error.message : "error desconocido",
        });
      }
    }
    return mergeBatches(batches, {
      mode: "mutable-category-pages",
      indexUrl: connector.endpoint_url,
      extractorVersion: "awards-radar-v3",
      categoriesChecked: Object.keys(categoryUrls).length,
      skippedUrls,
    });
  },

  "next-best-picture-predictions": async ({
    connector,
    capturedAt,
    fetcher = fetch,
  }) => {
    const html = await fetchText(
      connector.endpoint_url,
      { headers: { Accept: "text/html", "User-Agent": "Runscars/0.1" } },
      fetcher,
    );
    return withDiscovery(
      {
        ...mutableBatch(
          parseNextBestPictureFixture(html, {
            connectorId: connector.id,
            capturedAt,
            endpointUrl: connector.endpoint_url,
            seasonId: connector.configuration.season_id,
          }),
          { publishedAt: null },
        ),
        extractorVersion: "next-best-picture-v2",
      },
      {
        mode: "mutable-page",
        indexUrl: connector.endpoint_url,
        skippedUrls: [],
      },
    );
  },

  "midnight-critics-predictions": async ({
    connector,
    capturedAt,
    fetcher = fetch,
  }) => {
    const html = await fetchText(
      connector.endpoint_url,
      { headers: { Accept: "text/html", "User-Agent": "Runscars/0.1" } },
      fetcher,
    );
    return withDiscovery(
      {
        ...mutableBatch(
          parseMidnightCriticsFixture(html, {
            connectorId: connector.id,
            capturedAt,
            endpointUrl: connector.endpoint_url,
            seasonId: connector.configuration.season_id,
          }),
          { publishedAt: null },
        ),
        extractorVersion: "midnight-critics-v2",
      },
      {
        mode: "mutable-page",
        indexUrl: connector.endpoint_url,
        skippedUrls: [],
      },
    );
  },

  "ringer-best-picture": async ({ connector, capturedAt, fetcher = fetch }) => {
    const headers = { Accept: "text/html", "User-Agent": "Runscars/0.1" };
    const listing = await fetchText(
      connector.endpoint_url,
      { headers },
      fetcher,
    );
    const fallbackUrl =
      connector.configuration.article_fallback_url ??
      (/\/\d{4}\/\d{2}\/\d{2}\//.test(connector.endpoint_url)
        ? connector.endpoint_url
        : null);
    const articleUrl =
      discoverLatestRingerBestPictureArticle(
        listing,
        connector.configuration.ceremony_year ?? 2027,
      ) ?? fallbackUrl;
    if (!articleUrl) {
      throw new Error("The Ringer no publicó una selección 2027 reconocible");
    }
    const article =
      articleUrl === connector.endpoint_url
        ? listing
        : await fetchText(articleUrl, { headers }, fetcher);
    return withDiscovery(
      {
        ...parseRingerSelectionFixture(article, {
          connectorId: connector.id,
          capturedAt,
          endpointUrl: articleUrl,
          seasonId: connector.configuration.season_id,
        }),
        extractorVersion: "the-ringer-v2",
      },
      {
        mode: "topic-page",
        indexUrl: connector.endpoint_url,
        skippedUrls: [],
      },
    );
  },

  "awardswatch-predictions": async ({
    connector,
    capturedAt,
    fetcher = fetch,
  }) => {
    const headers = {
      Accept: "text/html",
      "User-Agent": "Runscars/0.1",
    };
    const hq = await fetchText(connector.endpoint_url, { headers }, fetcher);
    const categoryUrls = discoverAwardsWatchCategoryUrls(hq);
    const archiveUrl =
      connector.configuration.archive_url ??
      "https://awardswatch.com/category/predictions/film-predictions/oscars-predictions/2027-oscar-predictions/";
    const archive = await fetchText(archiveUrl, { headers }, fetcher);
    const categoryIds = connector.configuration.category_ids ?? [
      "best-picture",
      "directing",
      "actor",
      "actress",
      "supporting-actor",
      "supporting-actress",
      "adapted-screenplay",
      "original-screenplay",
    ];
    const publications = [];
    const skippedUrls = [];
    const unavailableCategories = [];
    for (const categoryId of categoryIds) {
      const categoryUrl = categoryUrls.get(categoryId);
      if (!categoryUrl) {
        unavailableCategories.push({
          categoryId,
          reason: "categoría no publicada",
        });
        continue;
      }
      try {
        let articleUrl = discoverLatestAwardsWatchArticle(
          archive,
          connector.configuration.ceremony_year ?? 2027,
          categoryId,
        );
        if (!articleUrl) {
          const listing = await fetchText(categoryUrl, { headers }, fetcher);
          articleUrl = discoverLatestAwardsWatchArticle(
            listing,
            connector.configuration.ceremony_year ?? 2027,
            categoryId,
          );
        }
        if (!articleUrl) {
          unavailableCategories.push({
            categoryId,
            url: categoryUrl,
            reason: "publicación 2027 no encontrada",
          });
          continue;
        }
        const article = await fetchText(articleUrl, { headers }, fetcher);
        const batch = mutableBatch(
          parseAwardsWatchArticleFixture(article, {
            connectorId: connector.id,
            capturedAt,
            endpointUrl: articleUrl,
            seasonId: connector.configuration.season_id,
            categoryId,
          }),
        );
        publications.push(...batch.publications);
      } catch (error) {
        skippedUrls.push({
          categoryId,
          url: categoryUrl,
          reason: error instanceof Error ? error.message : "error desconocido",
        });
      }
    }
    if (publications.length === 0) {
      throw new Error("AwardsWatch no publicó categorías reconocibles");
    }
    return withDiscovery(
      {
        connectorId: connector.id,
        sourceId: "awardswatch",
        extractorVersion: "awardswatch-multicategory-v4",
        seasonId: connector.configuration.season_id,
        capturedAt,
        sourceUrl: connector.endpoint_url,
        publications,
      },
      {
        mode: "category-archives",
        indexUrl: archiveUrl,
        categoriesChecked: categoryIds.length,
        unavailableCategories,
        skippedUrls,
      },
    );
  },
});
