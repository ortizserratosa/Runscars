import type { Locale } from "../i18n/config";
import type { PrecursorEditionView } from "./types";

export function precursorDate(day: string | null, locale: Locale) {
  return day
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(`${day}T12:00:00Z`))
    : locale === "en"
      ? "Date not listed"
      : "Fecha no recogida";
}

export function precursorCeremony(edition: PrecursorEditionView) {
  return (
    edition.schedule?.ceremonyOn ??
    edition.winners?.ceremonyOn ??
    edition.nominations?.ceremonyOn ??
    null
  );
}

export function precursorNominations(edition: PrecursorEditionView) {
  return (
    edition.schedule?.nominationsOn ??
    edition.nominations?.nominationsOn ??
    edition.winners?.nominationsOn ??
    null
  );
}

export function precursorName(edition: PrecursorEditionView, locale: Locale) {
  return locale === "en" ? edition.nameEn : edition.name;
}

export function precursorKind(
  kind: PrecursorEditionView["organizationKind"],
  locale: Locale,
) {
  return {
    es: { guild: "Sindicato", critics: "Críticos", academy: "Academia" },
    en: { guild: "Guild", critics: "Critics", academy: "Academy" },
  }[locale][kind];
}

export function precursorAvailability(
  edition: PrecursorEditionView,
  today: string,
  locale: Locale,
) {
  if (edition.winners) return locale === "en" ? "Winners" : "Ganadores";
  if (edition.nominations)
    return locale === "en" ? "Nominations" : "Nominaciones";
  const date = precursorNominations(edition);
  if (date && today < date)
    return locale === "en" ? "Nominations upcoming" : "Nominaciones pendientes";
  return locale === "en" ? "Official calendar" : "Calendario oficial";
}
