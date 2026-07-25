import {
  normalizeIdentity,
  parseAwardsWatchFixture,
  parseGuardianFixture,
  parseRogerEbertFixture,
} from "./core.mjs";
import {
  discoverAwardsWatchCategoryUrls,
  discoverLatestAwardsWatchArticle,
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
    const html = await fetchText(
      connector.endpoint_url,
      { headers: { Accept: "text/html", "User-Agent": "Runscars/0.1" } },
      fetcher,
    );
    return parseAwardsDailyFixture(html, {
      connectorId: connector.id,
      capturedAt,
      endpointUrl: connector.endpoint_url,
      seasonId: connector.configuration.season_id,
    });
  },

  "awards-radar-predictions": async ({
    connector,
    capturedAt,
    fetcher = fetch,
  }) => {
    const html = await fetchText(
      connector.endpoint_url,
      { headers: { Accept: "text/html", "User-Agent": "Runscars/0.1" } },
      fetcher,
    );
    return parseAwardsRadarFixture(html, {
      connectorId: connector.id,
      capturedAt,
      endpointUrl: connector.endpoint_url,
      seasonId: connector.configuration.season_id,
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
    return parseNextBestPictureFixture(html, {
      connectorId: connector.id,
      capturedAt,
      endpointUrl: connector.endpoint_url,
      seasonId: connector.configuration.season_id,
    });
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
    return parseMidnightCriticsFixture(html, {
      connectorId: connector.id,
      capturedAt,
      endpointUrl: connector.endpoint_url,
      seasonId: connector.configuration.season_id,
    });
  },

  "ringer-best-picture": async ({ connector, capturedAt, fetcher = fetch }) => {
    const html = await fetchText(
      connector.endpoint_url,
      { headers: { Accept: "text/html", "User-Agent": "Runscars/0.1" } },
      fetcher,
    );
    return parseRingerSelectionFixture(html, {
      connectorId: connector.id,
      capturedAt,
      endpointUrl: connector.endpoint_url,
      seasonId: connector.configuration.season_id,
    });
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
    for (const categoryId of categoryIds) {
      const categoryUrl = categoryUrls.get(categoryId);
      if (!categoryUrl) continue;
      const listing = await fetchText(categoryUrl, { headers }, fetcher);
      const articleUrl = discoverLatestAwardsWatchArticle(
        listing,
        connector.configuration.ceremony_year ?? 2027,
      );
      if (!articleUrl) continue;
      const article = await fetchText(articleUrl, { headers }, fetcher);
      const batch = parseAwardsWatchArticleFixture(article, {
        connectorId: connector.id,
        capturedAt,
        endpointUrl: articleUrl,
        seasonId: connector.configuration.season_id,
        categoryId,
      });
      publications.push(...batch.publications);
    }
    if (publications.length === 0) {
      throw new Error("AwardsWatch no publicó categorías reconocibles");
    }
    return {
      connectorId: connector.id,
      sourceId: "awardswatch",
      extractorVersion: "awardswatch-multicategory-v2",
      seasonId: connector.configuration.season_id,
      capturedAt,
      sourceUrl: connector.endpoint_url,
      publications,
    };
  },
});
