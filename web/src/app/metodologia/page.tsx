import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Metodología",
  description: "Cómo separa, normaliza, agrega y congela datos Runscars.",
};

export default function MethodologyPage() {
  return (
    <main className="page-shell methodology-page">
      <header className="methodology-hero">
        <p className="section-index">MÉTODO PÚBLICO · V2</p>
        <h1>Una carrera, tres señales. Nunca un promedio opaco.</h1>
        <p>
          Runscars presenta por separado recepción crítica, consenso de expertos
          y rankings de usuarios. Los mercados aparecen como contexto, no como
          voto.
        </p>
      </header>

      <section className="methodology-signal-grid">
        <article>
          <span>01</span>
          <h2>Crítica</h2>
          <p>
            Las puntuaciones individuales se convierten a una escala de 0 a 5,
            conservando siempre el valor y la escala originales. Solo hay
            agregado destacado con tres críticas independientes.
          </p>
        </article>
        <article>
          <span>02</span>
          <h2>Predicción</h2>
          <p>
            Cada fuente profesional aporta su publicación elegible más reciente
            por categoría e intención. Una fuente cuenta una vez, aunque
            publique varios expertos.
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>Comunidad</h2>
          <p>
            Los rankings pertenecen a cada usuario. Su visibilidad es optativa y
            no modifica el consenso profesional ni la recepción crítica.
          </p>
        </article>
      </section>

      <section className="methodology-steps">
        <article>
          <p className="section-index">CONSENSO BORDA NORMALIZADO</p>
          <h2>De cada lista a una escala comparable</h2>
          <div className="method-formula">
            puntos = (longitud − puesto + 1) / longitud
          </div>
          <p>
            El primer puesto recibe 1 y el último 1/longitud. Una selección sin
            orden solo confirma aparición; no inventa una posición. El consenso
            público requiere al menos cuatro listas ordenadas automáticas y
            publicables.
          </p>
        </article>
        <article>
          <p className="section-index">TEMPORALIDAD</p>
          <h2>Solo cambia cuando cambia la evidencia</h2>
          <p>
            La web crea un corte cuando una fuente añade, elimina, reordena o
            cambia la identidad de una candidatura. Cada corte guarda las
            observaciones incluidas, las excluidas, la versión del método y un
            hash de contenido.
          </p>
        </article>
        <article>
          <p className="section-index">CIERRES Y CORRECCIONES</p>
          <h2>Inmutable significa inmutable</h2>
          <p>
            Los cierres de nominaciones y ganador quedan bloqueados. Si hay un
            error, se publica una nueva versión enlazada con motivo; el registro
            anterior permanece intacto. Lo mismo ocurre con los resultados
            oficiales.
          </p>
        </article>
        <article>
          <p className="section-index">PROCEDENCIA Y FRESCURA</p>
          <h2>Cada cifra debe enseñar sus recibos</h2>
          <p>
            Conservamos fuente, URL, autor cuando existe, fecha de publicación,
            captura y valor original. Los fallos de una fuente no bloquean las
            demás y las coincidencias dudosas pasan a revisión editorial.
          </p>
        </article>
      </section>

      <aside className="methodology-callout">
        <div>
          <p className="section-index">RESULTADOS</p>
          <h2>El acierto se publica después, no se reescribe.</h2>
        </div>
        <p>
          Comparamos el cierre bloqueado con nominaciones y ganadores oficiales.
          Mostramos precisión, cobertura y posición del ganador con IDs de las
          versiones utilizadas.
        </p>
        <Link className="primary-button dark-button" href="/evaluacion">
          Ver evaluación →
        </Link>
      </aside>
    </main>
  );
}
