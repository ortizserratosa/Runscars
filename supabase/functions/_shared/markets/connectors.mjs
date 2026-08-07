import { parseKalshiMarkets, parsePolymarketEvents } from "./core.mjs";

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }
  return 500 * 2 ** attempt;
}

async function jsonResponse(url, fetcher) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetcher(url, {
      headers: { Accept: "application/json", "User-Agent": "Runscars/0.1" },
    });
    if (response.ok) return response.json();
    if (response.status === 429 && attempt < 4) {
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay(response, attempt)),
      );
      continue;
    }
    throw new Error(
      `HTTP ${response.status} al consultar ${new URL(url).host}`,
    );
  }
  throw new Error(`No se pudo consultar ${new URL(url).host}`);
}

export const MARKET_CONNECTORS = Object.freeze({
  "kalshi-oscars": async ({ connector, capturedAt, fetcher = fetch }) => {
    const seriesTickers = connector.configuration.series_tickers;
    if (!Array.isArray(seriesTickers) || !seriesTickers.length) {
      throw new Error(
        "Kalshi necesita series_tickers para acotar el discovery",
      );
    }
    const all = [];
    for (const seriesTicker of seriesTickers) {
      let cursor = null;
      do {
        const url = new URL(connector.endpoint_url);
        url.searchParams.set("limit", "1000");
        url.searchParams.set("status", "open");
        url.searchParams.set("series_ticker", seriesTicker);
        url.searchParams.set("mve_filter", "exclude");
        if (cursor) url.searchParams.set("cursor", cursor);
        const payload = await jsonResponse(url, fetcher);
        all.push(...(payload.markets ?? []));
        cursor = payload.cursor ?? null;
      } while (cursor);
    }
    return parseKalshiMarkets(
      { markets: all },
      {
        capturedAt,
        seasonId: connector.configuration.season_id,
        ceremonyYear: connector.configuration.ceremony_year,
      },
    );
  },

  "polymarket-oscars": async ({ connector, capturedAt, fetcher = fetch }) => {
    const searchUrl = new URL(connector.endpoint_url);
    searchUrl.pathname = "/public-search";
    searchUrl.searchParams.set("q", connector.configuration.query ?? "Oscars");
    searchUrl.searchParams.set("limit_per_type", "50");
    const search = await jsonResponse(searchUrl, fetcher);
    const events = [];
    for (const result of search.events ?? []) {
      const identity = `${result.title ?? ""} ${result.slug ?? ""}`;
      if (
        !identity.includes(String(connector.configuration.ceremony_year)) ||
        result.active === false ||
        result.closed === true
      ) {
        continue;
      }
      const eventUrl = new URL(`/events/${result.id}`, searchUrl);
      events.push(await jsonResponse(eventUrl, fetcher));
    }
    return parsePolymarketEvents(events, {
      capturedAt,
      seasonId: connector.configuration.season_id,
      ceremonyYear: connector.configuration.ceremony_year,
    });
  },
});
