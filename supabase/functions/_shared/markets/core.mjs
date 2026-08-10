function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta ${field}`);
  }
  return value.trim();
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

const CATEGORY_PATTERNS = Object.freeze([
  ["supporting-actress", /supporting actress|actress in a supporting role/i],
  ["supporting-actor", /supporting actor|actor in a supporting role/i],
  ["adapted-screenplay", /adapted screenplay/i],
  ["original-screenplay", /original screenplay/i],
  ["best-picture", /best picture/i],
  ["directing", /best director|directing/i],
  ["actress", /best actress|actress in a leading role/i],
  ["actor", /best actor|actor in a leading role/i],
]);

export function categoryFromMarketText(value) {
  return (
    CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(value))?.[0] ?? null
  );
}

function numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function kalshiPriceData(market) {
  return {
    ticker: market.ticker,
    last_price_dollars: market.last_price_dollars ?? null,
    yes_bid_dollars: market.yes_bid_dollars ?? null,
    last_price: market.last_price ?? null,
    volume_fp: market.volume_fp ?? null,
    volume: market.volume ?? null,
    open_interest_fp: market.open_interest_fp ?? null,
    open_interest: market.open_interest ?? null,
    ts: market.ts ?? null,
  };
}

function polymarketContractData(event, market) {
  const { markets: _markets, ...eventData } = event;
  return { event: eventData, market };
}

function polymarketPriceData(market, selectedIndex) {
  return {
    market_id: market.id,
    selected_index: selectedIndex,
    outcomes: market.outcomes ?? null,
    outcome_prices: market.outcomePrices ?? null,
    volume_num: market.volumeNum ?? null,
    volume: market.volume ?? null,
    open_interest: market.openInterest ?? null,
    updated_at: market.updatedAt ?? null,
  };
}

function isOscarMarket(value) {
  return /\boscars?\b|academy awards/i.test(value);
}

function isOpenAt(value, capturedAt) {
  const closesAt = isoOrNull(value);
  return !closesAt || Date.parse(closesAt) > Date.parse(capturedAt);
}

function matchesCeremonyYear(value, ceremonyYear) {
  if (!ceremonyYear) return true;
  const year = String(ceremonyYear);
  const shortYear = year.slice(-2);
  return (
    new RegExp(`\\b${year}\\b`).test(value) ||
    new RegExp(`-${shortYear}(?:-|\\b)`).test(value)
  );
}

export function parseKalshiMarkets(
  payload,
  { capturedAt, seasonId, ceremonyYear },
) {
  if (!payload || !Array.isArray(payload.markets)) {
    throw new Error("Kalshi devolvió una respuesta inválida");
  }
  return payload.markets
    .filter((market) => {
      const identity = [
        market.title,
        market.subtitle,
        market.event_ticker,
        market.ticker,
      ]
        .filter(Boolean)
        .join(" ");
      return (
        isOscarMarket(identity) &&
        matchesCeremonyYear(identity, ceremonyYear) &&
        market.status !== "closed" &&
        market.status !== "settled" &&
        !market.settlement_ts &&
        isOpenAt(market.close_time, capturedAt)
      );
    })
    .map((market) => {
      const ticker = requiredText(market.ticker, "Kalshi ticker");
      const title = requiredText(
        market.title ?? market.subtitle,
        "Kalshi title",
      );
      const probability =
        numeric(market.last_price_dollars) ??
        numeric(market.yes_bid_dollars) ??
        (numeric(market.last_price) === null
          ? null
          : numeric(market.last_price) / 100);
      return {
        provider: "kalshi",
        sourceId: "kalshi",
        externalMarketId: requiredText(
          market.event_ticker ?? ticker,
          "Kalshi event ticker",
        ),
        externalContractId: ticker,
        seasonId,
        categoryId: categoryFromMarketText(`${title} ${market.subtitle ?? ""}`),
        candidateLabel:
          market.yes_sub_title ??
          market.subtitle ??
          market.custom_strike?.Candidate ??
          "Yes",
        marketTitle: title,
        outcomeLabel: market.yes_sub_title ?? market.subtitle ?? market.ticker,
        sourceUrl: `https://kalshi.com/markets/${ticker.toLowerCase()}`,
        closesAt: isoOrNull(market.close_time),
        resolvedAt: isoOrNull(market.settlement_ts),
        probability,
        originalPrice:
          numeric(market.last_price_dollars) ?? numeric(market.last_price),
        originalCurrency: "USD",
        volume: numeric(market.volume_fp) ?? numeric(market.volume),
        openInterest:
          numeric(market.open_interest_fp) ?? numeric(market.open_interest),
        observedAt: isoOrNull(market.ts) ?? new Date(capturedAt).toISOString(),
        capturedAt: new Date(capturedAt).toISOString(),
        contractOriginalData: market,
        priceOriginalData: kalshiPriceData(market),
      };
    })
    .filter((contract) => contract.categoryId !== null);
}

function jsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parsePolymarketEvents(
  payload,
  { capturedAt, seasonId, ceremonyYear },
) {
  const events = Array.isArray(payload) ? payload : payload?.events;
  if (!Array.isArray(events)) {
    throw new Error("Polymarket devolvió una respuesta inválida");
  }
  const contracts = [];
  for (const event of events) {
    const eventIdentity = `${event.title ?? ""} ${event.slug ?? ""}`;
    if (
      !isOscarMarket(eventIdentity) ||
      !matchesCeremonyYear(eventIdentity, ceremonyYear) ||
      event.active === false ||
      event.closed === true ||
      !isOpenAt(event.endDate, capturedAt)
    ) {
      continue;
    }
    for (const market of event.markets ?? []) {
      if (
        market.active === false ||
        market.closed === true ||
        !isOpenAt(market.endDate ?? event.endDate, capturedAt)
      ) {
        continue;
      }
      const marketId = requiredText(String(market.id), "Polymarket market id");
      const outcomes = jsonArray(market.outcomes);
      const prices = jsonArray(market.outcomePrices);
      const tokenIds = jsonArray(market.clobTokenIds);
      const yesIndex = outcomes.findIndex(
        (outcome) => String(outcome).toLocaleLowerCase("en") === "yes",
      );
      const selectedIndex = yesIndex >= 0 ? yesIndex : 0;
      const title = requiredText(
        market.question ?? event.title,
        "Polymarket question",
      );
      const candidateLabel =
        market.groupItemTitle ??
        title
          .replace(/^will\s+/i, "")
          .replace(
            /\s+(?:win|be nominated for)\s+(?:the\s+)?(?:oscar for\s+)?best[\s\S]*$/i,
            "",
          );
      const categoryId = categoryFromMarketText(`${event.title} ${title}`);
      if (!categoryId) continue;
      contracts.push({
        provider: "polymarket",
        sourceId: "polymarket",
        externalMarketId: requiredText(String(event.id), "Polymarket event id"),
        externalContractId: String(tokenIds[selectedIndex] ?? marketId),
        seasonId,
        categoryId,
        candidateLabel,
        marketTitle: title,
        outcomeLabel: candidateLabel,
        sourceUrl: `https://polymarket.com/event/${event.slug}`,
        closesAt: isoOrNull(market.endDate ?? event.endDate),
        resolvedAt:
          market.closed === true
            ? isoOrNull(market.closedTime ?? market.updatedAt)
            : null,
        probability: numeric(prices[selectedIndex]),
        originalPrice: numeric(prices[selectedIndex]),
        originalCurrency: "USDC",
        volume: numeric(market.volumeNum ?? market.volume),
        openInterest: numeric(market.openInterest),
        observedAt:
          isoOrNull(market.updatedAt) ?? new Date(capturedAt).toISOString(),
        capturedAt: new Date(capturedAt).toISOString(),
        contractOriginalData: polymarketContractData(event, market),
        priceOriginalData: polymarketPriceData(market, selectedIndex),
      });
    }
  }
  return contracts;
}

export function matchMarketCandidate(contract, candidates) {
  if (!contract.categoryId || !contract.candidateLabel) return null;
  const normalized = normalizeIdentity(contract.candidateLabel);
  const matches = candidates.filter((candidate) => {
    if (candidate.categoryId !== contract.categoryId) return false;
    return [candidate.label, candidate.filmTitle, ...candidate.peopleNames]
      .filter(Boolean)
      .some((label) => normalizeIdentity(label) === normalized);
  });
  return matches.length === 1 ? matches[0].id : null;
}

export async function prepareMarketContracts(contracts, candidates) {
  return Promise.all(
    contracts.map(async (contract) => {
      const categoryCandidateId = matchMarketCandidate(contract, candidates);
      const contentHash = await sha256({
        external_contract_id: contract.externalContractId,
        probability: contract.probability,
        original_price: contract.originalPrice,
        original_currency: contract.originalCurrency,
        volume: contract.volume,
        open_interest: contract.openInterest,
      });
      return { ...contract, categoryCandidateId, contentHash };
    }),
  );
}
