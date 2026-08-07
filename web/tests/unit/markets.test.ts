import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MARKET_CONNECTORS } from "../../../supabase/functions/_shared/markets/connectors.mjs";
import {
  matchMarketCandidate,
  parseKalshiMarkets,
  parsePolymarketEvents,
  prepareMarketContracts,
} from "../../../supabase/functions/_shared/markets/core.mjs";

const fixtureDirectory = path.resolve(
  import.meta.dirname,
  "../fixtures/markets",
);
const capturedAt = "2026-07-25T12:00:00Z";

async function fixture(name: string) {
  return JSON.parse(await readFile(path.join(fixtureDirectory, name), "utf8"));
}

describe("market ingestion", () => {
  it("filters Kalshi to Oscar contracts and preserves original fields", async () => {
    const contracts = parseKalshiMarkets(await fixture("kalshi.json"), {
      capturedAt,
      seasonId: "oscars-2027",
      ceremonyYear: 2027,
    });
    expect(contracts).toHaveLength(1);
    expect(contracts[0]).toMatchObject({
      provider: "kalshi",
      categoryId: "best-picture",
      candidateLabel: "The Odyssey",
      probability: 0.42,
      volume: 1200.5,
      openInterest: 320,
    });
    expect(contracts[0].originalData.ticker).toBe("KXOSCARPIC-27-ODYSSEY");
  });

  it("reads Polymarket YES token price without mixing providers", async () => {
    const contracts = parsePolymarketEvents(await fixture("polymarket.json"), {
      capturedAt,
      seasonId: "oscars-2027",
      ceremonyYear: 2027,
    });
    expect(contracts).toHaveLength(1);
    expect(contracts[0]).toMatchObject({
      provider: "polymarket",
      categoryId: "best-picture",
      externalContractId: "yes-token",
      candidateLabel: "The Odyssey",
      outcomeLabel: "The Odyssey",
      probability: 0.41,
    });
  });

  it("rejects markets from another ceremony or already closed", async () => {
    const kalshi = await fixture("kalshi.json");
    const otherCeremony = {
      ...kalshi.markets[0],
      ticker: "KXOSCARPIC-26-ODYSSEY",
      event_ticker: "KXOSCARPIC-26",
    };
    const closed = {
      ...kalshi.markets[0],
      ticker: "KXOSCARPIC-27-CLOSED",
      close_time: "2026-06-01T00:00:00Z",
    };
    expect(
      parseKalshiMarkets(
        { markets: [otherCeremony, closed] },
        {
          capturedAt,
          seasonId: "oscars-2027",
          ceremonyYear: 2027,
        },
      ),
    ).toHaveLength(0);

    const polymarket = await fixture("polymarket.json");
    expect(
      parsePolymarketEvents(
        [
          {
            ...polymarket[0],
            title: "Oscars 2026 Best Picture",
            slug: "oscars-best-picture-2026",
          },
          {
            ...polymarket[0],
            id: "closed-event",
            closed: true,
          },
        ],
        {
          capturedAt,
          seasonId: "oscars-2027",
          ceremonyYear: 2027,
        },
      ),
    ).toHaveLength(0);
  });

  it("queries the configured Kalshi series instead of scanning global markets", async () => {
    const kalshi = await fixture("kalshi.json");
    const requestedSeries: string[] = [];
    let throttled = true;
    const contracts = await MARKET_CONNECTORS["kalshi-oscars"]({
      connector: {
        endpoint_url: "https://external-api.kalshi.com/trade-api/v2/markets",
        configuration: {
          ceremony_year: 2027,
          season_id: "oscars-2027",
          series_tickers: ["KXOSCARNOMPIC", "KXOSCARPIC"],
        },
      },
      capturedAt,
      fetcher: async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        requestedSeries.push(url.searchParams.get("series_ticker") ?? "");
        if (throttled) {
          throttled = false;
          return new Response(null, {
            status: 429,
            headers: { "retry-after": "0.001" },
          });
        }
        return new Response(
          JSON.stringify({ markets: kalshi.markets, cursor: null }),
        );
      },
    });

    expect(requestedSeries).toEqual([
      "KXOSCARNOMPIC",
      "KXOSCARNOMPIC",
      "KXOSCARPIC",
    ]);
    expect(contracts).toHaveLength(2);
  });

  it("fetches only active Polymarket events for the configured ceremony", async () => {
    const polymarket = await fixture("polymarket.json");
    const requestedPaths: string[] = [];
    const contracts = await MARKET_CONNECTORS["polymarket-oscars"]({
      connector: {
        endpoint_url: "https://gamma-api.polymarket.com/markets",
        configuration: {
          ceremony_year: 2027,
          query: "Oscars 2027",
          season_id: "oscars-2027",
        },
      },
      capturedAt,
      fetcher: async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        requestedPaths.push(url.pathname);
        if (url.pathname === "/public-search") {
          return new Response(
            JSON.stringify({
              events: [
                {
                  id: "event-oscars-2027",
                  title: "Oscars 2027 Best Picture",
                  active: true,
                  closed: false,
                },
                {
                  id: "event-oscars-2026",
                  title: "Oscars 2026 Best Picture",
                  active: true,
                  closed: false,
                },
              ],
            }),
          );
        }
        return new Response(JSON.stringify(polymarket[0]));
      },
    });

    expect(requestedPaths).toEqual([
      "/public-search",
      "/events/event-oscars-2027",
    ]);
    expect(contracts).toHaveLength(1);
  });

  it("matches a market only when the category candidate is unique", () => {
    const contract = {
      categoryId: "best-picture",
      candidateLabel: "The Odyssey",
    };
    const candidate = {
      id: "candidate-odyssey",
      categoryId: "best-picture",
      label: "The Odyssey",
      filmTitle: "The Odyssey",
      peopleNames: [],
    };
    expect(matchMarketCandidate(contract, [candidate])).toBe(
      "candidate-odyssey",
    );
    expect(
      matchMarketCandidate(contract, [
        candidate,
        { ...candidate, id: "duplicate" },
      ]),
    ).toBeNull();
  });

  it("creates an idempotency hash from the append-only capture", async () => {
    const contracts = parseKalshiMarkets(await fixture("kalshi.json"), {
      capturedAt,
      seasonId: "oscars-2027",
      ceremonyYear: 2027,
    });
    const first = await prepareMarketContracts(contracts, []);
    const second = await prepareMarketContracts(contracts, []);
    expect(first[0].contentHash).toBe(second[0].contentHash);
    expect(first[0]).not.toHaveProperty("dataType");
    expect(first[0]).not.toHaveProperty("participates");
  });
});
