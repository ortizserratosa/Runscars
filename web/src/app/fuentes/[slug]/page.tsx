import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "../../components/JsonLd";
import { localizedCategoryNameBySlug } from "../../../lib/i18n/categories";
import { localeTag, localizedPath } from "../../../lib/i18n/config";
import { getRequestLocale } from "../../../lib/i18n/server";
import { getSourceDetail } from "../../../lib/repositories/sources";
import { getPrecursorIndex } from "../../../lib/precursors/data";
import {
  precursorCeremony,
  precursorDate,
  precursorName,
} from "../../../lib/precursors/presentation";
import { absoluteUrl, buildLocalizedMetadata } from "../../../lib/seo";
import {
  festivalDateRange,
  festivalName,
} from "../../../lib/festivals/presentation";

type SourcePageProps = { params: Promise<{ slug: string }> };

function dateLabel(value: string | null, locale: "es" | "en", time = false) {
  if (!value) return locale === "en" ? "No data" : "Sin dato";
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
    ...(time ? { timeStyle: "short" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(value));
}

function originalLabel(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.raw === "string") return record.raw;
    if (
      record.raw &&
      typeof record.raw === "object" &&
      !Array.isArray(record.raw)
    )
      return Object.entries(record.raw)
        .map(([column, cell]) => `${column}: ${String(cell)}`)
        .join(" · ");
    if (typeof record.title === "string") return record.title;
  }
  return JSON.stringify(value);
}

export async function generateMetadata({
  params,
}: SourcePageProps): Promise<Metadata> {
  const { slug } = await params;
  const source = await getSourceDetail(slug);
  const locale = await getRequestLocale();
  return source
    ? buildLocalizedMetadata({
        locale,
        path: `/fuentes/${source.id}`,
        title:
          locale === "en"
            ? `${source.name}: ${source.sourceTypes.includes("prediction") ? "Oscar Predictions Source" : "Original Source"}`
            : `${source.name}: ${source.sourceTypes.includes("prediction") ? "fuente de predicciones Oscar" : "fuente original"}`,
        description:
          locale === "en"
            ? `Explore the original publications and data from ${source.name}, with dates and verifiable provenance.`
            : `Consulta las publicaciones y datos originales de ${source.name}, con fechas y procedencia verificables.`,
      })
    : { title: locale === "en" ? "Source not found" : "Fuente no encontrada" };
}

export default async function SourcePage({ params }: SourcePageProps) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const isEnglish = locale === "en";
  const source = await getSourceDetail(slug);
  if (!source) notFound();
  const precursorEditions = source.sourceTypes.includes("official")
    ? (await getPrecursorIndex())
        .filter((edition) => edition.organizationId === source.id)
        .sort((a, b) => b.ceremonyYear - a.ceremonyYear)
    : [];
  const currentPrecursor = precursorEditions[0];
  const festivalEditions = source.festivalEditions ?? [];
  const currentFestival = festivalEditions[0];
  const activeFestivalSet =
    currentFestival?.awards ?? currentFestival?.selection;
  const hasOfficialContext = Boolean(currentPrecursor || currentFestival);
  const activePrecursorSet =
    currentPrecursor?.schedule ??
    currentPrecursor?.winners ??
    currentPrecursor?.nominations;
  const activePublication = source.categories[0]?.publication;
  const pageUrl = absoluteUrl(localizedPath(`/fuentes/${source.id}`, locale));
  const organizationId = `${pageUrl}#source`;

  return (
    <main>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              "@id": `${pageUrl}#webpage`,
              url: pageUrl,
              name: source.name,
              inLanguage: localeTag(locale),
              about: { "@id": organizationId },
              ...(source.lastCapturedAt ||
              source.lastChangedAt ||
              source.lastSuccessfulCheckAt
                ? {
                    dateModified:
                      source.lastCapturedAt ??
                      source.lastChangedAt ??
                      source.lastSuccessfulCheckAt,
                  }
                : {}),
            },
            {
              "@type": "Organization",
              "@id": organizationId,
              name: source.name,
              url: source.homepageUrl,
              sameAs: [source.homepageUrl],
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: isEnglish ? "Home" : "Inicio",
                  item: absoluteUrl(localizedPath("/", locale)),
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: isEnglish ? "Sources" : "Fuentes",
                  item: absoluteUrl(localizedPath("/fuentes", locale)),
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: source.name,
                  item: pageUrl,
                },
              ],
            },
          ],
        }}
      />
      <section className="source-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href={localizedPath("/", locale)}>
              {isEnglish ? "Home" : "Inicio"}
            </Link>
            <span>/</span>
            <Link href={localizedPath("/fuentes", locale)}>
              {isEnglish ? "Sources" : "Fuentes"}
            </Link>
            <span>/</span>
            <span>{source.name}</span>
          </div>
          <div className="source-title-row">
            <div className="source-logo-block" aria-hidden="true">
              <span>
                {source.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <small>{isEnglish ? "SOURCE" : "FUENTE"}</small>
            </div>
            <div>
              <p className="kicker">
                {isEnglish
                  ? "Active source · provenance"
                  : "Fuente activa · procedencia"}
              </p>
              <h1>{source.name}</h1>
              <p>
                {currentPrecursor?.notes[locale] ??
                  (currentFestival
                    ? isEnglish
                      ? "Explore the festival’s official selections and awards, with dated original sources."
                      : "Consulta las selecciones y palmarés oficiales del festival, con sus fuentes originales fechadas."
                    : null) ??
                  source.notes ??
                  (isEnglish
                    ? "Explore this source’s original publications and latest predictions."
                    : "Consulta las publicaciones originales y las últimas predicciones de esta fuente.")}
              </p>
            </div>
            <a
              className="primary-button"
              href={
                activePublication?.url ??
                activePrecursorSet?.sourceUrl ??
                activeFestivalSet?.sourceUrl ??
                source.homepageUrl
              }
              rel="noreferrer"
              target="_blank"
            >
              {isEnglish
                ? "Open original publication ↗"
                : "Abrir publicación original ↗"}
            </a>
          </div>
        </div>
      </section>

      <section className="page-shell source-page-layout">
        <div className="source-main">
          {festivalEditions.length ? (
            festivalEditions.map((edition) => (
              <article className="source-category-capture" key={edition.id}>
                <div className="source-capture-header">
                  <div>
                    <p className="section-index">
                      {isEnglish ? "OFFICIAL FESTIVAL" : "FESTIVAL OFICIAL"}
                    </p>
                    <h2>
                      {festivalName(edition, locale)} {edition.year}
                    </h2>
                    <p>
                      {festivalDateRange(
                        edition.startsOn,
                        edition.endsOn,
                        locale,
                      )}
                    </p>
                  </div>
                </div>
                {[edition.selection, edition.awards]
                  .filter((set) => set !== null)
                  .map((set) => (
                    <div className="source-capture-body" key={set.id}>
                      <h3>
                        {set.kind === "selection"
                          ? isEnglish
                            ? "Selection"
                            : "Selección"
                          : isEnglish
                            ? "Awards"
                            : "Palmarés"}
                      </h3>
                      {set.coverageNote ? (
                        <p>{set.coverageNote[locale]}</p>
                      ) : null}
                      <div className="capture-metadata">
                        {set.publishedAt ? (
                          <div>
                            <span>{isEnglish ? "Published" : "Publicado"}</span>
                            <strong>
                              {dateLabel(set.publishedAt, locale)}
                            </strong>
                          </div>
                        ) : null}
                        <div>
                          <span>
                            {isEnglish ? "Last consulted" : "Última consulta"}
                          </span>
                          <strong>
                            {dateLabel(set.capturedAt, locale, true)}
                          </strong>
                        </div>
                        <div>
                          <span>{isEnglish ? "Entries" : "Entradas"}</span>
                          <strong>{set.entries.length}</strong>
                        </div>
                      </div>
                      <a
                        className="text-link"
                        href={set.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {set.sourceTitle} ↗
                      </a>
                    </div>
                  ))}
                <Link
                  className="text-link"
                  href={localizedPath(
                    `/festivales/${edition.festivalId}/${edition.year}`,
                    locale,
                  )}
                >
                  {isEnglish
                    ? "Explore the selection and festival awards"
                    : "Explorar selección y palmarés del festival"}{" "}
                  →
                </Link>
              </article>
            ))
          ) : precursorEditions.length ? (
            precursorEditions.map((edition) => {
              const receipt =
                edition.schedule ?? edition.winners ?? edition.nominations;
              return (
                <article className="source-category-capture" key={edition.id}>
                  <div className="source-capture-header">
                    <div>
                      <p className="section-index">
                        {isEnglish ? "OFFICIAL AWARDS" : "PREMIOS OFICIALES"} ·
                        OSCAR {edition.ceremonyYear}
                      </p>
                      <h2>
                        {precursorName(edition, locale)} {edition.ceremonyYear}
                      </h2>
                    </div>
                  </div>
                  <div className="capture-metadata">
                    <div>
                      <span>{isEnglish ? "Ceremony" : "Ceremonia"}</span>
                      <strong>
                        {precursorDate(precursorCeremony(edition), locale)}
                      </strong>
                    </div>
                    {receipt?.publishedAt ? (
                      <div>
                        <span>{isEnglish ? "Published" : "Publicado"}</span>
                        <strong>
                          {dateLabel(receipt.publishedAt, locale)}
                        </strong>
                      </div>
                    ) : null}
                    <div>
                      <span>
                        {isEnglish ? "Last consulted" : "Última consulta"}
                      </span>
                      <strong>
                        {dateLabel(receipt?.capturedAt ?? null, locale)}
                      </strong>
                    </div>
                  </div>
                  {receipt ? <p>{receipt.coverage[locale]}</p> : null}
                  <Link
                    className="text-link"
                    prefetch={false}
                    href={localizedPath(
                      `/premios/${edition.organizationId}/${edition.ceremonyYear}`,
                      locale,
                    )}
                  >
                    {isEnglish
                      ? "Explore the official calendar and film results"
                      : "Explorar calendario y resultados oficiales de cine"}{" "}
                    →
                  </Link>
                </article>
              );
            })
          ) : source.categories.length ? (
            source.categories.map((category) => (
              <article
                className="source-category-capture"
                key={category.categoryId}
              >
                <div className="source-capture-header">
                  <div>
                    <p className="section-index">
                      {isEnglish ? "ACTIVE PUBLICATION" : "PUBLICACIÓN ACTIVA"}
                    </p>
                    <h2>
                      {localizedCategoryNameBySlug(
                        locale,
                        category.categorySlug,
                        category.categoryName,
                      )}
                    </h2>
                    <p>{category.publication.title}</p>
                  </div>
                  <span className="verified-badge">
                    {isEnglish
                      ? "✓ Verified provenance"
                      : "✓ Procedencia verificada"}
                  </span>
                </div>

                <div className="capture-metadata">
                  <div>
                    <span>{isEnglish ? "Author" : "Autor"}</span>
                    <strong>
                      {category.publication.author ??
                        (isEnglish ? "Not provided" : "No indicado")}
                    </strong>
                  </div>
                  <div>
                    <span>{isEnglish ? "Published" : "Publicada"}</span>
                    <strong>
                      {dateLabel(category.publication.publishedAt, locale)}
                    </strong>
                  </div>
                  <div>
                    <span>{isEnglish ? "Captured" : "Capturada"}</span>
                    <strong>
                      {dateLabel(category.publication.capturedAt, locale, true)}
                    </strong>
                  </div>
                  <div>
                    <span>
                      {isEnglish
                        ? "Latest effective change"
                        : "Último cambio efectivo"}
                    </span>
                    <strong>
                      {dateLabel(category.lastChangedAt, locale, true)}
                    </strong>
                  </div>
                </div>

                <div className="source-ranking-section">
                  <div className="section-heading compact-heading">
                    <div>
                      <p className="section-index">
                        {isEnglish ? "ORIGINAL VALUES" : "VALORES ORIGINALES"}
                      </p>
                      <h2>
                        {isEnglish ? "Included list" : "Lista que participa"}
                      </h2>
                    </div>
                    <span className="aggregate-chip">
                      {category.entries.some(
                        (entry) => entry.appearanceKind === "ordered",
                      )
                        ? isEnglish
                          ? "Contributes Borda points"
                          : "Aporta puntos Borda"
                        : isEnglish
                          ? "Coverage only"
                          : "Solo cobertura"}
                    </span>
                  </div>
                  {category.entries[0]?.appearanceKind === "ordered" &&
                  category.entries.length < category.entries[0].listLength ? (
                    <p>
                      {isEnglish
                        ? `Shows ${category.entries.length} matched candidates from ${category.entries[0].listLength} original ranked positions. Their original ranks are preserved.`
                        : `Se muestran ${category.entries.length} candidaturas emparejadas de ${category.entries[0].listLength} posiciones originales. Se conservan sus puestos originales.`}
                    </p>
                  ) : null}
                  <ol className="source-ranking">
                    {category.entries.map((entry) => (
                      <li key={entry.candidateId}>
                        <span>
                          {entry.rank
                            ? String(entry.rank).padStart(2, "0")
                            : "SEL"}
                        </span>
                        <div className="source-entry-copy">
                          <strong>{entry.label}</strong>
                          <span className="original-value">
                            {isEnglish ? "Original" : "Original"}:{" "}
                            {originalLabel(entry.originalValue)}
                          </span>
                        </div>
                        <div
                          aria-label={`${isEnglish ? "Current Borda score for" : "Puntuación Borda vigente de"} ${entry.label}`}
                          className="source-entry-consensus"
                        >
                          <span>
                            {isEnglish
                              ? "Current Borda score"
                              : "Puntuación Borda vigente"}
                          </span>
                          <strong>
                            {entry.aggregateScore.toLocaleString(
                              localeTag(locale),
                              {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              },
                            )}
                          </strong>
                          <small>
                            #{entry.aggregatePosition} ·{" "}
                            {entry.aggregateCoverage}
                          </small>
                          <small className="source-entry-sources">
                            {isEnglish ? "Sources" : "Fuentes"}:{" "}
                            {entry.aggregateSources.map(
                              (aggregateSource, index) => (
                                <span key={aggregateSource.id}>
                                  {index ? ", " : ""}
                                  <Link
                                    href={localizedPath(
                                      `/fuentes/${aggregateSource.id}`,
                                      locale,
                                    )}
                                  >
                                    {aggregateSource.name}
                                  </Link>
                                </span>
                              ),
                            )}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <Link
                    className="text-link"
                    href={localizedPath(
                      `/temporadas/2027/${category.categorySlug}`,
                      locale,
                    )}
                  >
                    {isEnglish ? "View its effect on" : "Ver su efecto en"}{" "}
                    {localizedCategoryNameBySlug(
                      locale,
                      category.categorySlug,
                      category.categoryName,
                    )}
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <p className="insufficient-note">
              {isEnglish
                ? "This source has no predictions in the current ranking. Visit its website to explore its coverage."
                : "Esta fuente no tiene predicciones en la clasificación actual. Visita su web para consultar su cobertura."}
            </p>
          )}
        </div>

        <aside className="source-sidebar">
          <div className="sidebar-card source-health">
            <p className="section-index">
              {isEnglish ? "CURRENT STATUS" : "ESTADO ACTUAL"}
            </p>
            <dl>
              <div>
                <dt>
                  {hasOfficialContext
                    ? isEnglish
                      ? "Last consulted"
                      : "Última consulta"
                    : isEnglish
                      ? "Latest successful verification"
                      : "Última comprobación correcta"}
                </dt>
                <dd>
                  {dateLabel(
                    hasOfficialContext
                      ? (source.lastCapturedAt ?? null)
                      : source.lastSuccessfulCheckAt,
                    locale,
                    true,
                  )}
                </dd>
              </div>
              {currentFestival && source.lastSuccessfulCheckAt ? (
                <div>
                  <dt>
                    {isEnglish
                      ? "Latest successful automatic verification"
                      : "Última comprobación automática correcta"}
                  </dt>
                  <dd>
                    {dateLabel(source.lastSuccessfulCheckAt, locale, true)}
                  </dd>
                </div>
              ) : null}
              {source.health === "failed" ? (
                <div>
                  <dt>
                    {isEnglish
                      ? "Most recent issue"
                      : "Incidencia más reciente"}
                  </dt>
                  <dd>{dateLabel(source.lastFailureAt, locale, true)}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="sidebar-card methodology-card">
            <p className="section-index">
              {hasOfficialContext
                ? isEnglish
                  ? "OFFICIAL CONTEXT"
                  : "CONTEXTO OFICIAL"
                : isEnglish
                  ? "THREE DATES"
                  : "TRES FECHAS"}
            </p>
            {hasOfficialContext ? (
              <p>
                {currentFestival
                  ? isEnglish
                    ? "Selections and festival awards retain their original titles, recipients and dated sources."
                    : "Las selecciones y palmarés conservan los títulos, destinatarios y fuentes fechadas originales."
                  : isEnglish
                    ? "Calendars and results retain each organisation’s original categories, recipients and dated sources."
                    : "Los calendarios y resultados conservan las categorías, destinatarios y fuentes fechadas originales de cada organismo."}
              </p>
            ) : (
              <ul>
                <li>
                  {isEnglish
                    ? "Publication: when the outlet published the list"
                    : "Publicación: cuándo el medio publicó la lista"}
                </li>
                <li>
                  {isEnglish
                    ? "Change: when it changed the Runscars ranking"
                    : "Cambio: cuándo alteró el ranking de Runscars"}
                </li>
                <li>
                  {isEnglish
                    ? "Verification: when the connector completed successfully"
                    : "Comprobación: cuándo el conector terminó correctamente"}
                </li>
              </ul>
            )}
            <Link href={localizedPath("/fuentes", locale)}>
              {isEnglish
                ? "Back to all sources →"
                : "Volver a todas las fuentes →"}
            </Link>
          </div>

          {!currentPrecursor ? (
            <div className="sidebar-card stale-card">
              <span
                className={`status-dot ${source.festivalArchiveReviewed || source.health === "ok" ? "green" : source.health === "failed" ? "amber" : "gray"}`}
              />
              <div>
                <strong>
                  {source.festivalArchiveReviewed
                    ? isEnglish
                      ? "Reviewed festival archive"
                      : "Archivo festivalero revisado"
                    : source.health === "ok"
                      ? isEnglish
                        ? "Verification successful"
                        : "Comprobación correcta"
                      : source.health === "failed"
                        ? isEnglish
                          ? "Recent issue"
                          : "Incidencia reciente"
                        : isEnglish
                          ? "No verifiable automation"
                          : "Sin automatización comprobable"}
                </strong>
                <p>
                  {source.festivalArchiveReviewed
                    ? isEnglish
                      ? "This completed edition retains a reviewed official archive. Automatic checks are no longer scheduled."
                      : "Esta edición finalizada conserva un archivo oficial revisado. Las comprobaciones automáticas ya no están programadas."
                    : isEnglish
                      ? "This status is current, even when viewing a historical update."
                      : "Este estado es actual, incluso al consultar una actualización histórica."}
                </p>
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
