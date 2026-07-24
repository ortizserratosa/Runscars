import type { Metadata } from "next";
import Link from "next/link";
import { CategoryExperience } from "./CategoryExperience";

export const metadata: Metadata = {
  title: "Mejor película · Oscar 2027",
  description: "Consenso verificable de Mejor película para los Oscar 2027.",
};

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
              <h1>Mejor <em>película</em></h1>
              <p>
                20 candidatas observadas · cuatro listas ordenadas · corte del
                23 de julio de 2026
              </p>
            </div>
            <div className="category-hero-stat">
              <span>Líder</span>
              <strong>97,5</strong>
              <small>The Odyssey · 4/4 fuentes</small>
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
