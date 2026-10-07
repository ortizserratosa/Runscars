import { describe, expect, it, vi } from "vitest";
import { buildMovieSnapshot } from "../../src/lib/tmdb/catalog.mjs";
import {
  prepareFestivalMovieMetadata,
  refreshFestivalMovieMetadata,
} from "../../../supabase/functions/_shared/festivals/metadata.mjs";

const rawMovie = (id: number) => ({
  id,
  title: `Film ${id}`,
  original_title: `Original ${id}`,
  release_date: "2026-01-22",
  runtime: 103,
  poster_path: "/aRealPoster.jpg",
  credits: {
    crew: [
      {
        id: 10,
        name: "A Director",
        job: "Director",
        credit_id: "director-credit",
      },
    ],
  },
});

describe("metadata for corroborated festival identities outside Oscar catalogue", () => {
  it("retains provenance, locale, stable content hash and every director without inserting people", async () => {
    const crew = Array.from({ length: 35 }, (_, id) => ({
      id: id + 1,
      name: `Writer ${id}`,
      job: "Writer",
      credit_id: `writer-${id}`,
    }));
    crew.push({
      id: 100,
      name: "A Director",
      job: "Director",
      credit_id: "director-credit",
    });
    const capture = await prepareFestivalMovieMetadata(
      { ...rawMovie(11), credits: { crew } },
      "es-ES",
      "2026-10-07T08:00:00Z",
      buildMovieSnapshot,
    );
    const repeated = await prepareFestivalMovieMetadata(
      { ...rawMovie(11), credits: { crew } },
      "es-ES",
      "2026-10-08T08:00:00Z",
      buildMovieSnapshot,
    );
    expect(capture.snapshot.content_hash).toBe(repeated.snapshot.content_hash);
    expect(capture.snapshot).toMatchObject({
      tmdb_id: 11,
      locale: "es-ES",
      source_url: "https://api.themoviedb.org/3/movie/11",
      fetched_at: "2026-10-07T08:00:00.000Z",
      original_data: { directors: [{ id: 100, name: "A Director" }] },
    });
    expect(
      Date.parse(capture.snapshot.expires_at) -
        Date.parse(capture.snapshot.fetched_at),
    ).toBe(180 * 86400000);
    expect(Object.keys(capture)).toEqual(["identity", "snapshot"]);
  });

  it("plans unique ID metadata with a deterministic cursor without provider calls or writes", async () => {
    const fetchMovie = vi.fn();
    const saveMetadata = vi.fn();
    const report = await refreshFestivalMovieMetadata({
      repository: { confirmedMovieIds: async () => [11, 20, 30], saveMetadata },
      client: { fetchMovie },
      buildSnapshot: buildMovieSnapshot,
      afterTmdbId: 11,
      limit: 1,
    });
    expect(report).toMatchObject({
      apply: false,
      processed: 1,
      nextTmdbId: 20,
      hasMore: true,
      results: [
        {
          tmdbId: 20,
          captures: [
            { locale: "es-ES", status: "planned" },
            { locale: "en-US", status: "planned" },
          ],
        },
      ],
    });
    expect(fetchMovie).not.toHaveBeenCalled();
    expect(saveMetadata).not.toHaveBeenCalled();
  });

  it("bounds workers, preserves other movies/locales on failure and rejects another provider ID", async () => {
    let active = 0;
    let maximumActive = 0;
    const fetchMovie = vi.fn(async (id: number, locale: string) => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      if (id === 11 && locale === "es-ES") throw new Error("provider failed");
      return rawMovie(id === 30 ? 31 : id);
    });
    const saveMetadata = vi.fn(async () => ({ status: "inserted" }));
    const report = await refreshFestivalMovieMetadata({
      repository: { confirmedMovieIds: async () => [11, 20, 30], saveMetadata },
      client: { fetchMovie },
      buildSnapshot: buildMovieSnapshot,
      apply: true,
      concurrency: 2,
    });
    expect(maximumActive).toBe(2);
    expect(report).toMatchObject({ processed: 3, failed: 3 });
    expect(report.results[0].captures[1].status).toBe("inserted");
    expect(
      report.results[1].captures.every(
        (capture: { status: string }) => capture.status === "inserted",
      ),
    ).toBe(true);
    expect(saveMetadata).toHaveBeenCalledTimes(3);
  });
});
