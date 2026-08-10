import Link from "next/link";
import { Movement } from "./components/Movement";
import { PosterBlock } from "./components/PosterBlock";
import { filmHref } from "../data/films";
import { getCategoryView } from "../lib/categories/data";

export const dynamic = "force-dynamic";

const tones = ["violet", "acid", "rust"] as const;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

function sourceDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function Home() {
  const categoryView = await getCategoryView(2027, "best-picture");
  if (categoryView.mode !== "active") {
    throw new Error("La portada necesita la temporada activa de Oscar 2027");
  }
  const liveRanking = categoryView.aggregate?.ranking ?? [];
  const ranking = liveRanking.map((candidate, index) => ({
    id: candidate.film?.id ?? candidate.candidateId,
    href: candidate.film
      ? filmHref(candidate.film.id)
      : "/temporadas/2027/mejor-pelicula",
    title: candidate.label,
    score: candidate.scoreOutOf100,
    coverage: `${candidate.appearances}/${candidate.applicableSourceCount}`,
    firsts: candidate.firstPlaceCount,
    movement: candidate.movement,
    tone: tones[index % tones.length],
    contributions: candidate.sourceContributions,
  }));
  const topThree = ranking.slice(0, 3);
  const leader = topThree[0];
  if (!leader) {
    throw new Error(
      "La portada necesita un corte publicable de Mejor película",
    );
  }
  const rising = categoryView.snapshot?.previous
    ? ranking.find(
        (candidate) => candidate.movement !== null && candidate.movement > 0,
      )
    : null;
  const currentDate = categoryView.snapshot
    ? dateLabel(categoryView.snapshot.lockedAt)
    : "actualización pendiente";
  const liveReceipts = leader.contributions
    .filter((source) => source.appeared)
    .map((source) => ({
      name: source.sourceName,
      detail:
        source.appearanceKind === "ordered"
          ? `${leader.title} · #${source.rank}`
          : `${leader.title} · selección`,
      date: source.publishedAt
        ? `Publicada ${sourceDateLabel(source.publishedAt)}`
        : "Publicación verificada",
      href: `/fuentes/${source.sourceId}`,
    }));
  const receipts = liveReceipts.length
    ? liveReceipts
    : [
        {
          name: "Consenso profesional",
          detail: leader.title,
          date: "Actualización pendiente",
          href: leader.href,
        },
      ];

  return (
    <main>
      <section className="home-hero page-shell">
        <div className="eyebrow-row">
          <span className="eyebrow">Cuaderno de temporada · {currentDate}</span>
          <span className="data-note">
            {categoryView.aggregate?.orderedSourceCount ?? 0} listas ordenadas ·{" "}
            {ranking.length} películas
          </span>
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="kicker">Oscar 2027 · películas de 2026</p>
            <h1>
              La carrera,
              <br />
              <em>con los recibos.</em>
            </h1>
            <p className="hero-intro">
              Sigue qué películas suben, quién las respalda y cómo cambia el
              consenso. Cada posición enlaza con la publicación que la sostiene.
            </p>
            <div className="hero-actions">
              <Link
                className="primary-button"
                href="/temporadas/2027/mejor-pelicula"
              >
                Ver Mejor película <span aria-hidden="true">↗</span>
              </Link>
              <Link className="text-link" href="/temporadas/2027">
                Explorar temporada
              </Link>
            </div>
          </div>

          <div className="hero-board">
            <div className="hero-board-label">
              <span>Líder del corte</span>
              <span>Consenso</span>
            </div>
            <Link href={leader.href}>
              <PosterBlock
                title={leader.title}
                tone="violet"
                number="01"
                size="large"
              />
            </Link>
            <div className="leader-score">
              <div>
                <strong>
                  {leader.score.toLocaleString("es-ES", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </strong>
                <span>puntos Borda / 100</span>
              </div>
              <div
                className="score-meter"
                aria-label={`${leader.score.toLocaleString("es-ES")} puntos de 100`}
              >
                <span style={{ width: `${leader.score}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ticker" aria-label="Resumen del último corte">
        <div className="page-shell ticker-inner">
          <span className="ticker-label">Último corte</span>
          <Link href={leader.href}>{leader.title} lidera el consenso</Link>
          <span className="ticker-separator" aria-hidden="true">
            ◆
          </span>
          {rising ? (
            <Link href={rising.href}>
              {rising.title} sube {rising.movement}{" "}
              {rising.movement === 1 ? "puesto" : "puestos"}
            </Link>
          ) : (
            <span>Sin subidas en las primeras posiciones</span>
          )}
          <span className="ticker-separator" aria-hidden="true">
            ◆
          </span>
          <span>
            {categoryView.snapshot?.previous
              ? `Comparado con el corte real del ${dateLabel(
                  categoryView.snapshot.previous.lockedAt,
                )}`
              : "Primer corte disponible"}
          </span>
        </div>
      </section>

      <section className="page-shell section-block">
        <div className="section-heading split-heading">
          <div>
            <p className="section-index">01 / CONSENSO</p>
            <h2>La carrera ahora</h2>
          </div>
          <p>
            Orden Borda normalizado entre rankings profesionales aplicables. No
            representa una probabilidad.
          </p>
        </div>

        <div className="podium-grid">
          {topThree.map((candidate, index) => (
            <Link
              className={`podium-card podium-${index + 1}`}
              href={candidate.href}
              key={candidate.id}
            >
              <PosterBlock
                title={candidate.title}
                tone={candidate.tone}
                number={`0${index + 1}`}
                size={index === 0 ? "medium" : "small"}
              />
              <div className="podium-copy">
                <div>
                  <span className="rank-label">Nº {index + 1}</span>
                  {categoryView.snapshot?.previous ? (
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
                <h3>{candidate.title}</h3>
                <p>
                  {candidate.coverage} fuentes · {candidate.firsts} primeras
                  posiciones
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="signals-section">
        <div className="page-shell">
          <div className="section-heading split-heading light-heading">
            <div>
              <p className="section-index">02 / TRES LECTURAS</p>
              <h2>Consenso, evolución y tu lista.</h2>
            </div>
            <p>
              La historia profesional y la opinión personal permanecen
              separadas.
            </p>
          </div>

          <div className="signal-grid">
            <article className="signal-card prediction-card">
              <span className="signal-number">A</span>
              <p className="signal-type">Predicciones</p>
              <h3>¿Quién aparece en las listas?</h3>
              <div className="signal-stat">
                <strong>{leader.coverage}</strong>
                <span>
                  fuentes sitúan a{" "}
                  <Link href={leader.href}>{leader.title}</Link>
                </span>
              </div>
              <Link href="/temporadas/2027/mejor-pelicula">
                Abrir consenso →
              </Link>
            </article>

            <article className="signal-card evolution-card">
              <span className="signal-number">B</span>
              <p className="signal-type">Evolución</p>
              <h3>¿Qué cambió de verdad?</h3>
              <div className="signal-stat">
                <strong>{rising ? `+${rising.movement}` : "="}</strong>
                <span>
                  {rising ? (
                    <Link href={rising.href}>{rising.title}</Link>
                  ) : (
                    "sin subidas en las primeras posiciones"
                  )}
                </span>
              </div>
              <Link href="/temporadas/2027/mejor-pelicula">
                Comparar cortes reales →
              </Link>
            </article>

            <article className="signal-card community-card">
              <span className="signal-number">C</span>
              <p className="signal-type">Comunidad</p>
              <h3>Tu ranking, con tu privacidad</h3>
              <div className="signal-stat">
                <strong>ACTIVA</strong>
                <span>una señal separada del consenso profesional</span>
              </div>
              <Link href="/acceso">Crear mi perfil →</Link>
            </article>
          </div>
        </div>
      </section>

      <section className="page-shell section-block evidence-section">
        <div className="evidence-copy">
          <p className="section-index">03 / TRAZABILIDAD</p>
          <h2>De la posición a la publicación.</h2>
          <p>
            Cada movimiento conserva fuente, autor, fecha, valor original y
            momento de captura. El contexto nunca se disfraza de voto.
          </p>
          <Link className="primary-button dark-button" href="/fuentes">
            Ver una fuente por dentro
          </Link>
        </div>
        <div className="evidence-receipts">
          <div className="receipt-stack" aria-label="Fuentes destacadas">
            {receipts.slice(0, 3).map((receipt, index) => (
              <div
                className={`receipt receipt-${["one", "two", "three"][index]}`}
                key={receipt.name}
              >
                <span>{receipt.name}</span>
                <strong>
                  <Link href={receipt.href}>{receipt.detail}</Link>
                </strong>
                <small>{receipt.date}</small>
              </div>
            ))}
          </div>
          <details className="receipt-source-list">
            <summary>Las {receipts.length} fuentes del líder</summary>
            <ul aria-label="Fuentes del corte vigente">
              {receipts.map((receipt) => (
                <li key={receipt.name}>
                  <Link href={receipt.href}>{receipt.name}</Link>
                  <span>{receipt.detail}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>
    </main>
  );
}
