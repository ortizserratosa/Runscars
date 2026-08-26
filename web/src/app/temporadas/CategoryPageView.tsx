import Link from "next/link";
import { Movement } from "../components/Movement";
import type {
  ActiveCategoryView,
  ArchiveCategoryView,
} from "../../lib/categories/data";
import type { PublicCategoryId } from "../../lib/categories/config";
import { localeTag, localizedPath, type Locale } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { PublicRankingModule } from "../comunidad/PublicRankingModule";
import { UserRankingPanel } from "./UserRankingPanel";

type CategoryDefinition = {
  id: PublicCategoryId;
  slug: string;
  name: string;
  nameEn: string;
  shortName: string;
  shortNameEn: string;
};

function dateLabel(value: string, locale: Locale) {
  if (!value) return locale === "en" ? "no capture" : "sin captura";
  return new Intl.DateTimeFormat(localeTag(locale), {
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
  locale,
}: {
  category: CategoryDefinition;
  view: ActiveCategoryView;
  locale: Locale;
}) {
  const en = locale === "en";
  const categoryName = en ? category.nameEn : category.name;
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
              <Link
                href={localizedPath(`/peliculas/${candidate.film.id}`, locale)}
              >
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
            {candidate.scoreOutOf100.toLocaleString(localeTag(locale), {
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
          <Movement locale={locale} value={candidate.movement} />
        ) : (
          <span
            aria-label={
              en ? "No previous update" : "Sin actualización anterior"
            }
            className="movement neutral"
            title={en ? "No previous update" : "Sin actualización anterior"}
          >
            —
          </span>
        )}
      </div>
      <details className="category-source-details">
        <summary>
          {en ? "View provenance and calculation" : "Ver procedencia y cálculo"}
        </summary>
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
                    ? `${en ? "Published" : "Publicada"} ${dateLabel(source.publishedAt, locale)}`
                    : en
                      ? "Verified publication"
                      : "Publicación verificada"}
                </small>
              </span>
              <span className="source-position">
                {source.appearanceKind === "ordered"
                  ? `${en ? "Rank" : "Puesto"} ${source.rank} ${en ? "of" : "de"} ${source.listLength}`
                  : source.appearanceKind === "selection"
                    ? en
                      ? "selection"
                      : "selección"
                    : en
                      ? "absent"
                      : "ausente"}
              </span>
              <strong>
                {source.points.toLocaleString(localeTag(locale), {
                  maximumFractionDigits: 3,
                })}{" "}
                {en ? "pts" : "pts"}
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
            <Link href={localizedPath("/", locale)}>
              {en ? "Home" : "Inicio"}
            </Link>
            <span>/</span>
            <Link href={localizedPath("/temporadas/2027", locale)}>
              Oscar 2027
            </Link>
            <span>/</span>
            <span>{categoryName}</span>
          </div>
          <div className="category-title-row">
            <div>
              <p className="kicker">
                {en
                  ? "Professional nomination predictions"
                  : "Predicción profesional de nominaciones"}
              </p>
              <h1>{categoryName}</h1>
              <p>
                {aggregate?.ranking.length ?? 0}{" "}
                {en ? "candidates" : "candidaturas"} ·{" "}
                {aggregate?.applicableSourceCount ?? 0}{" "}
                {en ? "outlets" : "medios"}
              </p>
            </div>
            <div className="category-hero-stat">
              <span>{en ? "Coverage" : "Cobertura"}</span>
              <strong>{aggregate?.orderedSourceCount ?? 0}</strong>
              <small>
                {aggregate?.isConsensus
                  ? en
                    ? "sources in consensus"
                    : "fuentes con consenso"
                  : en
                    ? "sources · consensus pending"
                    : "fuentes · consenso pendiente"}
              </small>
            </div>
          </div>
        </div>
      </section>

      <div className="page-shell category-page-body">
        <section className="snapshot-panel">
          <div className="snapshot-heading">
            <div>
              <p className="section-index">{en ? "UPDATE" : "ACTUALIZACIÓN"}</p>
              <h2>{en ? "Verified data" : "Datos verificados"}</h2>
            </div>
            <div className="snapshot-readout">
              <span>
                {view.snapshot
                  ? dateLabel(view.snapshot.lockedAt, locale)
                  : en
                    ? "pending"
                    : "pendiente"}
              </span>
              <strong>
                {view.dataState === "database"
                  ? en
                    ? "PUBLISHED"
                    : "PUBLICADA"
                  : view.dataState === "fixture"
                    ? en
                      ? "DEMO"
                      : "DEMOSTRACIÓN"
                    : en
                      ? "PENDING"
                      : "PENDIENTE"}
              </strong>
            </div>
          </div>
          {view.snapshot ? (
            <>
              <nav
                aria-label={en ? "Select update" : "Seleccionar actualización"}
                className="snapshot-selector"
              >
                {view.snapshot.cuts.map((cut, index) => (
                  <Link
                    aria-current={cut.isSelected ? "page" : undefined}
                    className={cut.isSelected ? "active" : undefined}
                    href={localizedPath(
                      `/temporadas/2027/${category.slug}?corte=${encodeURIComponent(
                        cut.id,
                      )}`,
                      locale,
                    )}
                    key={cut.id}
                    scroll={false}
                  >
                    <span>
                      {index === 0
                        ? en
                          ? "Current"
                          : "Actual"
                        : en
                          ? "Effective change"
                          : "Cambio efectivo"}
                    </span>
                    <strong>{dateLabel(cut.lockedAt, locale)}</strong>
                    <small>
                      {cut.changedSources.length
                        ? `${en ? "Changed" : "Cambió"}: ${cut.changedSources.join(", ")}`
                        : en
                          ? "First available state"
                          : "Primer estado disponible"}
                    </small>
                  </Link>
                ))}
              </nav>
              <div className="locked-snapshot-note">
                <div>
                  <strong>
                    {view.snapshot.isLatest
                      ? en
                        ? "Current professional consensus"
                        : "Consenso profesional vigente"
                      : en
                        ? "Selected historical update"
                        : "Actualización histórica seleccionada"}
                  </strong>
                  <span>
                    {aggregate?.includedObservationIds.length ?? 0}{" "}
                    {en
                      ? "verified observations preserved with their provenance"
                      : "observaciones contrastadas y conservadas con su procedencia"}
                  </span>
                </div>
                <div className="snapshot-comparison">
                  <span>
                    {en
                      ? "Only an effective source change creates an update"
                      : "Solo un cambio efectivo de proveedor crea una actualización"}
                  </span>
                  {view.snapshot.previous ? (
                    <strong>
                      {en
                        ? "Changes from the update on"
                        : "Cambios frente a la actualización del"}{" "}
                      {dateLabel(view.snapshot.previous.lockedAt, locale)}
                    </strong>
                  ) : (
                    <strong>
                      {en
                        ? "First available update · no previous comparison"
                        : "Primera actualización disponible · sin comparación anterior"}
                    </strong>
                  )}
                </div>
              </div>
              {view.sourceFreshness.length ? (
                <details className="source-freshness-panel">
                  <summary>
                    {en ? "Status and dates for" : "Estado y fechas de"}{" "}
                    {view.sourceFreshness.length} {en ? "sources" : "fuentes"}
                  </summary>
                  {!view.snapshot.isLatest ? (
                    <p className="historical-freshness-note">
                      {en
                        ? "Publication and change dates belong to the selected update. The technical check reflects the connector's current state."
                        : "Publicación y cambio pertenecen a la actualización seleccionada. La comprobación técnica refleja el estado actual del conector."}
                    </p>
                  ) : null}
                  <div className="source-freshness-grid">
                    {view.sourceFreshness.map((source) => (
                      <article key={source.sourceId}>
                        <div>
                          <Link
                            href={localizedPath(
                              `/fuentes/${source.sourceId}`,
                              locale,
                            )}
                          >
                            {source.sourceName}
                          </Link>
                          <span
                            className={`source-health-chip ${source.status}`}
                          >
                            {source.status === "ok"
                              ? en
                                ? "Healthy"
                                : "Correcta"
                              : source.status === "failed"
                                ? en
                                  ? "Incident"
                                  : "Incidencia"
                                : en
                                  ? "No status"
                                  : "Sin estado"}
                          </span>
                        </div>
                        <dl>
                          <div>
                            <dt>{en ? "Published" : "Publicada"}</dt>
                            <dd>
                              {source.publishedAt
                                ? dateLabel(source.publishedAt, locale)
                                : en
                                  ? "no date"
                                  : "sin fecha"}
                            </dd>
                          </div>
                          <div>
                            <dt>
                              {en ? "Ranking changed" : "Cambió el ranking"}
                            </dt>
                            <dd>{dateLabel(source.lastChangedAt, locale)}</dd>
                          </div>
                          <div>
                            <dt>
                              {en
                                ? "Last successful check"
                                : "Comprobación correcta"}
                            </dt>
                            <dd>
                              {source.lastSuccessfulCheckAt
                                ? dateLabel(
                                    source.lastSuccessfulCheckAt,
                                    locale,
                                  )
                                : en
                                  ? "not automated"
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
              {en
                ? "There is no publishable update for this category yet."
                : "Aún no existe una actualización publicable para esta categoría."}
            </p>
          )}
          {view.dataState === "fixture" ? (
            <p className="calculation-cut-note">
              {en
                ? "Demo data is available only in development and tests."
                : "Datos de demostración disponibles solo en desarrollo y pruebas."}
            </p>
          ) : null}
        </section>

        <section className="leaderboard-section">
          <div className="section-heading split-heading">
            <div>
              <p className="section-index">{en ? "CONSENSUS" : "CONSENSO"}</p>
              <h2>{en ? "Professional consensus" : "Consenso profesional"}</h2>
            </div>
            <p>
              {en
                ? "Each outlet counts once. Unordered selections add coverage, never consensus points."
                : "Cada medio pesa una vez. Las selecciones sin orden aportan cobertura, nunca puntos de consenso."}
            </p>
          </div>
          {ranking.length ? (
            <div className="leaderboard">
              <div className="leaderboard-head" aria-hidden="true">
                <span>{en ? "Pos." : "Pos."}</span>
                <span>{en ? "Candidate" : "Candidatura"}</span>
                <span>{en ? "Backing" : "Respaldo"}</span>
                <span>{en ? "Points" : "Puntos"}</span>
                <span>{en ? "Change" : "Cambio"}</span>
              </div>
              {visibleRanking.map(renderCandidate)}
              {remainingRanking.length ? (
                <details className="leaderboard-more">
                  <summary>
                    {en ? "View positions" : "Ver posiciones"} 11–
                    {ranking.length}
                  </summary>
                  <div>{remainingRanking.map(renderCandidate)}</div>
                </details>
              ) : null}
            </div>
          ) : (
            <p className="insufficient-note">
              {en
                ? "Four comparable sources are still needed to publish this category."
                : "Aún faltan cuatro fuentes comparables para publicar esta categoría."}
            </p>
          )}
        </section>

        <section className="market-panel" aria-labelledby="market-title">
          <div className="section-heading split-heading">
            <div>
              <p className="section-index">{en ? "MARKETS" : "MERCADOS"}</p>
              <h2 id="market-title">
                {en ? "Separate signals" : "Señales separadas"}
              </h2>
            </div>
            <p>
              {en
                ? "Kalshi and Polymarket are shown by provider. There is no market consensus and their prices do not participate in professional predictions. They reflect the latest market capture, not the selected professional update."
                : "Kalshi y Polymarket se muestran por proveedor. No existe consenso de mercados y sus precios no participan en la predicción profesional. Reflejan su última captura y no la actualización profesional seleccionada."}
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
                                ? en
                                  ? "Strongest nomination signal"
                                  : "Mayor señal de nominación"
                                : en
                                  ? "Strongest winner signal"
                                  : "Mayor señal de ganador"}
                            </span>
                            <strong>{leader.outcome}</strong>
                            <em>
                              {leader.probability === null
                                ? "—"
                                : `${(leader.probability * 100).toLocaleString(
                                    localeTag(locale),
                                    { maximumFractionDigits: 1 },
                                  )}%`}
                            </em>
                            <small>
                              {en ? "Observed" : "Observado"}{" "}
                              {dateLabel(leader.observedAt, locale)}
                            </small>
                          </a>
                        );
                      })}
                    </div>
                    <details className="market-details">
                      <summary>
                        {en ? "View" : "Ver"} {view.markets[provider].length}{" "}
                        {en ? "contracts" : "contratos"}
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
                                    ? en
                                      ? "Nomination"
                                      : "Nominación"
                                    : en
                                      ? "Winner"
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
                                          ).toLocaleString(localeTag(locale), {
                                            maximumFractionDigits: 1,
                                          })}%`}
                                    </strong>
                                    <small>
                                      {en ? "Updated" : "Actualizado"}{" "}
                                      {dateLabel(market.observedAt, locale)}
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
                  <p>{en ? "No market available" : "Sin mercado disponible"}</p>
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
        <PublicRankingModule
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
  locale,
}: {
  category: CategoryDefinition;
  view: ArchiveCategoryView;
  locale: Locale;
}) {
  const en = locale === "en";
  const categoryName = en ? category.nameEn : category.name;
  return (
    <>
      <section className="category-hero archive-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href={localizedPath("/", locale)}>
              {en ? "Home" : "Inicio"}
            </Link>
            <span>/</span>
            <Link href={localizedPath("/temporadas/2026", locale)}>
              Oscar 2026
            </Link>
            <span>/</span>
            <span>{categoryName}</span>
          </div>
          <div className="category-title-row">
            <div>
              <p className="kicker">
                {en
                  ? "Official archive · completed season"
                  : "Archivo oficial · temporada cerrada"}
              </p>
              <h1>{categoryName}</h1>
              <p>
                {view.nominees.length}{" "}
                {en
                  ? "official nominations · no reconstruction of historical predictions"
                  : "nominaciones oficiales · sin reconstrucción de predicciones históricas"}
              </p>
            </div>
            <div className="category-hero-stat">
              <span>{en ? "Status" : "Estado"}</span>
              <strong>{en ? "CLOSED" : "CERRADA"}</strong>
              <small>{en ? "2026 ceremony" : "ceremonia de 2026"}</small>
            </div>
          </div>
        </div>
      </section>
      <div className="page-shell category-page-body">
        <section>
          <div className="section-heading split-heading">
            <div>
              <p className="section-index">ACADEMY</p>
              <h2>{en ? "Nominees and winner" : "Nominados y ganador"}</h2>
            </div>
            <p>
              <a href={view.sourceUrl} rel="noreferrer" target="_blank">
                {en ? "Official archive ↗" : "Archivo oficial ↗"}
              </a>
              {view.capturedAt
                ? ` · ${en ? "captured" : "capturado"} ${dateLabel(view.capturedAt, locale)}`
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
                  <span>
                    {candidate.winner
                      ? en
                        ? "WINNER"
                        : "GANADOR"
                      : en
                        ? "NOMINEE"
                        : "NOMINADO"}
                  </span>
                  <h3>
                    {candidate.film ? (
                      <Link
                        href={localizedPath(
                          `/peliculas/${candidate.film.id}`,
                          locale,
                        )}
                      >
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
              {en
                ? "The official v2 archive is not available in the database yet."
                : "El archivo oficial v2 todavía no está disponible en la base de datos."}
            </p>
          )}
        </section>
      </div>
    </>
  );
}

export async function CategoryPageView({
  category,
  view,
}: {
  category: CategoryDefinition;
  view: ActiveCategoryView | ArchiveCategoryView;
}) {
  const locale = await getRequestLocale();
  return (
    <main>
      {view.mode === "active" ? (
        <ActiveCategory category={category} locale={locale} view={view} />
      ) : (
        <ArchiveCategory category={category} locale={locale} view={view} />
      )}
    </main>
  );
}
