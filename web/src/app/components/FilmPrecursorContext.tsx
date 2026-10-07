import Link from "next/link";
import type { Locale } from "../../lib/i18n/config";
import { localizedPath } from "../../lib/i18n/config";
import type { getFilmPrecursorContext } from "../../lib/precursors/data";
import { precursorName } from "../../lib/precursors/presentation";

export function FilmPrecursorContext({
  context,
  locale,
}: {
  context: Awaited<ReturnType<typeof getFilmPrecursorContext>>;
  locale: Locale;
}) {
  if (!context.length) return null;
  const en = locale === "en";
  return (
    <section className="film-signal-section festival-module">
      <div className="module-heading">
        <span className="signal-letter">P</span>
        <div>
          <p className="section-index">
            {en
              ? "GUILDS, CRITICS AND ACADEMIES"
              : "SINDICATOS, CRÍTICOS Y ACADEMIAS"}
          </p>
          <h2>
            {en ? "Awards before the Oscars" : "Premios antes de los Oscar"}
          </h2>
        </div>
      </div>
      <div className="film-festival-list">
        {context.map(({ edition, entries }) => (
          <Link
            prefetch={false}
            key={edition.id}
            href={localizedPath(
              `/premios/${edition.organizationId}/${edition.ceremonyYear}`,
              locale,
            )}
          >
            <span>
              {precursorName(edition, locale)} · {edition.ceremonyYear}
            </span>
            <strong>
              {entries.some((entry) => entry.kind === "winners")
                ? en
                  ? "Winner"
                  : "Ganadora"
                : en
                  ? "Nominated"
                  : "Nominada"}
            </strong>
            <small>
              {entries
                .map(
                  (entry) =>
                    `${entry.originalCategory}${entry.originalRecipient ? ` · ${entry.originalRecipient}` : ""}`,
                )
                .join(" / ")}
            </small>
          </Link>
        ))}
      </div>
    </section>
  );
}
