import Link from "next/link";
import { Movement } from "../components/Movement";
import type {
  ActiveCategoryView,
  ArchiveCategoryView,
} from "../../lib/categories/data";
import type { PublicCategoryId } from "../../lib/categories/config";
import { UserRankingPanel } from "./UserRankingPanel";

type CategoryDefinition = {
  id: PublicCategoryId;
  slug: string;
  name: string;
  shortName: string;
};

function dateLabel(value: string) {
  if (!value) return "sin captura";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function candidateSubtitle(candidate: {
  film: { id: string; title: string } | null;
  people: Array<{ name: string; role: string }>;
  workTitle?: string | null;
}) {
  const parts = [
    candidate.people.length
      ? candidate.people.map((person) => person.name).join(", ")
      : null,
    candidate.film?.title ?? candidate.workTitle ?? null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function ActiveCategory({
  category,
  view,
}: {
  category: CategoryDefinition;
  view: ActiveCategoryView;
}) {
  const aggregate = view.aggregate;
  const ranking = aggregate?.ranking ?? [];
  const visibleRanking = ranking.slice(0, 10);
  const remainingRanking = ranking.slice(10);
  const renderCandidate = (candidate: (typeof ranking)[number]) => (
    <div className="leaderboard-item" key={candidate.candidateId}>
      <div className="leaderboard-row">
        <span className="leaderboard-rank">
          {String(candidate.position).padStart(2, "0")}
        </span>
        <div className="leaderboard-title">
          <strong>
            {candidate.film ? (
              <Link href={`/peliculas/${candidate.film.id}`}>
                {candidate.label}
              </Link>
            ) : (
              candidate.label
            )}
          </strong>
          <small>{candidateSubtitle(candidate)}</small>
        </div>
        <div className="coverage-cell">
          <span>
            {candidate.appearances}/{candidate.applicableSourceCount}
          </span>
          <div className="coverage-dots" aria-hidden="true">
            {Array.from(
              { length: candidate.applicableSourceCount },
              (_, index) => (
                <i
                  className={index < candidate.appearances ? "filled" : ""}
                  key={index}
                />
              ),
            )}
          </div>
        </div>
        <div className="points-cell">
          <strong>
            {candidate.scoreOutOf100.toLocaleString("es-ES", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </strong>
          <div className="micro-bar">
            <span
              style={{
                width: `${Math.max(candidate.scoreOutOf100, 1)}%`,
              }}
            />
          </div>
        </div>
        {view.snapshot?.previous ? (
          <Movement value={candidate.movement} />
        ) : (
          <span
            aria-label="Sin corte real anterior"
            className="movement neutral"
            title="Sin corte real anterior"
          >
            —
          </span>
        )}
      </div>
      <details className="category-source-details">
        <summary>Ver procedencia y cálculo</summary>
        <div className="source-calculations">
          {candidate.sourceContributions.map((source) => (
            <a
              data-source-id={source.sourceId}
              href={source.publicationUrl}
              key={source.sourceId}
              rel="noreferrer"
              target="_blank"
            >
              <span>
                {source.sourceName}
                <small>
                  {source.publishedAt
                    ? `Publicada ${dateLabel(source.publishedAt)}`
                    : "Publicación verificada"}
                </small>
              </span>
              <span className="source-position">
                {source.appearanceKind === "ordered"
                  ? `Puesto ${source.rank} de ${source.listLength}`
                  : source.appearanceKind === "selection"
                    ? "selección"
                    : "ausente"}
              </span>
              <strong>
                {source.points.toLocaleString("es-ES", {
                  maximumFractionDigits: 3,
                })}{" "}
                pts
              </strong>
            </a>
          ))}
        </div>
      </details>
    </div>
  );
  return (
    <>
      <section className="category-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <Link href="/temporadas/2027">Oscar 2027</Link>
            <span>/</span>
            <span>{category.name}</span>
          </div>
          <div className="category-title-row">
            <div>
              <p className="kicker">Predicción profesional de nominaciones</p>
              <h1>{category.name}</h1>
              <p>
                {aggregate?.ranking.length ?? 0} candidaturas ·{" "}
                {aggregate?.orderedSourceCount ?? 0} rankings ordenados ·{" "}
                {aggregate?.applicableSourceCount ?? 0} medios aplicables
              </p>
            </div>
            <div className="category-hero-stat">
              <span>Cobertura</span>
              <strong>{aggregate?.orderedSourceCount ?? 0}</strong>
              <small>
                {aggregate?.isConsensus
                  ? "fuentes · mínimo 4"
                  : "fuentes · mínimo 4 pendiente"}
              </small>
            </div>
          </div>
        </div>
      </section>

      <div className="page-shell category-page-body">
        <section className="snapshot-panel">
          <div className="snapshot-heading">
            <div>
              <p className="section-index">ACTUALIZACIÓN</p>
              <h2>Datos verificados</h2>
            </div>
            <div className="snapshot-readout">
              <span>
                {view.snapshot
                  ? dateLabel(view.snapshot.lockedAt)
                  : "pendiente"}
              </span>
              <strong>
                {view.dataState === "database"
                  ? "PUBLICADA"
                  : view.dataState === "fixture"
                    ? "DEMOSTRACIÓN"
                    : "PENDIENTE"}
              </strong>
            </div>
          </div>
          {view.snapshot ? (
            <>
              <nav
                aria-label="Seleccionar corte real"
                className="snapshot-selector"
              >
                {view.snapshot.cuts.map((cut, index) => (
                  <Link
                    aria-current={cut.isSelected ? "page" : undefined}
                    className={cut.isSelected ? "active" : undefined}
                    href={`/temporadas/2027/${category.slug}?corte=${encodeURIComponent(
                      cut.id,
                    )}`}
                    key={cut.id}
                    scroll={false}
                  >
                    <span>{index === 0 ? "Actual" : "Cambio efectivo"}</span>
                    <strong>{dateLabel(cut.lockedAt)}</strong>
                    <small>
                      {cut.changedSources.length
                        ? `Cambió: ${cut.changedSources.join(", ")}`
                        : "Primer estado disponible"}
                    </small>
                  </Link>
                ))}
              </nav>
              <div className="locked-snapshot-note">
                <div>
                  <strong>
                    {view.snapshot.isLatest
                      ? "Consenso profesional vigente"
                      : "Corte histórico seleccionado"}
                  </strong>
                  <span>
                    {aggregate?.includedObservationIds.length ?? 0}{" "}
                    observaciones contrastadas y conservadas con su procedencia
                  </span>
                </div>
                <div className="snapshot-comparison">
                  <span>
                    Solo un cambio efectivo de proveedor crea un corte
                  </span>
                  {view.snapshot.previous ? (
                    <strong>
                      Cambios frente al corte real de{" "}
                      {dateLabel(view.snapshot.previous.lockedAt)}
                    </strong>
                  ) : (
                    <strong>
                      Primer corte disponible · sin comparación anterior
                    </strong>
                  )}
                </div>
              </div>
              {view.sourceFreshness.length ? (
                <details className="source-freshness-panel">
                  <summary>
                    Estado y fechas de {view.sourceFreshness.length} fuentes
                  </summary>
                  {!view.snapshot.isLatest ? (
                    <p className="historical-freshness-note">
                      Publicación y cambio pertenecen al corte seleccionado. La
                      comprobación técnica refleja el estado actual del
                      conector.
                    </p>
                  ) : null}
                  <div className="source-freshness-grid">
                    {view.sourceFreshness.map((source) => (
                      <article key={source.sourceId}>
                        <div>
                          <Link href={`/fuentes/${source.sourceId}`}>
                            {source.sourceName}
                          </Link>
                          <span
                            className={`source-health-chip ${source.status}`}
                          >
                            {source.status === "ok"
                              ? "Correcta"
                              : source.status === "failed"
                                ? "Incidencia"
                                : "Sin estado"}
                          </span>
                        </div>
                        <dl>
                          <div>
                            <dt>Publicada</dt>
                            <dd>
                              {source.publishedAt
                                ? dateLabel(source.publishedAt)
                                : "sin fecha"}
                            </dd>
                          </div>
                          <div>
                            <dt>Cambió el ranking</dt>
                            <dd>{dateLabel(source.lastChangedAt)}</dd>
                          </div>
                          <div>
                            <dt>Comprobación correcta</dt>
                            <dd>
                              {source.lastSuccessfulCheckAt
                                ? dateLabel(source.lastSuccessfulCheckAt)
                                : "sin automatización"}
                            </dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <p className="insufficient-note">
              Aún no existe una actualización publicable para esta categoría.
            </p>
          )}
          {view.dataState === "fixture" ? (
            <p className="calculation-cut-note">
              Datos de demostración disponibles solo en desarrollo y pruebas.
            </p>
          ) : null}
        </section>

        <section className="leaderboard-section">
          <div className="section-heading split-heading">
            <div>
              <p className="section-index">CONSENSO</p>
              <h2>Consenso profesional</h2>
            </div>
            <p>
              Cada medio pesa una vez. Las selecciones sin orden aportan
              cobertura, nunca puntos Borda.
            </p>
          </div>
          {ranking.length ? (
            <div className="leaderboard">
              <div className="leaderboard-head" aria-hidden="true">
                <span>Pos.</span>
                <span>Candidatura</span>
                <span>Respaldo</span>
                <span>Puntos</span>
                <span>Cambio</span>
              </div>
              {visibleRanking.map(renderCandidate)}
              {remainingRanking.length ? (
                <details className="leaderboard-more">
                  <summary>Ver posiciones 11–{ranking.length}</summary>
                  <div>{remainingRanking.map(renderCandidate)}</div>
                </details>
              ) : null}
            </div>
          ) : (
            <p className="insufficient-note">
              No hay cuatro rankings ordenados publicables y emparejados para
              esta categoría.
            </p>
          )}
        </section>

        <section className="market-panel" aria-labelledby="market-title">
          <div className="section-heading split-heading">
            <div>
              <p className="section-index">MERCADOS</p>
              <h2 id="market-title">Señales separadas</h2>
            </div>
            <p>
              Kalshi y Polymarket se muestran por proveedor. No existe consenso
              de mercados y sus precios no participan en la predicción
              profesional. Reflejan su última captura y no el corte profesional
              seleccionado.
            </p>
          </div>
          <div className="market-provider-grid">
            {(["kalshi", "polymarket"] as const).map((provider) => (
              <article className="market-provider" key={provider}>
                <h3>{provider === "kalshi" ? "Kalshi" : "Polymarket"}</h3>
                {view.markets[provider].length ? (
                  <>
                    <div className="market-provider-summary">
                      {(["nomination", "winner"] as const).map((intention) => {
                        const leader = view.markets[provider].find(
                          (market) => market.intention === intention,
                        );
                        if (!leader) return null;
                        return (
                          <a
                            href={leader.sourceUrl}
                            key={intention}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <span>
                              {intention === "nomination"
                                ? "Mayor señal de nominación"
                                : "Mayor señal de ganador"}
                            </span>
                            <strong>{leader.outcome}</strong>
                            <em>
                              {leader.probability === null
                                ? "—"
                                : `${(leader.probability * 100).toLocaleString(
                                    "es-ES",
                                    { maximumFractionDigits: 1 },
                                  )}%`}
                            </em>
                            <small>
                              Observado {dateLabel(leader.observedAt)}
                            </small>
                          </a>
                        );
                      })}
                    </div>
                    <details className="market-details">
                      <summary>
                        Ver {view.markets[provider].length} contratos
                      </summary>
                      <div className="market-intention-list">
                        {(["nomination", "winner"] as const).map(
                          (intention) => {
                            const markets = view.markets[provider].filter(
                              (market) => market.intention === intention,
                            );
                            if (!markets.length) return null;
                            return (
                              <section
                                className="market-intention"
                                key={intention}
                              >
                                <h4>
                                  {intention === "nomination"
                                    ? "Nominación"
                                    : "Ganador"}
                                </h4>
                                {markets.map((market) => (
                                  <a
                                    href={market.sourceUrl}
                                    key={`${market.intention}-${market.title}-${market.outcome}`}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    <span className="market-label">
                                      <strong>{market.outcome}</strong>
                                      <small>{market.title}</small>
                                    </span>
                                    <strong>
                                      {market.probability === null
                                        ? "—"
                                        : `${(
                                            market.probability * 100
                                          ).toLocaleString("es-ES", {
                                            maximumFractionDigits: 1,
                                          })}%`}
                                    </strong>
                                    <small>
                                      Actualizado {dateLabel(market.observedAt)}
                                    </small>
                                  </a>
                                ))}
                              </section>
                            );
                          },
                        )}
                      </div>
                    </details>
                  </>
                ) : (
                  <p>Sin mercado disponible</p>
                )}
              </article>
            ))}
          </div>
        </section>

        <UserRankingPanel
          candidates={view.currentCandidates}
          categoryId={category.id}
          categoryName={category.name}
        />
      </div>
    </>
  );
}

function ArchiveCategory({
  category,
  view,
}: {
  category: CategoryDefinition;
  view: ArchiveCategoryView;
}) {
  return (
    <>
      <section className="category-hero archive-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <Link href="/temporadas/2026">Oscar 2026</Link>
            <span>/</span>
            <span>{category.name}</span>
          </div>
          <div className="category-title-row">
            <div>
              <p className="kicker">Archivo oficial · temporada cerrada</p>
              <h1>{category.name}</h1>
              <p>
                {view.nominees.length} nominaciones oficiales · sin
                reconstrucción de predicciones históricas
              </p>
            </div>
            <div className="category-hero-stat">
              <span>Estado</span>
              <strong>CERRADA</strong>
              <small>ceremonia de 2026</small>
            </div>
          </div>
        </div>
      </section>
      <div className="page-shell category-page-body">
        <section>
          <div className="section-heading split-heading">
            <div>
              <p className="section-index">ACADEMY</p>
              <h2>Nominados y ganador</h2>
            </div>
            <p>
              <a href={view.sourceUrl} rel="noreferrer" target="_blank">
                Archivo oficial ↗
              </a>
              {view.capturedAt
                ? ` · capturado ${dateLabel(view.capturedAt)}`
                : ""}
            </p>
          </div>
          {view.nominees.length ? (
            <div className="archive-nominees">
              {view.nominees.map((candidate) => (
                <article
                  className={candidate.winner ? "winner" : ""}
                  key={candidate.candidateId}
                >
                  <span>{candidate.winner ? "GANADOR" : "NOMINADO"}</span>
                  <h3>
                    {candidate.film ? (
                      <Link href={`/peliculas/${candidate.film.id}`}>
                        {candidate.label}
                      </Link>
                    ) : (
                      candidate.label
                    )}
                  </h3>
                  <p>{candidateSubtitle(candidate)}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="insufficient-note">
              El archivo oficial v2 todavía no está disponible en la base de
              datos.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

export function CategoryPageView({
  category,
  view,
}: {
  category: CategoryDefinition;
  view: ActiveCategoryView | ArchiveCategoryView;
}) {
  return (
    <main>
      {view.mode === "active" ? (
        <ActiveCategory category={category} view={view} />
      ) : (
        <ArchiveCategory category={category} view={view} />
      )}
    </main>
  );
}
