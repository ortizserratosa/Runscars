import { expect, it } from "vitest";
import { SupabaseFestivalExternalLinksRepository } from "../../../supabase/functions/_shared/festivals/external-links-repository.mjs";

it("loads more than 1000 current feature facts with stable paginated entry IDs", async () => {
  const entries = Array.from({ length: 1061 }, (_, index) => ({
    id: index + 1,
    set_id: "current",
    original_title: `Film ${index + 1}`,
    original_recipient: "A Director",
    original_data: {},
  }));
  const ranges: number[][] = [];
  const rows: Record<string, unknown[]> = {
    current_festival_sets: [
      { set_id: "current", edition_id: "sundance-2026", kind: "selection" },
    ],
    festival_sets: [
      {
        id: "current",
        source_url: "https://official.example/programme",
        captured_at: "2026-10-07T08:00:00Z",
      },
    ],
    festival_entries: entries,
  };
  const client = {
    from(table: string) {
      let from = 0;
      let to = 999; // Same default cap as the public PostgREST API.
      const query = {
        select() {
          return query;
        },
        order() {
          return query;
        },
        eq() {
          return query;
        },
        in() {
          return query;
        },
        range(start: number, end: number) {
          from = start;
          to = end;
          if (table === "festival_entries") ranges.push([start, end]);
          return query;
        },
        then(resolve: (result: { data: unknown[]; error: null }) => unknown) {
          return Promise.resolve(
            resolve({
              data: (rows[table] ?? []).slice(from, to + 1),
              error: null,
            }),
          );
        },
      };
      return query;
    },
  };
  const repository = new SupabaseFestivalExternalLinksRepository({
    client,
    supabaseUrl: "test-only",
    serviceRoleKey: "test-only",
  });
  const result = await repository.currentEntries();
  expect(result).toHaveLength(1061);
  expect(result.at(-1)).toMatchObject({
    entryId: 1061,
    originalTitle: "Film 1061",
    originalSourceUrl: "https://official.example/programme",
  });
  expect(ranges).toEqual([
    [0, 499],
    [500, 999],
    [1000, 1499],
  ]);
  expect(await repository.currentEntries()).toBe(result);
});
