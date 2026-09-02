import type { Metadata } from "next";
import { requireEditorialAdmin } from "../../lib/admin/auth";
import { getEditorialDashboard } from "../../lib/admin/repository";
import {
  correctTmdbMatchAction,
  createFinalSnapshotAction,
  dismissReviewAction,
  excludeObservationAction,
  importManualManifestAction,
  importOfficialResultsAction,
  matchObservationAction,
  matchObservationToFilmAction,
  runIngestionAction,
  runPeriodicSnapshotsAction,
  updateConnectorAction,
  updateSourceAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Administración editorial",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ ok?: string; error?: string }>;
};

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const editorialStatuses = [
  "candidate",
  "sampled",
  "selected",
  "paused",
  "rejected",
] as const;
const technicalStatuses = [
  "manual",
  "prototype",
  "automated",
  "failing",
  "retired",
] as const;
const publicationStatuses = [
  "not-reviewed",
  "review-before-publish",
  "publishable",
  "replace-before-publish",
] as const;

export default async function AdminPage({ searchParams }: PageProps) {
  const [{ admin, user }, notice] = await Promise.all([
    requireEditorialAdmin(),
    searchParams,
  ]);
  const data = await getEditorialDashboard(admin);

  return (
    <main className="page-shell admin-page">
      <header className="admin-hero">
        <div>
          <p className="section-index">OPERACIONES · FASE 9</p>
          <h1>Administración editorial</h1>
          <p>
            Cola, fuentes, ingestas, cierres y resultados con motivo obligatorio
            y trazabilidad append-only.
          </p>
        </div>
        <small>{user.email}</small>
      </header>

      {notice.ok ? <p className="admin-notice success">{notice.ok}</p> : null}
      {notice.error ? (
        <p className="admin-notice error">{notice.error}</p>
      ) : null}

      <nav className="admin-index" aria-label="Secciones de administración">
        <a href="#revisiones">Revisiones · {data.reviews.length}</a>
        <a href="#fuentes">Fuentes · {data.sources.length}</a>
        <a href="#ingestas">Ingestas</a>
        <a href="#snapshots">Snapshots</a>
        <a href="#resultados">Resultados</a>
        <a href="#historial">Historial</a>
      </nav>

      <section className="admin-section" id="revisiones">
        <header>
          <p className="section-index">COLA EDITORIAL</p>
          <h2>Revisiones pendientes</h2>
          <p>
            El valor capturado nunca se sustituye; solo cambia su vínculo o
            participación.
          </p>
        </header>
        <form
          action={correctTmdbMatchAction}
          className="admin-card admin-form source-form admin-catalog-correction"
        >
          <h3 className="wide-field">
            Corregir identidad TMDB de una película
          </h3>
          <label>
            ID interno
            <input name="filmId" placeholder="slug-de-pelicula" required />
          </label>
          <label>
            ID de TMDB
            <input name="tmdbId" type="number" min={1} required />
          </label>
          <label>
            Consulta comprobada
            <input
              name="query"
              placeholder="Título usado para verificar"
              required
            />
          </label>
          <label className="wide-field">
            Motivo
            <input name="reason" minLength={4} maxLength={500} required />
          </label>
          <button className="primary-button dark-button">
            Corregir y refrescar catálogo
          </button>
        </form>
        {data.reviews.length ? (
          <div className="admin-stack">
            {data.reviews.map((review) => {
              const observation = relation(review.professional_observations);
              const connector = relation(review.source_connectors);
              const candidates = observation
                ? data.candidates.filter(
                    (candidate) =>
                      candidate.season_id === observation.season_id &&
                      (!observation.category_id ||
                        candidate.category_id === observation.category_id),
                  )
                : [];
              const films = observation
                ? data.seasonFilms.filter(
                    (item) => item.season_id === observation.season_id,
                  )
                : [];
              return (
                <article className="admin-card" key={review.id}>
                  <div className="admin-card-heading">
                    <div>
                      <span className="admin-tag">{review.kind}</span>
                      <h3>{review.subject_label}</h3>
                      <p>
                        {connector?.name ?? review.connector_id} · creada{" "}
                        {dateTime(review.created_at)}
                      </p>
                    </div>
                    <code>#{review.observation_id ?? "sin observación"}</code>
                  </div>
                  {observation ? (
                    <details>
                      <summary>Ver captura original</summary>
                      <p>{observation.original_subject}</p>
                      <pre>
                        {JSON.stringify(observation.original_value, null, 2)}
                      </pre>
                      <a
                        href={observation.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir procedencia ↗
                      </a>
                    </details>
                  ) : null}
                  {observation ? (
                    <div className="admin-form-grid">
                      {observation.category_id ? (
                        <form
                          action={matchObservationAction}
                          className="admin-form"
                        >
                          <input
                            name="observationId"
                            type="hidden"
                            value={observation.id}
                          />
                          <label>
                            Candidatura canónica
                            <select name="candidateId" required defaultValue="">
                              <option value="" disabled>
                                Seleccionar…
                              </option>
                              {candidates.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.display_label} ·{" "}
                                  {candidate.category_id}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Tipo de match
                            <select name="matchKind" defaultValue="film">
                              <option value="film">película</option>
                              <option value="person">persona</option>
                              <option value="team">equipo</option>
                              <option value="category">categoría</option>
                            </select>
                          </label>
                          <label>
                            Motivo
                            <input
                              name="reason"
                              minLength={4}
                              maxLength={500}
                              required
                            />
                          </label>
                          <button className="primary-button dark-button">
                            Vincular y publicar
                          </button>
                        </form>
                      ) : (
                        <form
                          action={matchObservationToFilmAction}
                          className="admin-form"
                        >
                          <input
                            name="observationId"
                            type="hidden"
                            value={observation.id}
                          />
                          <label>
                            Película canónica
                            <select name="filmId" required defaultValue="">
                              <option value="" disabled>
                                Seleccionar…
                              </option>
                              {films.map((item) => {
                                const film = relation(item.films);
                                return film ? (
                                  <option
                                    key={item.film_id}
                                    value={item.film_id}
                                  >
                                    {film.title}
                                  </option>
                                ) : null;
                              })}
                            </select>
                          </label>
                          <label>
                            Motivo
                            <input
                              name="reason"
                              minLength={4}
                              maxLength={500}
                              required
                            />
                          </label>
                          <button className="primary-button dark-button">
                            Vincular y publicar
                          </button>
                        </form>
                      )}
                      <form
                        action={excludeObservationAction}
                        className="admin-form compact-form"
                      >
                        <input
                          name="observationId"
                          type="hidden"
                          value={observation.id}
                        />
                        <label>
                          Motivo de exclusión
                          <input
                            name="reason"
                            minLength={4}
                            maxLength={500}
                            required
                          />
                        </label>
                        <button className="ghost-button">
                          Excluir observación
                        </button>
                      </form>
                    </div>
                  ) : (
                    <form
                      action={dismissReviewAction}
                      className="admin-form compact-form"
                    >
                      <input name="reviewId" type="hidden" value={review.id} />
                      <label>
                        Motivo
                        <input
                          name="reason"
                          minLength={4}
                          maxLength={500}
                          required
                        />
                      </label>
                      <button className="ghost-button">
                        Descartar revisión
                      </button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="admin-empty">No hay revisiones pendientes.</p>
        )}
      </section>

      <section className="admin-section" id="fuentes">
        <header>
          <p className="section-index">GOBIERNO DE FUENTES</p>
          <h2>Publicación y conectores</h2>
        </header>
        <div className="admin-stack">
          {data.sources.map((source) => (
            <article className="admin-card" key={source.id}>
              <div className="admin-card-heading">
                <div>
                  <h3>{source.name}</h3>
                  <p>
                    {source.id} · revisada {source.last_reviewed_on ?? "nunca"}
                  </p>
                </div>
                <span
                  className={`admin-tag ${source.publication_status === "publishable" ? "positive" : ""}`}
                >
                  {source.publication_status}
                </span>
              </div>
              <form
                action={updateSourceAction}
                className="admin-form source-form"
              >
                <input name="sourceId" type="hidden" value={source.id} />
                <label>
                  Editorial
                  <select
                    name="editorialStatus"
                    defaultValue={source.editorial_status}
                  >
                    {editorialStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Técnica
                  <select
                    name="technicalStatus"
                    defaultValue={source.technical_status}
                  >
                    {technicalStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Publicación
                  <select
                    name="publicationStatus"
                    defaultValue={source.publication_status}
                  >
                    {publicationStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label className="wide-field">
                  Notas
                  <textarea
                    name="notes"
                    defaultValue={source.notes ?? ""}
                    maxLength={2000}
                    rows={2}
                  />
                </label>
                <label className="wide-field">
                  Motivo
                  <input name="reason" minLength={4} maxLength={500} required />
                </label>
                <button className="primary-button dark-button">
                  Guardar fuente
                </button>
              </form>
              <div className="connector-list">
                {data.connectors
                  .filter((connector) => connector.source_id === source.id)
                  .map((connector) => (
                    <form action={updateConnectorAction} key={connector.id}>
                      <div>
                        <strong>{connector.name}</strong>
                        <small>
                          {connector.id} · último éxito{" "}
                          {dateTime(connector.last_success_at)}
                        </small>
                        {connector.last_error ? (
                          <em>{connector.last_error}</em>
                        ) : null}
                      </div>
                      <input
                        name="connectorId"
                        type="hidden"
                        value={connector.id}
                      />
                      <input
                        name="active"
                        type="hidden"
                        value={connector.is_active ? "false" : "true"}
                      />
                      <input
                        name="reason"
                        aria-label={`Motivo para ${connector.name}`}
                        placeholder="Motivo"
                        minLength={4}
                        maxLength={500}
                        required
                      />
                      <button className="ghost-button">
                        {connector.is_active ? "Pausar" : "Activar"}
                      </button>
                    </form>
                  ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section" id="ingestas">
        <header>
          <p className="section-index">IMPORTACIONES</p>
          <h2>Ejecutar y cargar</h2>
        </header>
        <div className="admin-form-grid">
          <form action={runIngestionAction} className="admin-card admin-form">
            <h3>Conectores remotos</h3>
            <label>
              Conector
              <select name="connectorId" defaultValue="all">
                <option value="all">Todos los activos</option>
                {data.connectors
                  .filter((item) => item.is_active)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Motivo
              <input
                name="reason"
                defaultValue="Ejecución editorial manual"
                required
              />
            </label>
            <button className="primary-button dark-button">
              Ejecutar ingesta
            </button>
          </form>
          <form
            action={importManualManifestAction}
            className="admin-card admin-form"
          >
            <h3>Manifiesto manual v1</h3>
            <label>
              JSON versionado
              <textarea
                name="manifest"
                rows={9}
                spellCheck={false}
                required
                placeholder='{"formatVersion":1,…}'
              />
            </label>
            <label>
              Motivo
              <input
                name="reason"
                defaultValue="Importación editorial documentada"
                required
              />
            </label>
            <button className="primary-button dark-button">
              Validar e importar
            </button>
          </form>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Inicio</th>
                <th>Conector</th>
                <th>Estado</th>
                <th>Nuevas</th>
                <th>Revisión</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {data.runs.map((run) => (
                <tr key={run.id}>
                  <td>{dateTime(run.started_at)}</td>
                  <td>{run.connector_id}</td>
                  <td>{run.status}</td>
                  <td>{run.observations_inserted}</td>
                  <td>{run.review_items_created}</td>
                  <td>{run.error_summary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section" id="snapshots">
        <header>
          <p className="section-index">CIERRES INMUTABLES</p>
          <h2>Snapshots</h2>
        </header>
        <div className="admin-form-grid">
          <form
            action={runPeriodicSnapshotsAction}
            className="admin-card admin-form"
          >
            <h3>Actualizaciones por cambios de proveedor</h3>
            <p>
              Procesa todas las programaciones activas y no duplica una
              actualización sin cambios efectivos.
            </p>
            <label>
              Motivo
              <input
                name="reason"
                defaultValue="Comprobación editorial de actualizaciones activas"
                required
              />
            </label>
            <button className="primary-button dark-button">
              Procesar periódicos
            </button>
          </form>
          <form
            action={createFinalSnapshotAction}
            className="admin-card admin-form source-form"
          >
            <h3 className="wide-field">Bloquear cierre final</h3>
            <label>
              Temporada
              <select name="seasonId">
                {data.seasons.map((season) => (
                  <option value={season.id} key={season.id}>
                    {season.ceremony_year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Categoría
              <select name="categoryId">
                {data.categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Intención
              <select name="intention" defaultValue="nomination">
                <option value="nomination">nominación</option>
                <option value="winner">ganador</option>
              </select>
            </label>
            <label>
              Tipo
              <select name="kind" defaultValue="nomination_final">
                <option value="nomination_final">cierre de nominaciones</option>
                <option value="winner_final">cierre de ganador</option>
              </select>
            </label>
            <label>
              Selección
              <input
                name="selectionSize"
                type="number"
                min={1}
                max={20}
                defaultValue={10}
                required
              />
            </label>
            <label>
              Corrige snapshot (opcional)
              <input name="correctsSnapshotId" maxLength={180} />
            </label>
            <label className="wide-field">
              Motivo
              <input
                name="reason"
                defaultValue="Cierre editorial de predicciones"
                required
              />
            </label>
            <button className="primary-button dark-button">
              Bloquear cierre
            </button>
          </form>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bloqueo</th>
                <th>Temporada</th>
                <th>Categoría</th>
                <th>Tipo</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {data.snapshots.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td>{dateTime(snapshot.locked_at)}</td>
                  <td>{snapshot.season_id}</td>
                  <td>{snapshot.category_id}</td>
                  <td>{snapshot.kind}</td>
                  <td>
                    <code>{snapshot.id}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section" id="resultados">
        <header>
          <p className="section-index">VERDAD OFICIAL</p>
          <h2>Nominaciones y ganadores</h2>
        </header>
        <form
          action={importOfficialResultsAction}
          className="admin-card admin-form"
        >
          <h3>Manifiesto oficial v2</h3>
          <p>
            Usa IDs de candidatura canónicos y una URL oficial HTTPS. Cada
            corrección crea otra versión enlazada.
          </p>
          <label>
            JSON versionado
            <textarea
              name="manifest"
              rows={12}
              spellCheck={false}
              required
              placeholder='{"formatVersion":2,"seasonId":"oscars-2027","kind":"nominations",…}'
            />
          </label>
          <label>
            Motivo
            <input
              name="reason"
              defaultValue="Publicación oficial verificada"
              required
            />
          </label>
          <button className="primary-button dark-button">
            Validar y bloquear resultados
          </button>
        </form>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Publicación</th>
                <th>Temporada</th>
                <th>Tipo</th>
                <th>Procedencia</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {data.resultSets.map((result) => (
                <tr key={result.id}>
                  <td>{dateTime(result.published_at)}</td>
                  <td>{result.season_id}</td>
                  <td>{result.kind}</td>
                  <td>
                    <a href={result.source_url}>Academy ↗</a>
                  </td>
                  <td>
                    <code>{result.id}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section" id="historial">
        <header>
          <p className="section-index">AUDITORÍA APPEND-ONLY</p>
          <h2>Historial de acciones</h2>
        </header>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Motivo</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              {data.actions.map((action) => (
                <tr key={action.id}>
                  <td>{dateTime(action.created_at)}</td>
                  <td>{action.action_type}</td>
                  <td>
                    {action.entity_type}:{action.entity_id}
                  </td>
                  <td>{action.reason}</td>
                  <td>
                    <code>{action.admin_user_id.slice(0, 8)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
