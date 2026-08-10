import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSourceDetail } from "../../../lib/repositories/sources";

type SourcePageProps = { params: Promise<{ slug: string }> };

function dateLabel(value: string | null, time = false) {
  if (!value) return "Sin dato";
  return new Intl.DateTimeFormat("es-ES", {
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
    if (typeof record.title === "string") return record.title;
  }
  return JSON.stringify(value);
}

export async function generateMetadata({
  params,
}: SourcePageProps): Promise<Metadata> {
  const { slug } = await params;
  const source = await getSourceDetail(slug);
  return source
    ? {
        title: `${source.name} · Fuente`,
        description: `Publicaciones y estado verificable de ${source.name} en Runscars.`,
      }
    : { title: "Fuente no encontrada" };
}

export default async function SourcePage({ params }: SourcePageProps) {
  const { slug } = await params;
  const source = await getSourceDetail(slug);
  if (!source) notFound();
  const activePublication = source.categories[0]?.publication;

  return (
    <main>
      <section className="source-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <Link href="/fuentes">Fuentes</Link>
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
              <small>FUENTE</small>
            </div>
            <div>
              <p className="kicker">Fuente activa · procedencia</p>
              <h1>{source.name}</h1>
              <p>
                {source.notes ??
                  "Publicaciones y observaciones conservadas con valor original, fecha y captura."}
              </p>
            </div>
            <a
              className="primary-button"
              href={activePublication?.url ?? source.homepageUrl}
              rel="noreferrer"
              target="_blank"
            >
              Abrir publicación original ↗
            </a>
          </div>
        </div>
      </section>

      <section className="page-shell source-page-layout">
        <div className="source-main">
          {source.categories.length ? (
            source.categories.map((category) => (
              <article
                className="source-category-capture"
                key={category.categoryId}
              >
                <div className="source-capture-header">
                  <div>
                    <p className="section-index">PUBLICACIÓN ACTIVA</p>
                    <h2>{category.categoryName}</h2>
                    <p>{category.publication.title}</p>
                  </div>
                  <span className="verified-badge">
                    ✓ Procedencia verificada
                  </span>
                </div>

                <div className="capture-metadata">
                  <div>
                    <span>Autor</span>
                    <strong>
                      {category.publication.author ?? "No indicado"}
                    </strong>
                  </div>
                  <div>
                    <span>Publicada</span>
                    <strong>
                      {dateLabel(category.publication.publishedAt)}
                    </strong>
                  </div>
                  <div>
                    <span>Capturada</span>
                    <strong>
                      {dateLabel(category.publication.capturedAt, true)}
                    </strong>
                  </div>
                  <div>
                    <span>Último cambio efectivo</span>
                    <strong>{dateLabel(category.lastChangedAt, true)}</strong>
                  </div>
                </div>

                <div className="source-ranking-section">
                  <div className="section-heading compact-heading">
                    <div>
                      <p className="section-index">VALORES ORIGINALES</p>
                      <h2>Lista que participa</h2>
                    </div>
                    <span className="aggregate-chip">
                      {category.entries.some(
                        (entry) => entry.appearanceKind === "ordered",
                      )
                        ? "Participa en Borda"
                        : "Solo cobertura"}
                    </span>
                  </div>
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
                            Original: {originalLabel(entry.originalValue)}
                          </span>
                        </div>
                        <div
                          aria-label={`Consenso vigente de ${entry.label}`}
                          className="source-entry-consensus"
                        >
                          <span>Consenso vigente</span>
                          <strong>
                            {entry.aggregateScore.toLocaleString("es-ES", {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}
                          </strong>
                          <small>
                            #{entry.aggregatePosition} ·{" "}
                            {entry.aggregateCoverage}
                          </small>
                          <small className="source-entry-sources">
                            Fuentes:{" "}
                            {entry.aggregateSources.map(
                              (aggregateSource, index) => (
                                <span key={aggregateSource.id}>
                                  {index ? ", " : ""}
                                  <Link href={`/fuentes/${aggregateSource.id}`}>
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
                    href={`/temporadas/2027/${category.categorySlug}`}
                  >
                    Ver su efecto en {category.categoryName}
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <p className="insufficient-note">
              Esta fuente tiene observaciones críticas publicadas, pero no forma
              parte de un corte profesional vigente.
            </p>
          )}
        </div>

        <aside className="source-sidebar">
          <div className="sidebar-card source-health">
            <p className="section-index">ESTADO ACTUAL</p>
            <dl>
              <div>
                <dt>Estado técnico</dt>
                <dd>{source.technicalStatus}</dd>
              </div>
              <div>
                <dt>Publicación</dt>
                <dd>{source.publicationStatus}</dd>
              </div>
              <div>
                <dt>Última comprobación correcta</dt>
                <dd>{dateLabel(source.lastSuccessfulCheckAt, true)}</dd>
              </div>
              {source.health === "failed" ? (
                <div>
                  <dt>Incidencia más reciente</dt>
                  <dd>{dateLabel(source.lastFailureAt, true)}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="sidebar-card methodology-card">
            <p className="section-index">TRES FECHAS</p>
            <ul>
              <li>Publicación: cuándo el medio publicó la lista</li>
              <li>Cambio: cuándo alteró el ranking de Runscars</li>
              <li>Comprobación: cuándo el conector terminó correctamente</li>
            </ul>
            <Link href="/fuentes">Volver a todas las fuentes →</Link>
          </div>

          <div className="sidebar-card stale-card">
            <span
              className={`status-dot ${source.health === "failed" ? "amber" : "green"}`}
            />
            <div>
              <strong>
                {source.health === "ok"
                  ? "Comprobación correcta"
                  : source.health === "failed"
                    ? "Incidencia reciente"
                    : "Sin automatización comprobable"}
              </strong>
              <p>
                Este estado es actual, incluso al consultar un corte histórico.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
