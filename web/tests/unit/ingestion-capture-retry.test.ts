import { describe, expect, it } from "vitest";
import { SupabaseIngestionRepository } from "../../../supabase/functions/_shared/ingestion/repository.mjs";

type Row = Record<string, unknown>;
const captureId = 42;
const originalValue = { rank: 1, list_length: 1, raw: "The Odyssey" };
const row = (
  id: number,
  sourceCaptureId: number,
  state = "published",
): Row => ({
  id,
  capture_id: sourceCaptureId,
  source_id: "ankler",
  publication_id: 7,
  original_subject: "The Odyssey",
  category_id: "best-picture",
  prediction_intention: "nomination",
  data_type: "prediction_ordered",
  original_value: originalValue,
  state,
});

function fixture(rows: Row[], members: number[] | null) {
  const tables: Record<string, Row[]> = {
    professional_observations: rows,
    source_capture_completions: members
      ? [{ capture_id: captureId, expected_observation_count: members.length }]
      : [],
    source_capture_observations: (members ?? []).map((id) => ({
      capture_id: captureId,
      observation_id: id,
      professional_observations: {
        state: rows.find((candidate) => candidate.id === id)?.state,
      },
    })),
    category_candidate_match_history: [],
    ingestion_review_items: [],
  };
  const writes: Array<{ table: string; ids: unknown[]; values: Row }> = [];
  const orders: string[] = [];
  const calls: Array<{ name: string; parameters: Row }> = [];
  const client = {
    from(table: string) {
      const filters: Array<(candidate: Row) => boolean> = [];
      let ordering: string | null = null;
      let from = 0;
      let to = Infinity;
      let single = false;
      let update: Row | null = null;
      let insert: Row | null = null;
      const query = {
        select: () => query,
        eq(column: string, value: unknown) {
          filters.push((candidate) => candidate[column] === value);
          return query;
        },
        is(column: string, value: unknown) {
          filters.push((candidate) => candidate[column] === value);
          return query;
        },
        contains: () => query,
        order(column: string) {
          ordering = column;
          orders.push(`${table}.${column}`);
          return query;
        },
        range(start: number, end: number) {
          from = start;
          to = end;
          return query;
        },
        maybeSingle() {
          single = true;
          return query;
        },
        update(values: Row) {
          update = values;
          return query;
        },
        upsert(values: Row) {
          if (table === "professional_observations")
            throw new Error("An equivalent observation must be reused");
          insert = values;
          return query;
        },
        then(resolve: (value: unknown) => unknown) {
          let selected = tables[table].filter((candidate) =>
            filters.every((filter) => filter(candidate)),
          );
          if (ordering)
            selected = [...selected].sort(
              (left, right) =>
                Number(left[ordering!]) - Number(right[ordering!]),
            );
          selected = selected.slice(from, to + 1);
          if (update) {
            writes.push({
              table,
              ids: selected.map((candidate) => candidate.id),
              values: update,
            });
            selected.forEach((candidate) => Object.assign(candidate, update));
          }
          if (insert) tables[table].push(insert);
          return Promise.resolve(
            resolve({
              data: single ? (selected[0] ?? null) : selected,
              error: null,
            }),
          );
        },
      };
      return query;
    },
    async rpc(name: string, parameters: Row) {
      calls.push({ name, parameters });
      return { data: false, error: null };
    },
  };
  const repository = new SupabaseIngestionRepository({
    supabaseUrl: "https://fixture.supabase.co",
    serviceRoleKey: "offline-fixture-key",
  });
  repository.client = client as unknown as typeof repository.client;
  const save = () =>
    repository.saveObservation({
      batch: {
        sourceId: "ankler",
        connectorId: "ankler-predictions",
        seasonId: "oscars-2027",
      },
      publication: {},
      publicationId: 7,
      captureId,
      runId: 9,
      observation: {
        subject: "The Odyssey",
        dataType: "prediction_ordered",
        categoryId: "best-picture",
        predictionIntention: "nomination",
        originalValue,
        categoryCandidateId: "candidate-the-odyssey",
        peopleSubjects: [],
        filmId: "the-odyssey",
        personId: null,
        state: "published",
        participates: true,
      },
    });
  return { repository, save, tables, writes, calls, orders };
}

describe("certified source capture retries", () => {
  it("preserves a certified member from an older capture ahead of earlier external or current-capture equivalents", async () => {
    const { repository, save, tables, writes, calls } = fixture(
      [
        row(10, 1, "excluded"),
        row(70, captureId),
        row(90, 2, "pending_review"),
      ],
      [90],
    );
    expect(await repository.captureIsComplete(captureId, 1)).toBe(false);
    expect(await save()).toEqual({
      id: 90,
      inserted: false,
      state: "published",
    });
    expect(
      tables.professional_observations.find((candidate) => candidate.id === 10)
        ?.state,
    ).toBe("excluded");
    expect(
      writes.filter((write) => write.table === "professional_observations"),
    ).toEqual([
      expect.objectContaining({
        ids: [90],
        values: expect.objectContaining({ state: "published" }),
      }),
    ]);
    await repository.finalizeCapture(captureId, [90]);
    expect(calls).toEqual([
      {
        name: "finalize_source_capture",
        parameters: expect.objectContaining({
          p_capture_id: captureId,
          p_expected_observation_count: 1,
          p_observation_ids: [90],
        }),
      },
    ]);
  });

  it("prefers an existing row from the interrupted capture before an earlier equivalent from another capture", async () => {
    const { repository, save } = fixture(
      [row(10, 1), row(70, captureId)],
      null,
    );
    expect(await repository.captureIsComplete(captureId, 1)).toBe(false);
    expect(await save()).toEqual({
      id: 70,
      inserted: false,
      state: "published",
    });
  });

  it("chooses the earliest equivalent deterministically when no member or current-capture row exists", async () => {
    const { save, orders, writes } = fixture([row(90, 2), row(10, 1)], null);
    expect(await save()).toEqual({
      id: 10,
      inserted: false,
      state: "published",
    });
    expect(orders).toContain("professional_observations.id");
    expect(writes).toEqual([]);
  });
});
