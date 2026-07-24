import Link from "next/link";
import { Movement } from "./components/Movement";
import { PosterBlock } from "./components/PosterBlock";
import {
  calculationCuts,
  consensusCandidates,
} from "../data/aggregation-presentation";
import { getReferenceCriticalReception } from "../data/phase6-reference";
import { filmHref } from "../data/films";

const topThree = consensusCandidates.slice(0, 3);
const leader = topThree[0];
const currentCut = calculationCuts.at(-1)!;
const fjordPosition =
  consensusCandidates.findIndex((candidate) => candidate.id === "fjord") + 1;
const odysseyCritical = getReferenceCriticalReception("the-odyssey").scores[0];

export default function Home() {
  return (
    <main>
      <section className="home-hero page-shell">
        <div className="eyebrow-row">
          <span className="eyebrow">
            Cuaderno de temporada · {currentCut.date}
          </span>
          <span className="data-note">
            {currentCut.sourceCount} listas ordenadas ·{" "}
            {consensusCandidates.length} películas
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
              consenso. Crítica, predicciones y comunidad, sin mezclarlas.
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
              <span>La favorita hoy</span>
              <span>Consenso</span>
            </div>
            <Link href={filmHref(leader.id)}>
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
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
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
          <Link href={filmHref(leader.id)}>
            {leader.title} conserva el nº 1
          </Link>
          <span className="ticker-separator" aria-hidden="true">
            ◆
          </span>
          <Link href={filmHref("fjord")}>Fjord sube al nº {fjordPosition}</Link>
          <span className="ticker-separator" aria-hidden="true">
            ◆
          </span>
          <span>Next Best Picture completa el cuarto listado</span>
        </div>
      </section>

      <section className="page-shell section-block">
        <div className="section-heading split-heading">
          <div>
            <p className="section-index">01 / CONSENSO</p>
            <h2>La carrera ahora</h2>
          </div>
          <p>
            Orden Borda normalizado entre las cuatro listas aplicables del
            fixture. No representa una probabilidad.
          </p>
        </div>

        <div className="podium-grid">
          {topThree.map((candidate, index) => (
            <Link
              className={`podium-card podium-${index + 1}`}
              href={filmHref(candidate.id)}
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
                  <Movement value={candidate.movement} />
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
              <p className="section-index">02 / TRES SEÑALES</p>
              <h2>Cada pregunta, su medida.</h2>
            </div>
            <p>
              Ninguna cifra mezcla voces profesionales con opinión de usuarios.
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
                  <Link href={filmHref(leader.id)}>{leader.title}</Link>
                </span>
              </div>
              <Link href="/temporadas/2027/mejor-pelicula">
                Abrir consenso →
              </Link>
            </article>

            <article className="signal-card critics-card">
              <span className="signal-number">B</span>
              <p className="signal-type">Crítica</p>
              <h3>¿Cómo está siendo recibida?</h3>
              <div className="signal-stat">
                <strong>{odysseyCritical.originalDisplay}</strong>
                <span>
                  <Link href={filmHref("the-odyssey")}>The Odyssey</Link> · The
                  Guardian
                </span>
              </div>
              <Link href="/peliculas/the-odyssey">Ver puntuaciones →</Link>
            </article>

            <article className="signal-card community-card">
              <span className="signal-number">C</span>
              <p className="signal-type">Tu ranking</p>
              <h3>¿Cómo ordenarías tú la carrera?</h3>
              <div className="signal-stat">
                <strong>01—10</strong>
                <span>simulación local, fuera del consenso</span>
              </div>
              <Link href="/temporadas/2027/mejor-pelicula#mi-ranking">
                Crear ranking →
              </Link>
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
          <Link
            className="primary-button dark-button"
            href="/fuentes/awardswatch"
          >
            Ver una fuente por dentro
          </Link>
        </div>
        <div className="receipt-stack" aria-label="Ejemplos de fuentes">
          <div className="receipt receipt-one">
            <span>AwardsWatch</span>
            <strong>
              <Link href={filmHref("the-odyssey")}>The Odyssey</Link> · #1
            </strong>
            <small>Mark Johnson · 15 jul 2026</small>
          </div>
          <div className="receipt receipt-two">
            <span>Awards Daily</span>
            <strong>
              <Link href={filmHref("project-hail-mary")}>
                Project Hail Mary
              </Link>{" "}
              · #1
            </strong>
            <small>Sasha Stone · 4 jul 2026</small>
          </div>
          <div className="receipt receipt-three">
            <span>Next Best Picture</span>
            <strong>
              <Link href={filmHref("the-odyssey")}>The Odyssey</Link> · #1
            </strong>
            <small>Equipo editorial · 23 jul 2026</small>
          </div>
        </div>
      </section>
    </main>
  );
}
