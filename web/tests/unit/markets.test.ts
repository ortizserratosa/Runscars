import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MARKET_CONNECTORS } from "../../../supabase/functions/_shared/markets/connectors.mjs";
import { runMarketConnectors } from "../../../supabase/functions/_shared/markets/repository.mjs";
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
    expect(contracts[0].contractOriginalData.ticker).toBe(
      "KXOSCARPIC-27-ODYSSEY",
    );
    expect(contracts[0].priceOriginalData).toMatchObject({
      ticker: "KXOSCARPIC-27-ODYSSEY",
      last_price_dollars: "0.42",
    });
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
    expect(contracts[0].contractOriginalData.event).not.toHaveProperty(
      "markets",
    );
    expect(contracts[0].priceOriginalData).toMatchObject({
      market_id: "market-odyssey",
      selected_index: 0,
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

  it("rejects Oscar contracts outside the eight public categories", async () => {
    const kalshi = await fixture("kalshi.json");
    const unknownCategory = {
      ...kalshi.markets[0],
      title: "Will The Odyssey win Best Cinematography at the Oscars 2027?",
      subtitle: "Best Cinematography",
    };
    expect(
      parseKalshiMarkets(
        { markets: [unknownCategory] },
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

  it("hashes the effective price state instead of the capture time", async () => {
    const payload = await fixture("kalshi.json");
    const contracts = parseKalshiMarkets(payload, {
      capturedAt,
      seasonId: "oscars-2027",
      ceremonyYear: 2027,
    });
    const laterContracts = parseKalshiMarkets(payload, {
      capturedAt: "2026-07-25T13:00:00Z",
      seasonId: "oscars-2027",
      ceremonyYear: 2027,
    });
    const changedContracts = parseKalshiMarkets(
      {
        markets: [
          {
            ...payload.markets[0],
            last_price_dollars: "0.43",
          },
        ],
      },
      {
        capturedAt: "2026-07-25T13:00:00Z",
        seasonId: "oscars-2027",
        ceremonyYear: 2027,
      },
    );
    const first = await prepareMarketContracts(contracts, []);
    const second = await prepareMarketContracts(laterContracts, []);
    const changed = await prepareMarketContracts(changedContracts, []);
    expect(first[0].contentHash).toBe(second[0].contentHash);
    expect(changed[0].contentHash).not.toBe(first[0].contentHash);
    expect(first[0]).not.toHaveProperty("dataType");
    expect(first[0]).not.toHaveProperty("participates");
  });

  it("runs providers in parallel and recovers their abandoned attempts", async () => {
    let resolveSecondStarted: () => void = () => {};
    const secondStarted = new Promise<void>((resolve) => {
      resolveSecondStarted = resolve;
    });
    const recovered: string[] = [];
    let nextRunId = 1;
    const repository = {
      async failStaleRuns({ connectorId }: { connectorId: string }) {
        recovered.push(connectorId);
        return 1;
      },
      async beginRun() {
        return { id: nextRunId++, status: "running", repeated: false };
      },
      async candidates() {
        return [];
      },
      async finishRun() {},
      async markConnector() {},
    };
    const run = runMarketConnectors({
      connectors: [
        {
          id: "first",
          extractor_version: "first-v1",
          configuration: { season_id: "oscars-2027" },
        },
        {
          id: "second",
          extractor_version: "second-v1",
          configuration: { season_id: "oscars-2027" },
        },
      ],
      registry: {
        first: async () => {
          await secondStarted;
          return [];
        },
        second: async () => {
          resolveSecondStarted();
          return [];
        },
      },
      repository,
      now: () => new Date(capturedAt),
    });

    await expect(
      Promise.race([
        run,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("sequential timeout")), 100),
        ),
      ]),
    ).resolves.toEqual([
      expect.objectContaining({ connectorId: "first", status: "succeeded" }),
      expect.objectContaining({ connectorId: "second", status: "succeeded" }),
    ]);
    expect(recovered).toEqual(["first", "second"]);
  });
});
