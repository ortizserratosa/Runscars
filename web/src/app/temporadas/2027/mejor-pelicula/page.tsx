import type { Metadata } from "next";
import Link from "next/link";
import {
  calculationCuts,
  consensusCandidates,
} from "../../../../data/aggregation-presentation";
import { filmHref } from "../../../../data/films";
import { CategoryExperience } from "./CategoryExperience";

export const metadata: Metadata = {
  title: "Mejor película · Oscar 2027",
  description: "Consenso verificable de Mejor película para los Oscar 2027.",
};

const currentCut = calculationCuts.at(-1)!;
const leader = consensusCandidates[0];

export default function BestPicturePage() {
  return (
    <main>
      <section className="category-hero">
        <div className="page-shell">
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <Link href="/temporadas/2027">Oscar 2027</Link>
            <span>/</span>
            <span>Mejor película</span>
          </div>
          <div className="category-title-row">
            <div>
              <p className="kicker">Predicción de nominaciones</p>
              <h1>
                Mejor <em>película</em>
              </h1>
              <p>
                {consensusCandidates.length} candidatas observadas ·{" "}
                {currentCut.sourceCount} listas ordenadas · cálculo hasta el{" "}
                {currentCut.date}
              </p>
            </div>
            <div className="category-hero-stat">
              <span>Líder</span>
              <strong>
                {leader.score.toLocaleString("es-ES", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
              <small>
                <Link href={filmHref(leader.id)}>{leader.title}</Link> ·{" "}
                {leader.coverage} fuentes
              </small>
            </div>
          </div>
        </div>
      </section>

      <div className="page-shell category-page-body">
        <CategoryExperience />
      </div>
    </main>
  );
}
