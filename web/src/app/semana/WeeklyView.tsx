import Link from "next/link";
import { getWeeklyReport, listDigestWeeks } from "../../lib/discovery/report";
import { weekStart } from "../../lib/discovery/weekly";
import { getFestivalIndex } from "../../lib/festivals/data";
import {
  festivalDateRange,
  festivalName,
} from "../../lib/festivals/presentation";
import { localizedPath, type Locale } from "../../lib/i18n/config";
import { getFilmArtwork } from "../../lib/repositories/artwork";
import { PosterBlock } from "../components/PosterBlock";
import { ShareButton } from "../components/ShareButton";

export async function WeeklyView({
  week,
  locale,
}: {
  week: string;
  locale: Locale;
}) {
  const en = locale === "en";
  const [report, weeks, festivals] = await Promise.all([
    getWeeklyReport(week),
    listDigestWeeks(),
    getFestivalIndex(),
  ]);
  const artwork = await getFilmArtwork(
    report.categories.map((item) => item.leader?.film?.id ?? null),
    locale,
  );
  const upcoming = festivals.filter(
    (edition) => edition.endsOn >= week && edition.startsOn <= report.endsOn,
  );
  const href = (path: string) => localizedPath(path, locale);
  return (
    <main className="page-shell weekly-page">
      <header className="discovery-hero">
        <p className="section-index">
          OSCAR 2027 · {en ? "THE WEEKLY EDITION" : "LA EDICIÓN SEMANAL"}
        </p>
        <h1>{en ? "This week in the race." : "La carrera, esta semana."}</h1>
        <p>
          {festivalDateRange(week, report.endsOn, locale)} · {week.slice(0, 4)}
        </p>
        <p>
          {en
            ? "The leaders, the moves and the festivals to follow."
            : "Las favoritas, los movimientos y los festivales que seguir."}
        </p>
        <div className="discovery-actions">
          <ShareButton
            title={
              en ? "This week in the Oscar race" : "La semana de los Oscar"
            }
            text={
              en
                ? "Explore this week’s Oscar predictions."
                : "Descubre las predicciones Oscar de esta semana."
            }
            url={href(`/semana/${week}`)}
            locale={locale}
            label={en ? "Share this edition ↗" : "Compartir esta edición ↗"}
          />
          <a className="ghost-button" href={`/semana/feed?lang=${locale}`}>
            {en ? "Follow weekly · RSS" : "Seguir cada semana · RSS"} ↗
          </a>
        </div>
      </header>
      <nav
        className="weekly-archive"
        aria-label={en ? "Weekly editions" : "Ediciones semanales"}
      >
        {[...new Set([weekStart(new Date()), ...weeks])]
          .slice(0, 8)
          .map((date) => (
            <Link
              prefetch={false}
              aria-current={date === week ? "page" : undefined}
              href={href(`/semana/${date}`)}
              key={date}
            >
              {new Intl.DateTimeFormat(locale, {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              }).format(new Date(`${date}T12:00:00Z`))}
            </Link>
          ))}
      </nav>
      {!report.changes ? (
        <p className="weekly-quiet">
          {en
            ? "No ranking updates have been recorded this week. These are the latest available leaders."
            : "Esta semana aún no hay cambios registrados en las clasificaciones. Estas son las últimas favoritas disponibles."}
        </p>
      ) : null}
      <div className="weekly-grid">
        {report.categories.map((item) => (
          <article className="weekly-card" key={item.category.id}>
            <p className="section-index">
              {en ? item.category.nameEn : item.category.name}
            </p>
            <div className="weekly-leader">
              {item.leader?.film ? (
                <Link
                  prefetch={false}
                  href={href(`/peliculas/${item.leader.film.id}`)}
                >
                  <PosterBlock
                    title={item.leader.film.title}
                    imagePath={artwork[item.leader.film.id]?.posterPath}
                    size="small"
                    locale={locale}
                  />
                </Link>
              ) : null}
              <div>
                <small>
                  {en
                    ? "Leading the experts’ ranking"
                    : "Lidera el ranking de expertos"}
                </small>
                <h2>
                  {item.leader?.label ??
                    (en ? "No predictions yet" : "Aún sin predicciones")}
                </h2>
                {item.cut ? (
                  <time dateTime={item.cut.lockedAt}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    }).format(new Date(item.cut.lockedAt))}
                  </time>
                ) : null}
              </div>
            </div>
            {item.changes ? (
              <>
                <h3>{en ? "What changed" : "Qué cambió"}</h3>
                {item.hasBaseline ? (
                  item.movements.length ? (
                    <ul className="weekly-movers">
                      {item.movements.map((candidate) => (
                        <li key={candidate.candidateId}>
                          <span>
                            {candidate.movement === null
                              ? en
                                ? "New"
                                : "Nueva"
                              : `${candidate.movement > 0 ? "↑" : "↓"} ${Math.abs(candidate.movement)}`}
                          </span>
                          <strong>{candidate.label}</strong>
                          <small>#{candidate.position}</small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      {en
                        ? "The sources updated their predictions; positions are unchanged."
                        : "Las fuentes actualizaron sus predicciones; las posiciones se mantienen."}
                    </p>
                  )
                ) : (
                  <p>
                    {en
                      ? "The first recorded rankings are now available."
                      : "Ya están disponibles las primeras clasificaciones registradas."}
                  </p>
                )}
                {item.sources.length ? (
                  <p className="weekly-sources">
                    {en ? "Updated sources" : "Fuentes que cambiaron"}:{" "}
                    {item.sources.join(", ")}
                  </p>
                ) : null}
              </>
            ) : null}
            <Link
              prefetch={false}
              className="text-link"
              href={href(
                `/temporadas/2027/${item.category.slug}${item.cut ? `?corte=${encodeURIComponent(item.cut.id)}` : ""}`,
              )}
            >
              {en
                ? "Explore the ranking and sources"
                : "Ver la clasificación y sus fuentes"}{" "}
              →
            </Link>
          </article>
        ))}
      </div>
      {upcoming.length ? (
        <section className="weekly-festivals">
          <h2>
            {en ? "On the festival calendar" : "En el calendario de festivales"}
          </h2>
          <div className="season-festival-list">
            {upcoming.map((edition) => (
              <Link
                prefetch={false}
                href={href(`/festivales/${edition.festivalId}/${edition.year}`)}
                key={edition.id}
              >
                <strong>{festivalName(edition, locale)}</strong>
                <small>
                  {festivalDateRange(edition.startsOn, edition.endsOn, locale)}
                </small>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <aside className="festival-next-step">
        <div>
          <p className="section-index">{en ? "YOUR TURN" : "TU TURNO"}</p>
          <h2>
            {en ? "Who are your favourites?" : "¿Cuáles son tus favoritas?"}
          </h2>
        </div>
        <Link className="primary-button" href={href("/quiniela")}>
          {en ? "Try your ballot" : "Prueba tu quiniela"} →
        </Link>
      </aside>
    </main>
  );
}
