import type { Locale } from "../i18n/config";
import type { FestivalEditionView } from "./data";

export function festivalImdbUrl(imdbId: string | null | undefined) {
  return imdbId && /^tt\d{7,10}$/.test(imdbId)
    ? `https://www.imdb.com/title/${imdbId}/`
    : null;
}

export function festivalTmdbUrl(tmdbId: number | null | undefined) {
  return tmdbId && Number.isSafeInteger(tmdbId) && tmdbId > 0
    ? `https://www.themoviedb.org/movie/${tmdbId}`
    : null;
}

export function festivalSourceFilmUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function festivalCoverageNote(
  editionId: string,
  kind: string,
  rawCapture: unknown,
  entries: Array<{ section: string }>,
): { es: string; en: string } | null {
  if (kind !== "selection") return null;
  const notes =
    rawCapture && typeof rawCapture === "object" && "notes" in rawCapture
      ? String(rawCapture.notes)
      : "";
  if (editionId === "locarno-2026" && notes.includes("PARTIAL")) {
    return {
      es: "Selección parcial: largometrajes de cinco secciones del festival. La cobertura de otras secciones está pendiente.",
      en: "Partial selection: feature films from five festival programmes. Coverage of other programmes is pending.",
    };
  }
  if (
    editionId.startsWith("nyff-") &&
    entries.length &&
    entries.every((entry) => /Main Slate/i.test(entry.section))
  ) {
    return {
      es: "Cubre Main Slate. La cobertura de Spotlight y Currents está pendiente.",
      en: "Covers the Main Slate. Coverage of Spotlight and Currents is pending.",
    };
  }
  return null;
}

export function festivalDateRange(
  startsOn: string,
  endsOn: string,
  locale: Locale,
) {
  const formatter = new Intl.DateTimeFormat(
    locale === "en" ? "en-GB" : "es-ES",
    {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    },
  );
  return formatter.formatRange(
    new Date(`${startsOn}T12:00:00Z`),
    new Date(`${endsOn}T12:00:00Z`),
  );
}

export function festivalName(edition: FestivalEditionView, locale: Locale) {
  if (locale === "en" && edition.festivalId === "venice") return "Venice";
  return edition.shortName;
}

export const festivalStatus = {
  es: {
    scheduled: "Próximamente",
    ongoing: "En curso",
    completed: "Finalizado",
  },
  en: { scheduled: "Coming up", ongoing: "On now", completed: "Finished" },
} as const;

export function festivalPreview(edition: FestivalEditionView) {
  const set = edition.awards?.entries.length
    ? edition.awards
    : edition.selection;
  const seen = new Set<string>();
  return {
    kind: set?.kind,
    entries: (set?.entries ?? [])
      .filter((entry) => {
        const key = entry.originalTitle.toLocaleLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3),
  };
}

/** Some official feeds put jury citations in the award field. Keep those in
 * the source record instead of repeating a paragraph in every film listing. */
export function festivalAwardLabel(value: string | null, locale: Locale) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 160
    ? locale === "en"
      ? "Official award"
      : "Premio oficial"
    : normalized;
}
