import { describe, expect, it } from "vitest";
import {
  categoryEvidenceFreshness,
  type CategoryEvidenceCapture,
} from "../../src/lib/snapshots/category-evidence-freshness";

function row(
  subject: string,
  rank: number | null,
  film = subject,
  people: string[] = [],
) {
  return {
    rank,
    raw: `${subject} | unchanged secondary credits`,
    parts: {
      subject,
      filmSubject: film,
      peopleSubjects: people,
      workTitle: null,
    },
  };
}

function capture(
  id: string,
  capturedAt: string,
  categories: Record<string, unknown>,
): CategoryEvidenceCapture {
  return {
    id,
    sourceId: "next-best-picture",
    publicationUrl: "https://nextbestpicture.com/oscar-predictions/",
    capturedAt,
    originalData: {
      source_id: "next-best-picture",
      publication_date: null,
      categories,
    },
  };
}

const first = "2026-08-01T04:17:00Z";
const second = "2026-09-01T04:17:00Z";
const third = "2026-09-29T04:17:00Z";

describe("unchanged undated category evidence", () => {
  it("does not rejuvenate Picture after an NBP cinematography CMS credit edit", () => {
    const picture = [row("Dune: Part Three", 1), row("The Odyssey", 2)];
    const before = capture("1", first, {
      "best-picture": picture,
      cinematography: [
        row("Dune: Part Three", 1, "Dune: Part Three", ["Greig Fraser"]),
      ],
    });
    const after = capture("2", third, {
      "best-picture": picture,
      cinematography: [
        row("Dune: Part Three", 1, "Dune: Part Three", [
          "Greig Fraser",
          "Person Two",
          "Person Three",
        ]),
      ],
    });
    const originals = structuredClone([before, after]);
    expect(categoryEvidenceFreshness([after, before], "best-picture")).toEqual(
      new Map([
        ["1", first],
        ["2", first],
      ]),
    );
    expect([before, after]).toEqual(originals);
  });

  it("ignores screenplay secondary credit edits but tracks personal nominees on the same film", () => {
    const before = capture("1", first, {
      "original-screenplay": [row("Wild Horse Nine", 1)],
      actor: [
        row("John Malkovich — Wild Horse Nine", 1, "Wild Horse Nine", [
          "John Malkovich",
        ]),
      ],
      directing: [
        row(
          "Javier Ambrossi, Javier Calvo — La bola negra",
          1,
          "La bola negra",
          ["Javier Ambrossi", "Javier Calvo"],
        ),
      ],
    });
    const after = capture("2", second, {
      "original-screenplay": [
        {
          ...row("Wild Horse Nine", 1),
          raw: "Wild Horse Nine | Revised writer | Searchlight",
        },
      ],
      actor: [
        row("Sam Rockwell — Wild Horse Nine", 1, "Wild Horse Nine", [
          "Sam Rockwell",
        ]),
      ],
      directing: [
        row("Javier Calvo — La bola negra", 1, "La bola negra", [
          "Javier Calvo",
        ]),
      ],
    });
    expect(
      categoryEvidenceFreshness([before, after], "original-screenplay").get(
        "2",
      ),
    ).toBe(first);
    for (const category of ["actor", "directing"]) {
      expect(
        categoryEvidenceFreshness([before, after], category).get("2"),
      ).toBe(second);
    }
  });

  it("resets at actual list changes, including a captured A to B to A return", () => {
    const a = [row("A", 1), row("B", 2)];
    const b = [row("B", 1), row("A", 2)];
    const captures = [
      capture("1", first, { actor: a }),
      capture("2", second, { actor: b }),
      capture("3", third, { actor: a }),
    ];
    // Film categories do not require personal identity evidence.
    captures.forEach((item) => {
      const data = item.originalData as { categories: Record<string, unknown> };
      data.categories["best-picture"] = data.categories.actor;
    });
    expect(categoryEvidenceFreshness(captures, "best-picture")).toEqual(
      new Map([
        ["1", first],
        ["2", second],
        ["3", third],
      ]),
    );
    const longer = capture("4", "2026-09-30T04:17:00Z", {
      "best-picture": [...a, row("C", 3)],
    });
    expect(
      categoryEvidenceFreshness([...captures, longer], "best-picture").get("4"),
    ).toBe(longer.capturedAt);
  });

  it("does not treat the display order of an unranked selection as a new prediction", () => {
    const a = capture("1", first, {
      "best-picture": [row("A", null), row("B", null)],
    });
    const b = capture("2", second, {
      "best-picture": [row("B", null), row("A", null)],
    });
    expect(categoryEvidenceFreshness([a, b], "best-picture").get("2")).toBe(
      first,
    );
  });

  it.each([
    {},
    { "best-picture": [row("A", 1), row("B", 3)] },
    { "best-picture": [row("A", 1), row("B", null)] },
    { "best-picture": [row("A", 1), row("A", 2)] },
    { "best-picture": [{ rank: 1, raw: "Unrecognized legacy shape" }] },
  ])(
    "breaks continuity across absent or invalid category evidence %#",
    (invalid) => {
      const valid = { "best-picture": [row("A", 1)] };
      const dates = categoryEvidenceFreshness(
        [
          capture("1", first, valid),
          capture("2", second, invalid),
          capture("3", third, valid),
        ],
        "best-picture",
      );
      expect(dates.has("2")).toBe(false);
      expect(dates.get("3")).toBe(third);
    },
  );

  it("keeps page/source identities separate and excludes unknown or explicitly dated formats", () => {
    const a = capture("1", first, { "best-picture": [row("A", 1)] });
    const b = {
      ...capture("2", second, { "best-picture": [row("A", 1)] }),
      publicationUrl: "https://nextbestpicture.com/another/",
    };
    const dated = capture("3", second, { "best-picture": [row("A", 1)] });
    dated.originalData = {
      ...(dated.originalData as object),
      publication_date: second,
    };
    const unknown = { ...a, id: "4", sourceId: "manual-source" };
    const mcc = {
      ...b,
      id: "5",
      sourceId: "midnight-critics",
      originalData: {
        publication_date: null,
        categories: { "best-picture": [row("A", 1)] },
      },
    };
    const resumed = capture("6", third, { "best-picture": [row("A", 1)] });
    const dates = categoryEvidenceFreshness(
      [a, b, dated, unknown, mcc, resumed],
      "best-picture",
    );
    expect(dates.get("2")).toBe(second);
    expect(dates.has("3")).toBe(false);
    expect(dates.has("4")).toBe(false);
    expect(dates.get("5")).toBe(second);
    expect(dates.get("6")).toBe(third);
  });
});
