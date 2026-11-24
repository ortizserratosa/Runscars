import { localeTag, type Locale } from "./config";

const dateOptions = {
  capture: { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" },
  film: { dateStyle: "medium", timeZone: "UTC" },
  weekly: { dateStyle: "medium", timeZone: "UTC" },
  weekArchive: { day: "numeric", month: "short", timeZone: "UTC" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

type DateFormat = keyof typeof dateOptions;
const dateFormatters: Record<
  DateFormat,
  Partial<Record<Locale, Intl.DateTimeFormat>>
> = { capture: {}, film: {}, weekly: {}, weekArchive: {} };

const numberOptions = {
  default: {},
  score: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
  preciseScore: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  points: { maximumFractionDigits: 3 },
  probability: { maximumFractionDigits: 1 },
} satisfies Record<string, Intl.NumberFormatOptions>;

type NumberFormat = keyof typeof numberOptions;
const numberFormatters: Record<
  NumberFormat,
  Partial<Record<Locale, Intl.NumberFormat>>
> = { default: {}, score: {}, preciseScore: {}, points: {}, probability: {} };

function formatDate(value: Date, locale: Locale, style: DateFormat) {
  // Weekly dates historically use bare es/en tags (en resolves to en-US).
  const tag =
    style === "weekly" || style === "weekArchive" ? locale : localeTag(locale);
  const formatter = (dateFormatters[style][locale] ??= new Intl.DateTimeFormat(
    tag,
    dateOptions[style],
  ));
  return formatter.format(value);
}

export function formatCaptureDate(value: string, locale: Locale) {
  if (!value) return locale === "en" ? "no capture" : "sin captura";
  return formatDate(new Date(value), locale, "capture");
}

export function formatFilmDate(value: string | null, locale: Locale) {
  if (!value)
    return locale === "en" ? "Date not provided" : "Fecha no indicada";
  return formatDate(
    new Date(value.length === 10 ? `${value}T00:00:00Z` : value),
    locale,
    "film",
  );
}

export function formatWeeklyDate(value: string, locale: Locale) {
  return formatDate(new Date(value), locale, "weekly");
}

export function formatWeekArchiveDate(value: string, locale: Locale) {
  return formatDate(new Date(`${value}T12:00:00Z`), locale, "weekArchive");
}

export function formatLocalizedNumber(
  value: number,
  locale: Locale,
  style: NumberFormat = "default",
) {
  const formatter = (numberFormatters[style][locale] ??= new Intl.NumberFormat(
    localeTag(locale),
    numberOptions[style],
  ));
  return formatter.format(value);
}
