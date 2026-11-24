import { describe, expect, it, vi } from "vitest";
import { localeTag, type Locale } from "../../src/lib/i18n/config";
import {
  formatCaptureDate,
  formatFilmDate,
  formatLocalizedNumber,
  formatWeekArchiveDate,
  formatWeeklyDate,
} from "../../src/lib/i18n/format";

const dates = [
  "2024-02-29T23:59:59Z",
  "2026-01-02T00:00:00Z",
  "2026-11-24T00:30:00+09:00",
  "2026-11-24T23:30:00-08:00",
];

describe.each<Locale>(["es", "en"])("reusable Intl formats in %s", (locale) => {
  it("preserves capture labels, including UTC day boundaries", () => {
    for (const value of dates) {
      expect(formatCaptureDate(value, locale)).toBe(
        new Intl.DateTimeFormat(localeTag(locale), {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        }).format(new Date(value)),
      );
    }
    expect(formatCaptureDate("", locale)).toBe(
      locale === "en" ? "no capture" : "sin captura",
    );
  });

  it("preserves film dates and missing-date labels", () => {
    for (const value of ["2024-02-29", ...dates]) {
      expect(formatFilmDate(value, locale)).toBe(
        new Intl.DateTimeFormat(localeTag(locale), {
          dateStyle: "medium",
          timeZone: "UTC",
        }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value)),
      );
    }
    for (const value of [null, ""]) {
      expect(formatFilmDate(value, locale)).toBe(
        locale === "en" ? "Date not provided" : "Fecha no indicada",
      );
    }
  });

  it("preserves the weekly view's original bare locale tags", () => {
    for (const value of dates) {
      expect(formatWeeklyDate(value, locale)).toBe(
        new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeZone: "UTC",
        }).format(new Date(value)),
      );
    }
    for (const value of ["2024-02-29", "2026-01-02", "2026-11-24"]) {
      expect(formatWeekArchiveDate(value, locale)).toBe(
        new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }).format(new Date(`${value}T12:00:00Z`)),
      );
    }
  });

  it("preserves existing numeric precision, rounding, grouping and signs", () => {
    const styles = {
      default: {},
      score: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
      preciseScore: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      points: { maximumFractionDigits: 3 },
      probability: { maximumFractionDigits: 1 },
    } satisfies Record<string, Intl.NumberFormatOptions>;
    for (const style of Object.keys(styles) as Array<keyof typeof styles>) {
      for (const value of [
        0,
        -0,
        1.005,
        99.9999,
        12345.67891,
        -12345.67891,
        NaN,
        Infinity,
        -Infinity,
      ]) {
        expect(formatLocalizedNumber(value, locale, style)).toBe(
          value.toLocaleString(localeTag(locale), styles[style]),
        );
      }
    }
    expect(formatLocalizedNumber(42.1234, locale)).toBe(
      (42.1234).toLocaleString(localeTag(locale)),
    );
  });

  it("keeps invalid dates visible as errors rather than substituting data", () => {
    expect(() => formatCaptureDate("invalid", locale)).toThrow(RangeError);
    expect(() => formatFilmDate("invalid", locale)).toThrow(RangeError);
    expect(() => formatWeeklyDate("invalid", locale)).toThrow(RangeError);
    expect(() => formatWeekArchiveDate("invalid", locale)).toThrow(RangeError);
  });
});

it("retains the difference between English film and weekly dates", () => {
  expect(formatFilmDate("2026-01-02", "en")).not.toBe(
    formatWeeklyDate("2026-01-02", "en"),
  );
});

it("constructs each formatter once across repeated independent calls", async () => {
  vi.resetModules();
  const fresh = await import("../../src/lib/i18n/format");
  const NativeDateTimeFormat = Intl.DateTimeFormat;
  const NativeNumberFormat = Intl.NumberFormat;
  const dateConstructor = vi
    .spyOn(Intl, "DateTimeFormat")
    .mockImplementation(function (locales, options) {
      return new NativeDateTimeFormat(locales, options);
    });
  const numberConstructor = vi
    .spyOn(Intl, "NumberFormat")
    .mockImplementation(function (locales, options) {
      return new NativeNumberFormat(locales, options);
    });
  try {
    for (let iteration = 0; iteration < 100; iteration += 1) {
      for (const locale of ["es", "en"] as const) {
        fresh.formatCaptureDate(dates[0], locale);
        fresh.formatFilmDate(dates[0], locale);
        fresh.formatWeeklyDate(dates[0], locale);
        fresh.formatWeekArchiveDate("2026-11-24", locale);
        for (const style of [
          "default",
          "score",
          "preciseScore",
          "points",
          "probability",
        ] as const) {
          fresh.formatLocalizedNumber(iteration / 3, locale, style);
        }
      }
    }
    expect(dateConstructor).toHaveBeenCalledTimes(8);
    expect(numberConstructor).toHaveBeenCalledTimes(10);
  } finally {
    vi.restoreAllMocks();
  }
});
