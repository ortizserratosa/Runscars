"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  calculationCuts,
  consensusCandidates,
} from "../../../../data/aggregation-presentation";
import { AGGREGATION_METHOD_VERSION } from "../../../../lib/aggregation";
import { filmHref } from "../../../../data/films";

const initialRanking = consensusCandidates
  .slice(0, 6)
  .map((candidate) => candidate.id);

function formatScore(value: number) {
  return value.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CategoryExperience() {
  const [cutId, setCutId] = useState(
    calculationCuts.at(-1)?.id ?? calculationCuts[0].id,
  );
  const [expanded, setExpanded] = useState<string | null>("the-odyssey");
  const [ranking, setRanking] = useState(initialRanking);
  const [watched, setWatched] = useState<string[]>([
    "the-odyssey",
    "project-hail-mary",
  ]);
  const [saved, setSaved] = useState(false);

  const cut =
    calculationCuts.find((item) => item.id === cutId) ??
    calculationCuts.at(-1)!;
  const isCurrent = cut.id === calculationCuts.at(-1)?.id;

  const rankedCandidates = useMemo(
    () =>
      ranking.map((id) =>
        consensusCandidates.find((candidate) => candidate.id === id)!,
      ),
    [ranking],
  );

  function move(id: string, direction: -1 | 1) {
    setSaved(false);
    setRanking((current) => {
      const index = current.indexOf(id);
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleWatched(id: string) {
    setSaved(false);
    setWatched((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  return (
    <>
      <section className="snapshot-panel" aria-labelledby="snapshot-title">
        <div className="snapshot-heading">
          <div>
            <p className="section-index">EVOLUCIÓN</p>
            <h2 id="snapshot-title">Recalcular hasta una fecha</h2>
          </div>
          <div className="snapshot-readout" aria-live="polite">
            <span>{cut.date}</span>
            <strong>{cut.label}</strong>
          </div>
        </div>
        <div
          className="snapshot-selector"
          role="group"
          aria-label="Elegir corte temporal"
        >
          {calculationCuts.map((item) => (
            <button
              className={cut.id === item.id ? "active" : ""}
              key={item.id}
              onClick={() => {
                setCutId(item.id);
                setExpanded(null);
              }}
              type="button"
            >
              <span>{item.shortDate}</span>
              <small>
                {item.sourceCount} {item.sourceCount === 1 ? "lista" : "listas"}
              </small>
            </button>
          ))}
        </div>
        <p className="calculation-cut-note">
          Son cortes reproducibles sobre observaciones publicadas, no snapshots
          bloqueados. Cada fecha acumula la última publicación disponible de
          cada fuente.
        </p>
        {!cut.isConsensus ? (
          <p className="insufficient-note">
            <strong>Datos insuficientes:</strong> este corte todavía no alcanza
            las tres listas ordenadas exigidas para llamarlo consenso.
          </p>
        ) : null}
      </section>

      <section
        className="leaderboard-section"
        aria-labelledby="leaderboard-title"
      >
        <div className="section-heading split-heading">
          <div>
            <p className="section-index">PREDICCIONES</p>
            <h2 id="leaderboard-title">
              {cut.isConsensus ? "Consenso de nominación" : "Señal editorial"}
            </h2>
          </div>
          <p>
            Puntos Borda normalizados. Las ausencias valen cero y todas las
            listas aplicables pesan lo mismo.
          </p>
        </div>

        <div className="leaderboard">
          <div className="leaderboard-head" aria-hidden="true">
            <span>Pos.</span>
            <span>Película</span>
            <span>Respaldo</span>
            <span>Puntos</span>
            <span />
          </div>
          {cut.ranking.map((item, index) => {
            const candidate = consensusCandidates.find(
              (candidateItem) => candidateItem.id === item.id,
            );
            const hasSources = isCurrent && candidate;
            const isOpen = expanded === item.id;
            return (
              <div
                className={`leaderboard-item ${isOpen ? "open" : ""}`}
                key={item.id}
              >
                <div className="leaderboard-row">
                  <span className="leaderboard-rank">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="leaderboard-title">
                    <Link href={filmHref(item.id)}>{item.title}</Link>
                    <small>
                      {isCurrent && candidate
                        ? `Posición media ${
                            candidate.average === null
                              ? "—"
                              : formatScore(candidate.average)
                          }`
                        : cut.date}
                    </small>
                  </div>
                  <div className="coverage-cell">
                    <span>
                      {isCurrent && candidate
                        ? candidate.coverage
                        : `corte ${cut.sourceCount}`}
                    </span>
                    <div className="coverage-dots" aria-hidden="true">
                      {Array.from(
                        {
                          length: isCurrent
                            ? (candidate?.applicableSources ?? cut.sourceCount)
                            : cut.sourceCount,
                        },
                        (_, dot) => (
                          <i
                            className={
                              dot <
                              (isCurrent && candidate
                                ? candidate.appearances
                                : cut.sourceCount)
                                ? "filled"
                                : ""
                            }
                            key={dot}
                          />
                        ),
                      )}
                    </div>
                  </div>
                  <div className="points-cell">
                    <strong>{formatScore(item.score)}</strong>
                    <div
                      className="micro-bar"
                      aria-label={`${formatScore(item.score)} puntos de 100`}
                    >
                      <span style={{ width: `${item.score}%` }} />
                    </div>
                  </div>
                  {hasSources ? (
                    <button
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Ocultar" : "Mostrar"} fuentes de ${item.title}`}
                      className="row-toggle"
                      onClick={() => setExpanded(isOpen ? null : item.id)}
                      type="button"
                    >
                      {isOpen ? "−" : "+"}
                    </button>
                  ) : (
                    <span className="row-toggle-placeholder" />
                  )}
                </div>

                {isOpen && candidate ? (
                  <div className="source-breakdown">
                    <div>
                      <p className="section-index">
                        DESGLOSE DE TODAS LAS FUENTES
                      </p>
                      <p>
                        {candidate.firsts} primeras posiciones · mediana{" "}
                        {candidate.median === null
                          ? "—"
                          : formatScore(candidate.median)}{" "}
                        · {candidate.topFive} apariciones en top 5
                      </p>
                    </div>
                    <div className="source-calculations">
                      {candidate.contributions.map((source) => (
                        <a
                          href={source.href}
                          key={source.id}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span>
                            {source.name}
                            <small>
                              {source.observationId ??
                                "ausencia comprobada en la lista"}
                            </small>
                          </span>
                          <code>
                            {source.rank === null
                              ? source.appearanceKind === "selection"
                                ? "selección sin orden → 0"
                                : "ausente → 0"
                              : `(${source.listLength} − ${source.rank} + 1) / ${source.listLength}`}
                          </code>
                          <strong>{formatScore(source.points * 100)}</strong>
                        </a>
                      ))}
                      <p className="candidate-formula-result">
                        Media de {candidate.orderedSources} listas ordenadas ={" "}
                        <strong>{formatScore(candidate.score)}</strong> / 100
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="calculation-explainer" aria-labelledby="method-title">
        <div>
          <p className="section-index">CÁLCULO REPRODUCIBLE</p>
          <h2 id="method-title">Sin una caja negra.</h2>
          <p>
            El resultado se deriva al abrir la vista; todavía no se persiste
            como snapshot. La Fase 7 se encargará de bloquear cortes inmutables.
          </p>
        </div>
        <div className="calculation-steps">
          <article>
            <span>01</span>
            <strong>Una lista, un peso</strong>
            <code>(L − posición + 1) / L</code>
          </article>
          <article>
            <span>02</span>
            <strong>Ausencias explícitas</strong>
            <code>película ausente = 0</code>
          </article>
          <article>
            <span>03</span>
            <strong>Consenso</strong>
            <code>suma de puntos / listas ordenadas</code>
          </article>
          <p>
            Método <code>{AGGREGATION_METHOD_VERSION}</code> ·{" "}
            {cut.observationCount} observaciones incluidas · desempate por
            cobertura, mediana, primeras posiciones y título.
          </p>
        </div>
      </section>

      <section
        className="ranking-lab"
        id="mi-ranking"
        aria-labelledby="ranking-title"
      >
        <div className="ranking-intro">
          <p className="section-index">COMUNIDAD · SIMULACIÓN</p>
          <h2 id="ranking-title">Tu papeleta, tus reglas.</h2>
          <p>
            Reordena las películas y marca las que has visto. Esta lista vive
            aparte del consenso profesional y no se guarda fuera de esta sesión.
          </p>
          <div className="ranking-key">
            <span>
              <i className="status-dot green" /> Vista
            </span>
            <span>
              <i className="status-dot gray" /> No indicada
            </span>
          </div>
        </div>

        <div className="ranking-editor">
          <ol>
            {rankedCandidates.map((candidate, index) => {
              const isWatched = watched.includes(candidate.id);
              return (
                <li key={candidate.id}>
                  <span className="user-rank">{index + 1}</span>
                  <div
                    className={`ranking-swatch poster-${candidate.tone}`}
                    aria-hidden="true"
                  />
                  <div className="ranking-film">
                    <Link href={filmHref(candidate.id)}>
                      <strong>{candidate.title}</strong>
                    </Link>
                    <button
                      aria-pressed={isWatched}
                      className={isWatched ? "watched" : ""}
                      onClick={() => toggleWatched(candidate.id)}
                      type="button"
                    >
                      {isWatched ? "✓ Vista" : "Marcar vista"}
                    </button>
                  </div>
                  <div className="ranking-controls">
                    <button
                      aria-label={`Subir ${candidate.title}`}
                      disabled={index === 0}
                      onClick={() => move(candidate.id, -1)}
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Bajar ${candidate.title}`}
                      disabled={index === rankedCandidates.length - 1}
                      onClick={() => move(candidate.id, 1)}
                      type="button"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="ranking-save-row">
            <button
              className="primary-button"
              onClick={() => setSaved(true)}
              type="button"
            >
              Guardar simulación
            </button>
            <span aria-live="polite">
              {saved
                ? "Simulación guardada en esta vista."
                : "Sin cuenta · no persistente"}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
