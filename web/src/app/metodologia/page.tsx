import type { Metadata } from "next";
import Link from "next/link";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { buildLocalizedMetadata } from "../../lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const en = locale === "en";
  return buildLocalizedMetadata({
    locale,
    path: "/metodologia",
    title: en
      ? "How the Oscar Predictions Consensus Works"
      : "Cómo funciona el consenso de predicciones Oscar",
    description: en
      ? "See how Runscars combines professional Oscar prediction lists while preserving sources, original values and independent signals."
      : "Descubre cómo Runscars combina listas profesionales de predicciones Oscar conservando fuentes, valores originales y señales separadas.",
  });
}

export default async function MethodologyPage() {
  const locale = await getRequestLocale();
  const en = locale === "en";
  return (
    <main className="page-shell methodology-page">
      <header className="methodology-hero">
        <p className="section-index">{en ? "HOW IT WORKS" : "CÓMO FUNCIONA"}</p>
        <h1>
          {en
            ? "Three signals. Each with its own data."
            : "Tres señales. Cada una con sus propios datos."}
        </h1>
        <p>
          {en
            ? "Runscars presents critical reception, expert consensus and user rankings separately. Markets are shown as context, never as a vote."
            : "Runscars presenta por separado recepción crítica, consenso de expertos y rankings de usuarios. Los mercados aparecen como contexto, no como voto."}
        </p>
      </header>

      <section className="methodology-signal-grid">
        <article>
          <span>01</span>
          <h2>{en ? "Critics" : "Crítica"}</h2>
          <p>
            {en
              ? "Film pages show the original Metascore out of 100, with a link to Metacritic, when available. Runscars does not average or rescale this score."
              : "Las fichas muestran el Metascore original sobre 100 y un enlace a Metacritic cuando está disponible. Runscars no promedia ni cambia la escala de esa puntuación."}
          </p>
        </article>
        <article>
          <span>02</span>
          <h2>{en ? "Predictions" : "Predicción"}</h2>
          <p>
            {en
              ? "Each professional source contributes its most recent eligible publication for each category and intention. A source counts once, even when it publishes several experts."
              : "Cada fuente profesional aporta su publicación elegible más reciente por categoría e intención. Una fuente cuenta una vez, aunque publique varios expertos."}
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>{en ? "Community" : "Comunidad"}</h2>
          <p>
            {en
              ? "Rankings belong to each user. Public visibility is optional and never changes professional consensus or critical reception."
              : "Los rankings pertenecen a cada usuario. Su visibilidad es optativa y no modifica el consenso profesional ni la recepción crítica."}
          </p>
        </article>
      </section>

      <section className="methodology-steps">
        <article>
          <p className="section-index">
            {en ? "WEIGHTED CONSENSUS" : "CONSENSO PONDERADO"}
          </p>
          <h2>
            {en
              ? "From each list to a comparable scale"
              : "De cada lista a una escala comparable"}
          </h2>
          <div className="method-formula">
            {en
              ? "points = (length − rank + 1) / length"
              : "puntos = (longitud − puesto + 1) / longitud"}
          </div>
          <p>
            {en
              ? "First place receives 1 and last place receives 1/length. An unordered selection confirms appearance only; it does not invent a rank. Public consensus requires at least four automated, publishable sources."
              : "El primer puesto recibe 1 y el último 1/longitud. Una selección sin orden solo confirma aparición; no inventa una posición. El consenso público requiere al menos cuatro fuentes automáticas y publicables."}
          </p>
        </article>
        <article>
          <p className="section-index">{en ? "TIME" : "TEMPORALIDAD"}</p>
          <h2>
            {en
              ? "It changes only when the evidence changes"
              : "Solo cambia cuando cambia la evidencia"}
          </h2>
          <p>
            {en
              ? "The ranking updates when a source changes its predictions. Use the history to see earlier rankings and compare them with the previous update."
              : "La clasificación se actualiza cuando una fuente cambia sus predicciones. El historial permite consultar las clasificaciones anteriores y compararlas con la actualización previa."}
          </p>
        </article>
        <article>
          <p className="section-index">
            {en ? "LOCKS AND CORRECTIONS" : "CIERRES Y CORRECCIONES"}
          </p>
          <h2>
            {en
              ? "Predictions stay on the record"
              : "Las predicciones quedan registradas"}
          </h2>
          <p>
            {en
              ? "Nomination and winner locks cannot be changed. If there is an error, a linked replacement version is published with a reason while the previous record remains intact. Official results follow the same rule."
              : "Los cierres de nominaciones y ganador quedan bloqueados. Si hay un error, se publica una nueva versión enlazada con motivo; el registro anterior permanece intacto. Lo mismo ocurre con los resultados oficiales."}
          </p>
        </article>
        <article>
          <p className="section-index">
            {en ? "PROVENANCE AND FRESHNESS" : "PROCEDENCIA Y FRESCURA"}
          </p>
          <h2>
            {en
              ? "Every number must show its source"
              : "Cada cifra debe mostrar su procedencia"}
          </h2>
          <p>
            {en
              ? "We preserve source, URL, author when available, publication date, capture date and original value. One source failing does not block the others, and uncertain matches enter editorial review."
              : "Conservamos fuente, URL, autor cuando existe, fecha de publicación, captura y valor original. Los fallos de una fuente no bloquean las demás y las coincidencias dudosas pasan a revisión editorial."}
          </p>
        </article>
      </section>

      <aside className="methodology-callout">
        <div>
          <p className="section-index">{en ? "RESULTS" : "RESULTADOS"}</p>
          <h2>
            {en
              ? "Accuracy is published afterwards, never rewritten."
              : "El acierto se publica después, no se reescribe."}
          </h2>
        </div>
        <p>
          {en
            ? "We compare final predictions with official nominees and winners: how many nominees were correctly predicted and where the winner ranked."
            : "Comparamos las predicciones finales con los nominados y ganadores oficiales: cuántos nominados se acertaron y qué posición ocupaba el ganador."}
        </p>
        <Link
          className="primary-button dark-button"
          href={localizedPath("/evaluacion", locale)}
        >
          {en ? "View evaluation →" : "Ver evaluación →"}
        </Link>
      </aside>
    </main>
  );
}
