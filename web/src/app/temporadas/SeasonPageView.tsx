import Link from "next/link";

type CategorySummary = {
  id: string;
  slug: string;
  name: string;
  candidateCount: number;
  orderedSourceCount: number;
  applicableSourceCount: number;
  updatedAt: string | null;
  isPublic: boolean;
};

export function SeasonPageView({
  year,
  eligibilityYear,
  status,
  categories,
}: {
  year: 2026 | 2027;
  eligibilityYear: number;
  status: "ACTIVA" | "CERRADA";
  categories: CategorySummary[];
}) {
  const active = year === 2027;
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
              <p className="kicker">
                {active ? "Temporada activa" : "Archivo oficial"}
              </p>
              <h1>
                Oscar <em>{year}</em>
              </h1>
              <p>
                Películas de {eligibilityYear} ·{" "}
                {active
                  ? "predicciones profesionales"
                  : "nominados y ganadores oficiales"}
              </p>
            </div>
            <div className="season-stamp">
              <span>Estado</span>
              <strong>{status}</strong>
              <small>
                {categories.filter((category) => category.isPublic).length}/8
                categorías disponibles
              </small>
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
            {categories.map((category, index) => (
              <Link
                className={`category-card ${
                  category.isPublic ? "active-category" : "muted-category"
                }`}
                href={`/temporadas/${year}/${category.slug}`}
                key={category.id}
              >
                <span className="category-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{category.name}</h3>
                  <p>
                    {active
                      ? `${category.orderedSourceCount} rankings ordenados · ${category.applicableSourceCount} medios`
                      : `${category.candidateCount} nominados oficiales`}
                  </p>
                </div>
                <strong>{category.candidateCount || "—"}</strong>
                <span className="category-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            ))}
          </div>
        </div>
        <aside className="season-sidebar">
          <div className="sidebar-card source-status-card">
            <p className="section-index">
              {active ? "COBERTURA PROFESIONAL" : "ARCHIVO"}
            </p>
            <div className="big-number">
              {active
                ? Math.min(
                    ...categories.map(
                      (category) => category.orderedSourceCount,
                    ),
                  )
                : categories.reduce(
                    (sum, category) => sum + category.candidateCount,
                    0,
                  )}
            </div>
            <p>
              {active
                ? "mínimo de rankings automáticos ordenados por categoría"
                : "candidaturas oficiales entre las ocho categorías"}
            </p>
            <div className="status-row">
              <span>
                <i className="status-dot green" /> señales separadas
              </span>
              <span>
                <i className="status-dot amber" /> procedencia visible
              </span>
            </div>
            <Link href={active ? "/temporadas/2026" : "/temporadas/2027"}>
              {active ? "Abrir archivo 2026" : "Volver a Oscar 2027"} →
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
