import type { Metadata } from "next";
import Link from "next/link";
import { awardsWatchRadar, awardsWatchRanking } from "../../data";
import { filmHrefForLabel } from "../../../data/films";

export const metadata: Metadata = {
  title: "AwardsWatch · Fuente",
  description: "Trazabilidad de AwardsWatch en el fixture de Runscars.",
};

const sourceUrl =
  "https://awardswatch.com/2027-oscar-predictions-the-awards-alchemist-looks-to-the-aegean-sea-for-oscar-clarity/";

export default function SourcePage() {
  return (
    <main>
      <section className="source-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <span>Fuentes</span>
          </div>
          <div className="source-title-row">
            <div className="source-logo-block" aria-hidden="true">
              <span>AW</span>
              <small>EST. 1999</small>
            </div>
            <div>
              <p className="kicker">Fuente seleccionada · Predicción</p>
              <h1>
                Awards<em>Watch</em>
              </h1>
              <p>
                Rankings y análisis firmados sobre la temporada de premios. Esta
                captura aporta una lista ordenada y un bloque no ordenado.
              </p>
            </div>
            <a
              className="primary-button"
              href={sourceUrl}
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
          <div className="source-capture-header">
            <div>
              <p className="section-index">CAPTURA ACTIVA</p>
              <h2>Best Picture · 15 jul 2026</h2>
              <p>
                “The Awards Alchemist Looks to the Aegean Sea for Oscar Clarity”
              </p>
            </div>
            <span className="verified-badge">✓ Procedencia verificada</span>
          </div>

          <div className="capture-metadata">
            <div>
              <span>Autor</span>
              <strong>Mark Johnson</strong>
            </div>
            <div>
              <span>Capturada</span>
              <strong>24 jul 2026 · 11:17</strong>
            </div>
            <div>
              <span>Intención</span>
              <strong>Nominación</strong>
            </div>
            <div>
              <span>Extractor</span>
              <strong>manual-v1</strong>
            </div>
          </div>

          <div className="source-ranking-section">
            <div className="section-heading compact-heading">
              <div>
                <p className="section-index">LISTA ORDENADA</p>
                <h2>Top 10 publicado</h2>
              </div>
              <span className="aggregate-chip">Participa en Borda</span>
            </div>
            <ol className="source-ranking">
              {awardsWatchRanking.map((title, index) => (
                <li key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Link href={filmHrefForLabel(title)!}>{title}</Link>
                  <span className="original-value">
                    Valor original: {title}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="radar-section">
            <div className="section-heading compact-heading">
              <div>
                <p className="section-index">ON THE RADAR</p>
                <h2>Selección sin orden</h2>
              </div>
              <span className="context-chip">Solo cobertura</span>
            </div>
            <p>
              El bloque editorial no tiene un orden comparable: suma presencia,
              pero no puntos Borda ni posición media.
            </p>
            <div className="radar-tags">
              {awardsWatchRadar.map((title) => (
                <Link href={filmHrefForLabel(title)!} key={title}>
                  {title}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <aside className="source-sidebar">
          <div className="sidebar-card source-health">
            <p className="section-index">FICHA DE FUENTE</p>
            <dl>
              <div>
                <dt>Estado editorial</dt>
                <dd>Seleccionada</dd>
              </div>
              <div>
                <dt>Estado técnico</dt>
                <dd>Prototipo</dd>
              </div>
              <div>
                <dt>Publicación</dt>
                <dd>Revisar antes</dd>
              </div>
              <div>
                <dt>Frecuencia</dt>
                <dd>Mensual / semanal</dd>
              </div>
              <div>
                <dt>Paywall</dt>
                <dd>Parcial</dd>
              </div>
            </dl>
          </div>

          <div className="sidebar-card methodology-card">
            <p className="section-index">POR QUÉ CUENTA</p>
            <ul>
              <li>Temporada y categoría identificadas</li>
              <li>Autor y fecha visibles</li>
              <li>Orden explícito de diez películas</li>
              <li>URL canónica conservada</li>
            </ul>
            <Link href="/temporadas/2027/mejor-pelicula">
              Ver su efecto en el consenso →
            </Link>
          </div>

          <div className="sidebar-card stale-card">
            <span className="status-dot green" />
            <div>
              <strong>Fuente al día</strong>
              <p>
                9 días desde la publicación del fixture. El aviso se activa a
                los 45.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
