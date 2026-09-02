import type { Metadata } from "next";
import Link from "next/link";
import { Movement } from "./components/Movement";
import { PosterBlock } from "./components/PosterBlock";
import { JsonLd } from "./components/JsonLd";
import { filmHref } from "../data/films";
import { getCategoryView } from "../lib/categories/data";
import { localeTag, localizedPath } from "../lib/i18n/config";
import { getRequestLocale } from "../lib/i18n/server";
import { absoluteUrl, buildLocalizedMetadata } from "../lib/seo";

export const dynamic = "force-dynamic";

const tones = ["violet", "acid", "rust"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const en = locale === "en";
  const title = en
    ? "Oscar Predictions 2027: Expert Consensus"
    : "Predicciones Oscar 2027: ranking y consenso";
  return {
    ...buildLocalizedMetadata({
      locale,
      path: "/",
      title,
      description: en
        ? "Updated 2027 Oscar predictions based on specialist outlets. Compare Best Picture and all eight major categories with transparent sources."
        : "Predicciones de los Oscar 2027 actualizadas con medios especializados. Consulta Mejor película y las ocho categorías con fuentes transparentes.",
    }),
    title: { absolute: `${title} | Runscars` },
  };
}

function dateLabel(value: string, locale: "es" | "en") {
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

function sourceDateLabel(value: string, locale: "es" | "en") {
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function Home() {
  const [categoryView, locale] = await Promise.all([
    getCategoryView(2027, "best-picture"),
    getRequestLocale(),
  ]);
  const en = locale === "en";
  const href = (path: string) => localizedPath(path, locale);
  if (categoryView.mode !== "active") {
    throw new Error("La portada necesita la temporada activa de Oscar 2027");
  }
  const liveRanking = categoryView.aggregate?.ranking ?? [];
  const ranking = liveRanking.map((candidate, index) => ({
    id: candidate.film?.id ?? candidate.candidateId,
    href: candidate.film
      ? href(filmHref(candidate.film.id))
      : href("/temporadas/2027/mejor-pelicula"),
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
    ? dateLabel(categoryView.snapshot.lockedAt, locale)
    : en
      ? "update pending"
      : "actualización pendiente";
  const liveReceipts = leader.contributions
    .filter((source) => source.appeared)
    .map((source) => ({
      name: source.sourceName,
      detail:
        source.appearanceKind === "ordered"
          ? `${leader.title} · #${source.rank}`
          : `${leader.title} · ${en ? "selection" : "selección"}`,
      date: source.publishedAt
        ? `${en ? "Published" : "Publicada"} ${sourceDateLabel(source.publishedAt, locale)}`
        : en
          ? "Verified publication"
          : "Publicación verificada",
      href: href(`/fuentes/${source.sourceId}`),
    }));
  const receipts = liveReceipts.length
    ? liveReceipts
    : [
        {
          name: en ? "Professional consensus" : "Consenso profesional",
          detail: leader.title,
          date: en ? "Update pending" : "Actualización pendiente",
          href: leader.href,
        },
      ];
  const pageUrl = absoluteUrl(href("/"));
  const websiteUrl = absoluteUrl("/");
  const pageTitle = en
    ? "Oscar Predictions 2027: Expert Consensus"
    : "Predicciones Oscar 2027: ranking y consenso";
  const pageDescription = en
    ? "Updated professional Oscar predictions with transparent source-by-source consensus."
    : "Predicciones profesionales de los Oscar actualizadas con consenso transparente fuente por fuente.";
  const rankingSchema = {
    "@type": "ItemList",
    name: en
      ? "2027 Oscar predictions for Best Picture"
      : "Predicciones Oscar 2027 para Mejor película",
    numberOfItems: ranking.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: ranking.slice(0, 10).map((candidate, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: candidate.title,
      url: absoluteUrl(candidate.href),
    })),
  };

  return (
    <main>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${websiteUrl}#website`,
              url: websiteUrl,
              name: "Runscars",
              alternateName: [
                "Runscars Oscar Predictions",
                "Runscars Predicciones Oscar",
              ],
              inLanguage: ["es-ES", "en-GB"],
            },
            {
              "@type": "CollectionPage",
              "@id": `${pageUrl}#webpage`,
              url: pageUrl,
              name: pageTitle,
              description: pageDescription,
              inLanguage: localeTag(locale),
              isPartOf: { "@id": `${websiteUrl}#website` },
              ...(categoryView.snapshot
                ? { dateModified: categoryView.snapshot.lockedAt }
                : {}),
              mainEntity: rankingSchema,
            },
          ],
        }}
      />
      <section className="home-hero page-shell">
        <div className="eyebrow-row">
          <span className="eyebrow">
            {en ? "Season notebook" : "Cuaderno de temporada"} · {currentDate}
          </span>
          <span className="data-note">
            {ranking.length}{" "}
            {en ? "films in contention" : "películas en carrera"}
          </span>
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="kicker">
              {en
                ? "Oscar 2027 · 2026 films"
                : "Oscar 2027 · películas de 2026"}
            </p>
            <h1>
              {en ? "Oscar predictions 2027," : "Predicciones Oscar 2027,"}
              <br />
              <em>{en ? "backed by data." : "datos en mano."}</em>
            </h1>
            <p className="hero-intro">
              {en
                ? "Compare professional Oscar predictions from specialist outlets, see which films lead and follow every change in consensus."
                : "Compara predicciones profesionales de los Oscar, descubre qué películas lideran y sigue cada cambio del consenso."}
            </p>
            <div className="hero-actions">
              <Link
                className="primary-button"
                href={href("/temporadas/2027/mejor-pelicula")}
              >
                {en ? "View Best Picture" : "Ver Mejor película"}{" "}
                <span aria-hidden="true">↗</span>
              </Link>
              <Link className="text-link" href={href("/temporadas/2027")}>
                {en ? "Explore the season" : "Explorar temporada"}
              </Link>
            </div>
          </div>

          <div className="hero-board">
            <div className="hero-board-label">
              <span>{en ? "Leading film" : "Película líder"}</span>
              <span>{en ? "Consensus" : "Consenso"}</span>
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
                  {leader.score.toLocaleString(localeTag(locale), {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </strong>
                <span>
                  {en ? "consensus points / 100" : "puntos de consenso / 100"}
                </span>
              </div>
              <div
                className="score-meter"
                aria-label={`${leader.score.toLocaleString(localeTag(locale))} ${en ? "points out of 100" : "puntos de 100"}`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={leader.score}
                role="progressbar"
              >
                <span style={{ width: `${leader.score}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="ticker"
        aria-label={
          en ? "Latest update summary" : "Resumen de la última actualización"
        }
      >
        <div className="page-shell ticker-inner">
          <span className="ticker-label">
            {en ? "Latest update" : "Última actualización"}
          </span>
          <Link href={leader.href}>
            {leader.title} {en ? "leads consensus" : "lidera el consenso"}
          </Link>
          <span className="ticker-separator" aria-hidden="true">
            ◆
          </span>
          {rising ? (
            <Link href={rising.href}>
              {rising.title} {en ? "rises" : "sube"} {rising.movement}{" "}
              {en
                ? rising.movement === 1
                  ? "place"
                  : "places"
                : rising.movement === 1
                  ? "puesto"
                  : "puestos"}
            </Link>
          ) : (
            <span>
              {en
                ? "No rises among the top positions"
                : "Sin subidas en las primeras posiciones"}
            </span>
          )}
          <span className="ticker-separator" aria-hidden="true">
            ◆
          </span>
          <span>
            {categoryView.snapshot?.previous
              ? `${en ? "Compared with the update from" : "Comparado con la actualización del"} ${dateLabel(
                  categoryView.snapshot.previous.lockedAt,
                  locale,
                )}`
              : en
                ? "First update available"
                : "Primera actualización disponible"}
          </span>
        </div>
      </section>

      <section className="page-shell section-block">
        <div className="section-heading split-heading">
          <div>
            <p className="section-index">
              01 / {en ? "CONSENSUS" : "CONSENSO"}
            </p>
            <h2>
              {en
                ? "Latest Oscar predictions"
                : "Predicciones Oscar actualizadas"}
            </h2>
          </div>
          <p>
            {en
              ? "Updated daily from specialist outlets. The consensus reflects the direction of professional predictions, not a mathematical probability."
              : "Actualizadas cada día desde medios especializados. El consenso refleja la tendencia de las predicciones, no una probabilidad matemática."}
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
                  <span className="rank-label">
                    {en ? "No." : "Nº"} {index + 1}
                  </span>
                  {categoryView.snapshot?.previous ? (
                    <Movement locale={locale} value={candidate.movement} />
                  ) : (
                    <span
                      aria-label={
                        en ? "No previous update" : "Sin actualización anterior"
                      }
                      className="movement neutral"
                      title={
                        en ? "No previous update" : "Sin actualización anterior"
                      }
                    >
                      —
                    </span>
                  )}
                </div>
                <h3>{candidate.title}</h3>
                <p>
                  {candidate.coverage} {en ? "sources" : "fuentes"} ·{" "}
                  {candidate.firsts}{" "}
                  {en ? "first places" : "primeras posiciones"}
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
              <p className="section-index">
                02 / {en ? "THREE SIGNALS" : "TRES SEÑALES"}
              </p>
              <h2>
                {en
                  ? "Consensus, movement and your list."
                  : "Consenso, evolución y tu lista."}
              </h2>
            </div>
            <p>
              {en
                ? "Professional analysis and your own ballot, all in one place."
                : "Análisis profesional y tu propia quiniela, en un solo lugar."}
            </p>
          </div>

          <div className="signal-grid">
            <article className="signal-card prediction-card">
              <span className="signal-number">A</span>
              <p className="signal-type">
                {en ? "Predictions" : "Predicciones"}
              </p>
              <h3>
                {en
                  ? "Who appears on the lists?"
                  : "¿Quién aparece en las listas?"}
              </h3>
              <div className="signal-stat">
                <strong>{leader.coverage}</strong>
                <span>
                  {en ? "sources include" : "fuentes sitúan a"}{" "}
                  <Link href={leader.href}>{leader.title}</Link>
                </span>
              </div>
              <Link href={href("/temporadas/2027/mejor-pelicula")}>
                {en ? "Open consensus →" : "Abrir consenso →"}
              </Link>
            </article>

            <article className="signal-card evolution-card">
              <span className="signal-number">B</span>
              <p className="signal-type">{en ? "Movement" : "Evolución"}</p>
              <h3>{en ? "What really changed?" : "¿Qué cambió de verdad?"}</h3>
              <div className="signal-stat">
                <strong>{rising ? `+${rising.movement}` : "="}</strong>
                <span>
                  {rising ? (
                    <Link href={rising.href}>{rising.title}</Link>
                  ) : en ? (
                    "no rises among the top positions"
                  ) : (
                    "sin subidas en las primeras posiciones"
                  )}
                </span>
              </div>
              <Link href={href("/temporadas/2027/mejor-pelicula")}>
                {en ? "View change history →" : "Ver historial de cambios →"}
              </Link>
            </article>

            <article className="signal-card community-card">
              <span className="signal-number">C</span>
              <p className="signal-type">{en ? "Community" : "Comunidad"}</p>
              <h3>{en ? "Your personal ballot" : "Tu quiniela personal"}</h3>
              <div className="signal-stat">
                <strong>{en ? "Create" : "Crea"}</strong>
                <span>
                  {en
                    ? "a personal ranking independent from professional consensus"
                    : "un ranking personal independiente del consenso"}
                </span>
              </div>
              <Link href={href("/acceso")}>
                {en ? "Create my ballot →" : "Crear mi quiniela →"}
              </Link>
              <Link href={href("/comunidad")}>
                {en
                  ? "Explore public ballots →"
                  : "Explorar quinielas públicas →"}
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="page-shell section-block evidence-section">
        <div className="evidence-copy">
          <p className="section-index">
            03 / {en ? "TRACEABILITY" : "TRAZABILIDAD"}
          </p>
          <h2>
            {en
              ? "From the position to the publication."
              : "De la posición a la publicación."}
          </h2>
          <p>
            {en
              ? "Every movement records the source, author, date and original value. Full transparency without manipulated data."
              : "Cada movimiento registra fuente, autor, fecha y dato original. Transparencia total sin datos manipulados."}
          </p>
          <Link className="primary-button dark-button" href={href("/fuentes")}>
            {en ? "Explore sources" : "Explorar fuentes"}
          </Link>
        </div>
        <div className="evidence-receipts">
          <div
            className="receipt-stack"
            aria-label={en ? "Featured sources" : "Fuentes destacadas"}
            role="group"
          >
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
            <summary>
              {en
                ? `The leader's ${receipts.length} sources`
                : `Las ${receipts.length} fuentes del líder`}
            </summary>
            <ul
              aria-label={
                en ? "Current ranking sources" : "Fuentes del ranking actual"
              }
            >
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
