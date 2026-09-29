import { describe, expect, it, vi } from "vitest";
import { expandCatalogFromBatch } from "../../../supabase/functions/_shared/ingestion/tmdb-expansion.mjs";

type Credit = {
  id: number;
  name: string;
  credit_id: string;
  job?: string;
  department?: string;
  character?: string;
  order?: number;
};
const director = (name = "Luca Guadagnino"): Credit => ({
  id: 10,
  name,
  credit_id: "director",
  job: "Director",
  department: "Directing",
});
const actor = (name = "Andrew Garfield"): Credit => ({
  id: 20,
  name,
  credit_id: "actor",
  character: "Sam",
  order: 0,
});
const movie = (crew: Credit[] = [director()], cast: Credit[] = [actor()]) => ({
  id: 1492198,
  title: "Artificial",
  original_title: "Artificial",
  release_date: "2026-10-01",
  credits: { crew, cast },
});
type Prediction = {
  dataType: string;
  filmSubject: string;
  categoryId: string;
  peopleSubjects: string[];
};
const prediction = (
  categoryId: string,
  peopleSubjects: string[] = [],
  filmSubject = "Artificial",
): Prediction => ({
  dataType: "prediction_ordered",
  categoryId,
  peopleSubjects,
  filmSubject,
});

async function expand(
  observations: Prediction[],
  raw = movie(),
  options: { matches?: number[]; existing?: boolean } = {},
) {
  const save = vi.fn(async () => "artificial");
  const requests: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url.pathname);
    const payload = url.pathname.endsWith("/search/movie")
      ? { results: (options.matches ?? [raw.id]).map((id) => ({ ...raw, id })) }
      : raw;
    return new Response(JSON.stringify(payload));
  };
  const result = await expandCatalogFromBatch({
    batch: { seasonId: "oscars-2027", publications: [{ observations }] },
    repository: {
      seasonIdentity: async () => ({ eligibilityYear: 2026 }),
      filmIdentities: async () =>
        options.existing ? [{ id: "artificial", title: "Artificial" }] : [],
      saveAutomaticTmdbFilm: save,
    },
    token: "reproducible-test-token",
    fetcher,
  });
  return { result, save, requests };
}

describe("automatic TMDB identity corroboration", () => {
  it("rejects a same-title same-year film whose credited people contradict the predictions", async () => {
    const raw = {
      ...movie([director("Tyler Woods")], [actor("Mark Chapman")]),
      id: 1586108,
    };
    const { result, save } = await expand(
      [
        prediction("best-picture"),
        prediction("directing", ["Luca Guadagnino"]),
        prediction("actor", ["Andrew Garfield"]),
      ],
      raw,
    );
    expect(save).not.toHaveBeenCalled();
    expect(result.imported).toEqual([]);
    expect(result.ambiguous).toEqual([
      expect.objectContaining({
        title: "Artificial",
        tmdbIds: [1586108],
        reason: "prediction_credits_not_corroborated",
      }),
    ]);
  });

  it("leaves a unique title/year without personal evidence for editorial review", async () => {
    const { result, save, requests } = await expand([
      prediction("best-picture"),
    ]);
    expect(save).not.toHaveBeenCalled();
    expect(result.ambiguous[0]).toMatchObject({
      reason: "missing_person_identity_evidence",
    });
    expect(requests).toEqual([]);
  });

  it("corroborates all normalized film claims with the correct cast and director roles", async () => {
    const { result, save } = await expand([
      prediction("best-picture"),
      prediction("directing", ["Luca Guadagnino"], "ARTIFICIAL"),
      prediction("actor", ["Andrew Garfield"]),
      prediction("original-screenplay", ["Unverified Writer"]),
    ]);
    expect(result.imported).toEqual([
      { title: "Artificial", filmId: "artificial", tmdbId: 1492198 },
    ]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: expect.objectContaining({
          original_data: expect.objectContaining({
            automatic_match: expect.objectContaining({
              match_rule: "unique-title-year-and-credits-v1",
              people_evidence: [
                {
                  source_name: "Luca Guadagnino",
                  category_id: "directing",
                  tmdb_person_id: 10,
                  role: "Director",
                },
                {
                  source_name: "Andrew Garfield",
                  category_id: "actor",
                  tmdb_person_id: 20,
                  role: "Acting",
                },
              ],
            }),
          }),
        }),
      }),
    );
  });

  it("does not accept a cast prediction matched only to a crew credit", async () => {
    const { save } = await expand(
      [prediction("actor", ["Andrew Garfield"])],
      movie([{ ...director("Andrew Garfield"), job: "Writer" }], []),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("does not let one corroborated person hide another conflicting explicit claim", async () => {
    const { save } = await expand([
      prediction("directing", ["Luca Guadagnino"]),
      prediction("actress", ["Yura Borisov"]),
    ]);
    expect(save).not.toHaveBeenCalled();
  });

  it("requires a unique credited person for each name", async () => {
    const { save } = await expand(
      [prediction("actor", ["Andrew Garfield"])],
      movie([], [actor(), { ...actor(), id: 21, credit_id: "homonym" }]),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("retains ambiguous search matches for review without choosing by people", async () => {
    const { result, save, requests } = await expand(
      [prediction("directing", ["Luca Guadagnino"])],
      movie(),
      { matches: [1492198, 1586108] },
    );
    expect(save).not.toHaveBeenCalled();
    expect(requests).toEqual(["/3/search/movie"]);
    expect(result.ambiguous[0]).toMatchObject({ tmdbIds: [1492198, 1586108] });
  });

  it("preserves an existing editorial film identity without a new automatic import", async () => {
    const { result, save, requests } = await expand(
      [prediction("best-picture")],
      movie(),
      { existing: true },
    );
    expect(result).toEqual({ imported: [], ambiguous: [] });
    expect(save).not.toHaveBeenCalled();
    expect(requests).toEqual([]);
  });
  it("aborts and bounds hung TMDB requests while preserving unresolved titles for editorial review", async () => {
    vi.useFakeTimers();
    try {
      const signals: AbortSignal[] = [];
      const save = vi.fn();
      const fetcher: typeof fetch = (_input, init) => {
        signals.push(init!.signal!);
        return new Promise(() => {});
      };
      const pending = expandCatalogFromBatch({
        batch: {
          seasonId: "oscars-2027",
          publications: [
            {
              observations: [
                prediction("directing", ["Luca Guadagnino"], "Artificial"),
                prediction("directing", ["Danny Boyle"], "Ink"),
                prediction("directing", ["Christopher Nolan"], "The Odyssey"),
              ],
            },
          ],
        },
        repository: {
          seasonIdentity: async () => ({ eligibilityYear: 2026 }),
          filmIdentities: async () => [],
          saveAutomaticTmdbFilm: save,
        },
        token: "offline-test-token",
        fetcher,
      });
      await vi.advanceTimersByTimeAsync(61_000);
      const result = await pending;
      expect(save).not.toHaveBeenCalled();
      expect(signals).toHaveLength(4);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
      expect(result.ambiguous).toHaveLength(3);
      expect(result.ambiguous.at(-1)?.error).toMatch(
        /presupuesto de expansión/,
      );
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it("does not wait beyond its retry budget or retry early when TMDB requests a long rate-limit delay", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn<typeof fetch>(
        async () =>
          new Response("", { status: 429, headers: { "Retry-After": "3600" } }),
      );
      const save = vi.fn();
      const result = await expandCatalogFromBatch({
        batch: {
          seasonId: "oscars-2027",
          publications: [
            { observations: [prediction("directing", ["Luca Guadagnino"])] },
          ],
        },
        repository: {
          seasonIdentity: async () => ({ eligibilityYear: 2026 }),
          filmIdentities: async () => [],
          saveAutomaticTmdbFilm: save,
        },
        token: "offline-test-token",
        fetcher,
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(save).not.toHaveBeenCalled();
      expect(result.imported).toEqual([]);
      expect(result.ambiguous[0].error).toMatch(
        /espera de reintento excede el presupuesto/,
      );
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
