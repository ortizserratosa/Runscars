import { parseKalshiMarkets, parsePolymarketEvents } from "./core.mjs";

async function jsonResponse(url, fetcher) {
  const response = await fetcher(url, {
    headers: { Accept: "application/json", "User-Agent": "Runscars/0.1" },
  });
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} al consultar ${new URL(url).host}`,
    );
  }
  return response.json();
}

export const MARKET_CONNECTORS = Object.freeze({
  "kalshi-oscars": async ({ connector, capturedAt, fetcher = fetch }) => {
    const all = [];
    let cursor = null;
    for (let page = 0; page < 20; page += 1) {
      const url = new URL(connector.endpoint_url);
      url.searchParams.set("limit", "1000");
      url.searchParams.set("status", "open");
      if (cursor) url.searchParams.set("cursor", cursor);
      const payload = await jsonResponse(url, fetcher);
      all.push(...(payload.markets ?? []));
      cursor = payload.cursor ?? null;
      if (!cursor) break;
    }
    return parseKalshiMarkets(
      { markets: all },
      {
        capturedAt,
        seasonId: connector.configuration.season_id,
      },
    );
  },

  "polymarket-oscars": async ({ connector, capturedAt, fetcher = fetch }) => {
    const searchUrl = new URL(connector.endpoint_url);
    searchUrl.pathname = "/public-search";
    searchUrl.searchParams.set("q", connector.configuration.query ?? "Oscars");
    const search = await jsonResponse(searchUrl, fetcher);
    const events = [];
    for (const result of search.events ?? []) {
      const eventUrl = new URL(`/events/${result.id}`, searchUrl);
      events.push(await jsonResponse(eventUrl, fetcher));
    }
    return parsePolymarketEvents(events, {
      capturedAt,
      seasonId: connector.configuration.season_id,
    });
  },
});
