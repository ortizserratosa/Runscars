import type { Metadata } from "next";
import Link from "next/link";
import { Movement } from "../../components/Movement";
import { candidates, categories, snapshots } from "../../data";

export const metadata: Metadata = {
  title: "Oscar 2027",
  description: "Temporada Oscar 2027 · películas de 2026.",
};

export default function SeasonPage() {
  return (
    <main>
      <section className="season-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <span>Temporadas</span>
          </div>
          <div className="season-title-row">
            <div>
              <p className="kicker">Temporada activa</p>
              <h1>Oscar <em>2027</em></h1>
              <p>Películas de 2026 · corte editorial del 24 de julio</p>
            </div>
            <div className="season-stamp" aria-label="Temporada en preparación">
              <span>Estado</span>
              <strong>EN PREPARACIÓN</strong>
              <small>69 observaciones trazables</small>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell season-layout">
        <div className="season-main">
          <div className="section-heading compact-heading">
            <div>
              <p className="section-index">CATEGORÍAS</p>
              <h2>Ocho carreras, por separado</h2>
            </div>
          </div>

          <div className="category-grid">
            {categories.map((category, index) => {
              const content = (
                <>
                  <span className="category-index">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{category.name}</h3>
                    <p>{category.status}</p>
                  </div>
                  <strong>{category.count}</strong>
                  <span className="category-arrow" aria-hidden="true">
                    {category.featured ? "↗" : "·"}
                  </span>
                </>
              );
              return category.featured ? (
                <Link className="category-card active-category" href="/temporadas/2027/mejor-pelicula" key={category.name}>
                  {content}
                </Link>
              ) : (
                <article className="category-card muted-category" key={category.name}>
                  {content}
                </article>
              );
            })}
          </div>

          <div className="season-leaders">
            <div className="section-heading compact-heading">
              <div>
                <p className="section-index">MEJOR PELÍCULA</p>
                <h2>Líderes del corte</h2>
              </div>
              <Link className="text-link" href="/temporadas/2027/mejor-pelicula">
                Ver clasificación completa
              </Link>
            </div>
            <div className="mini-leaderboard">
              {candidates.slice(0, 5).map((candidate, index) => (
                <div className="mini-leader-row" key={candidate.id}>
                  <span className="mini-rank">{index + 1}</span>
                  <Link href={candidate.id === "the-odyssey" ? "/peliculas/the-odyssey" : "/temporadas/2027/mejor-pelicula"}>
                    {candidate.title}
                  </Link>
                  <span>{candidate.coverage} fuentes</span>
                  <Movement value={candidate.movement} />
                  <strong>{candidate.score.toLocaleString("es-ES")} pts</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="season-sidebar">
          <div className="sidebar-card">
            <p className="section-index">CALENDARIO DEL FIXTURE</p>
            <ol className="timeline-list">
              {snapshots.map((snapshot, index) => (
                <li className={index === snapshots.length - 1 ? "current" : ""} key={snapshot.id}>
                  <span>{snapshot.shortDate}</span>
                  <div>
                    <strong>{snapshot.label}</strong>
                    <small>{snapshot.sourceCount} {snapshot.sourceCount === 1 ? "lista" : "listas"}</small>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="sidebar-card source-status-card">
            <p className="section-index">FUENTES</p>
            <div className="big-number">28</div>
            <p>seleccionadas por calidad para el catálogo del MVP</p>
            <div className="status-row">
              <span><i className="status-dot green" /> 4 en este consenso</span>
              <span><i className="status-dot amber" /> 24 en otras funciones u oleadas</span>
            </div>
            <Link href="/fuentes/awardswatch">Examinar una fuente →</Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
