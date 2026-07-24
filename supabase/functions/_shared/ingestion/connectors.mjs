import {
  parseAwardsWatchFixture,
  parseGuardianFixture,
  parseRogerEbertFixture,
} from "./core.mjs";

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
    return parseGuardianFixture(await response.json(), {
      capturedAt,
      endpointUrl: connector.endpoint_url,
      seasonId: connector.configuration.season_id,
    });
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
});
