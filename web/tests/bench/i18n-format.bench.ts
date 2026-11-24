import { afterAll, bench, describe } from "vitest";
import { localeTag, type Locale } from "../../src/lib/i18n/config";
import {
  formatCaptureDate,
  formatLocalizedNumber,
} from "../../src/lib/i18n/format";

// From web/: npx vitest bench --run tests/bench/i18n-format.bench.ts
// Fixed synthetic input, no network or production requests. This isolates Intl
// formatting; it does not predict Vercel billing or complete route CPU savings.
console.info(
  `Intl formatting benchmark: ${process.version}, ICU ${process.versions.icu}`,
);

const inputs = Array.from({ length: 200 }, (_, index) => ({
  value: new Date(
    Date.UTC(2026, 10, 1 + (index % 24), index % 24),
  ).toISOString(),
  points: ((index * 31) % 1000) / 11,
  locale: (index % 2 ? "en" : "es") as Locale,
}));
const options = {
  time: 500,
  iterations: 10,
  warmupTime: 100,
  warmupIterations: 3,
};
let lastOutputLength = 0;
afterAll(() => {
  if (!lastOutputLength) throw new Error("Expected formatted labels");
});

describe("200 capture date labels", () => {
  bench(
    "previous: construct DateTimeFormat per label",
    () => {
      let length = 0;
      for (const input of inputs) {
        length += new Intl.DateTimeFormat(localeTag(input.locale), {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        }).format(new Date(input.value)).length;
      }
      lastOutputLength = length;
    },
    options,
  );

  bench(
    "reusable formatters",
    () => {
      let length = 0;
      for (const input of inputs) {
        length += formatCaptureDate(input.value, input.locale).length;
      }
      lastOutputLength = length;
    },
    options,
  );
});

describe("200 source point labels", () => {
  bench(
    "previous: Number.toLocaleString per label",
    () => {
      let length = 0;
      for (const input of inputs) {
        length += input.points.toLocaleString(localeTag(input.locale), {
          maximumFractionDigits: 3,
        }).length;
      }
      lastOutputLength = length;
    },
    options,
  );

  bench(
    "reusable formatters",
    () => {
      let length = 0;
      for (const input of inputs) {
        length += formatLocalizedNumber(
          input.points,
          input.locale,
          "points",
        ).length;
      }
      lastOutputLength = length;
    },
    options,
  );
});
