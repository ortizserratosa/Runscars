import type { Metadata } from "next";
import Link from "next/link";
import { getSourceIndex } from "../../lib/repositories/sources";

export const metadata: Metadata = {
  title: "Fuentes",
  description: "Fuentes activas, publicaciones y estado de comprobación.",
};

function dateLabel(value: string | null) {
  if (!value) return "Sin dato todavía";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function SourcesPage() {
  const sources = await getSourceIndex();
  return (
    <main>
      <section className="source-hero sources-index-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <span>Fuentes</span>
          </div>
          <div className="source-title-row">
            <div>
              <p className="kicker">Procedencia pública</p>
              <h1>
                Las fuentes, <em>con estado.</em>
              </h1>
              <p>
                Publicación, último cambio efectivo y comprobación técnica son
                fechas distintas. Aquí puedes revisar cada una.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell sources-index-section">
        <div className="section-heading split-heading">
          <div>
            <p className="section-index">FUENTES CON DATOS PUBLICADOS</p>
            <h2>{sources.length} recibos activos</h2>
          </div>
          <p>
            Solo aparecen medios presentes en un corte profesional o con una
            observación crítica publicada.
          </p>
        </div>
        <div className="sources-index-grid">
          {sources.map((source) => (
            <Link
              className="source-index-card"
              href={`/fuentes/${source.id}`}
              key={source.id}
            >
              <div className="source-index-card-heading">
                <span className="source-logo-block" aria-hidden="true">
                  {source.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <span className={`source-health-chip ${source.health}`}>
                  {source.health === "ok"
                    ? "Comprobación correcta"
                    : source.health === "failed"
                      ? "Incidencia reciente"
                      : "Sin comprobación automática"}
                </span>
              </div>
              <h3>{source.name}</h3>
              <p>
                {source.activeCategoryCount} categorías profesionales activas
              </p>
              <dl>
                <div>
                  <dt>Último cambio</dt>
                  <dd>{dateLabel(source.lastChangedAt)}</dd>
                </div>
                <div>
                  <dt>Última publicación</dt>
                  <dd>{dateLabel(source.lastPublishedAt)}</dd>
                </div>
                <div>
                  <dt>Última comprobación</dt>
                  <dd>{dateLabel(source.lastSuccessfulCheckAt)}</dd>
                </div>
              </dl>
              <strong>Ver procedencia →</strong>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
