const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function retryDelay(response, attempt, baseDelayMs) {
  const retryAfter = Number(response?.headers?.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }
  return baseDelayMs * 2 ** attempt;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function timedFetch(url, init, fetcher, timeoutMs) {
  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(
        new Error(
          `Tiempo agotado al consultar ${new URL(url).host} tras ${timeoutMs} ms`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetcher(url, { ...init, signal: controller.signal }),
      timeout,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchResponse(
  url,
  init,
  fetcher,
  {
    attempts = 2,
    baseDelayMs = 250,
    retryableStatusCodes = RETRYABLE_STATUS_CODES,
    timeoutMs = 15_000,
  } = {},
) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response;
    try {
      response = await timedFetch(url, init, fetcher, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1) break;
      await wait(baseDelayMs * 2 ** attempt);
      continue;
    }
    if (response.ok) return response;
    if (retryableStatusCodes.has(response.status) && attempt < attempts - 1) {
      await wait(retryDelay(response, attempt, baseDelayMs));
      continue;
    }
    throw new Error(
      `HTTP ${response.status} al consultar ${new URL(url).host}`,
    );
  }
  throw lastError ?? new Error(`No se pudo consultar ${new URL(url).host}`);
}
