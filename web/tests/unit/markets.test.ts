import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
    });
    expect(contracts).toHaveLength(1);
    expect(contracts[0]).toMatchObject({
      provider: "polymarket",
      categoryId: "best-picture",
      externalContractId: "yes-token",
      candidateLabel: "The Odyssey",
      probability: 0.41,
    });
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
    });
    const first = await prepareMarketContracts(contracts, []);
    const second = await prepareMarketContracts(contracts, []);
    expect(first[0].contentHash).toBe(second[0].contentHash);
    expect(first[0]).not.toHaveProperty("dataType");
    expect(first[0]).not.toHaveProperty("participates");
  });
});
