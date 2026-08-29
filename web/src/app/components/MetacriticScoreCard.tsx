import type { Locale } from "../../lib/i18n/config";
import type { MetacriticScoreView } from "../../lib/repositories/signals";
import { metascoreTone } from "../../lib/critical/metacritic";

type MetacriticScoreCardProps = {
  locale: Locale;
  score: MetacriticScoreView;
};

function captureLabel(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "es-ES", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function MetacriticScoreCard({
  locale,
  score,
}: MetacriticScoreCardProps) {
  const en = locale === "en";
  const criticLabel =
    score.reviewCount === null
      ? null
      : `Based on ${score.reviewCount} ${score.reviewCount === 1 ? "critic" : "critics"}`;
  const accessibleLabel = [
    `Metacritic Metascore ${score.score} out of 100`,
    criticLabel,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <section
      className="metacritic-film-card"
      aria-labelledby="metacritic-film-heading"
    >
      <a
        className="metacritic-lockup"
        href={score.publicationUrl}
        rel="noreferrer"
        target="_blank"
        aria-label={accessibleLabel}
      >
        <span
          className={`metascore-value metascore-value--${metascoreTone(score.score)}`}
          aria-hidden="true"
        >
          {score.score}
        </span>
        <span className="metacritic-wordmark">
          <strong id="metacritic-film-heading">Metacritic</strong>
          <small>Metascore</small>
          {criticLabel ? <span lang="en">{criticLabel}</span> : null}
        </span>
      </a>

      <div className="metacritic-context-copy">
        <p className="section-index">
          {en ? "EXTERNAL CRITICAL CONTEXT" : "CONTEXTO CRÍTICO EXTERNO"}
        </p>
        <h2>
          {en
            ? "A source-attributed score for this film"
            : "Una puntuación atribuida para esta película"}
        </h2>
        <p>
          {en
            ? "The Metascore is calculated and maintained by Metacritic. Runscars displays its original value as context; it does not normalise it or include it in professional consensus."
            : "El Metascore lo calcula y mantiene Metacritic. Runscars muestra su valor original como contexto; no lo normaliza ni lo incorpora al consenso profesional."}
        </p>
        <a
          className="text-link"
          href={score.publicationUrl}
          rel="noreferrer"
          target="_blank"
          lang="en"
        >
          See all critic reviews on metacritic.com
        </a>
        <small>
          {en ? "Checked by Runscars on" : "Consultado por Runscars el"}{" "}
          {captureLabel(score.capturedAt, locale)}.
        </small>
      </div>
    </section>
  );
}
