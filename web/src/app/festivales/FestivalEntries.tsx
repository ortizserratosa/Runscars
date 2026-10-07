"use client";

import { useState } from "react";
import Link from "next/link";
import {
  festivalAwardLabel,
  festivalImdbUrl,
  festivalTmdbUrl,
  festivalSourceFilmUrl,
} from "../../lib/festivals/presentation";
import type { FestivalSetView } from "../../lib/festivals/data";
import { localizedPath, type Locale } from "../../lib/i18n/config";

import type { FestivalFilmArtwork } from "../../lib/repositories/artwork";
import { PosterBlock } from "../components/PosterBlock";

const searchable = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function FestivalEntries({
  set,
  locale,
  artwork,
}: {
  set: FestivalSetView;
  locale: Locale;
  artwork: Record<string, FestivalFilmArtwork>;
}) {
  const en = locale === "en";
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("");
  const sections = [...new Set(set.entries.map((entry) => entry.section))];
  const entries = set.entries.filter(
    (entry) =>
      (!section || entry.section === section) &&
      searchable(
        [
          entry.originalTitle,
          entry.originalRecipient,
          entry.awardType,
          entry.filmTitle,
          artwork[entry.id]?.title,
        ].join(" "),
      ).includes(searchable(query.trim())),
  );
  return (
    <>
      <div className="festival-filters">
        <label htmlFor={`${set.kind}-search`}>
          {en ? "Find a film or filmmaker" : "Busca una película o cineasta"}
          <input
            id={`${set.kind}-search`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={en ? "Title, name, award…" : "Título, nombre, premio…"}
          />
        </label>
        <label htmlFor={`${set.kind}-section`}>
          {en ? "Section" : "Sección"}
          <select
            id={`${set.kind}-section`}
            value={section}
            onChange={(event) => setSection(event.target.value)}
          >
            <option value="">
              {en ? "All sections" : "Todas las secciones"}
            </option>
            {sections.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="festival-result-count" role="status">
        {entries.length} {en ? "of" : "de"} {set.entries.length}{" "}
        {set.kind === "awards"
          ? en
            ? "awards"
            : "premios"
          : en
            ? "films"
            : "películas"}
      </p>
      <ul className="festival-entry-list">
        {entries.map((entry) => {
          const imdbUrl = festivalImdbUrl(entry.imdbId);
          const tmdbUrl = festivalTmdbUrl(entry.tmdbId);
          const sourceFilmUrl = festivalSourceFilmUrl(entry.sourceFilmUrl);
          const movie = artwork[entry.id];
          const metadata = [
            movie?.title &&
            searchable(movie.title) !== searchable(entry.originalTitle)
              ? movie.title
              : null,
            movie?.releaseDate?.slice(0, 4),
            movie?.runtime ? `${movie.runtime} min` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          const poster = (
            <PosterBlock
              title={entry.originalTitle}
              locale={locale}
              size="small"
              imageSize="w185"
              imagePath={movie?.posterPath}
              showOscarEdition={false}
            />
          );
          return (
            <li key={entry.id}>
              {entry.filmId ? (
                <Link
                  className="festival-entry-poster"
                  prefetch={false}
                  href={localizedPath(`/peliculas/${entry.filmId}`, locale)}
                  aria-label={entry.originalTitle}
                >
                  {poster}
                </Link>
              ) : tmdbUrl ? (
                <a
                  className="festival-entry-poster"
                  href={tmdbUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${entry.originalTitle} · TMDB`}
                >
                  {poster}
                </a>
              ) : (
                <span className="festival-entry-symbol" aria-hidden="true">
                  {set.kind === "awards" ? "✳" : "↗"}
                </span>
              )}
              <div className="festival-entry-copy">
                <small>{entry.section}</small>
                {entry.awardType ? (
                  <p className="festival-award-name">
                    {festivalAwardLabel(entry.awardType, locale)}
                  </p>
                ) : null}
                <h3>
                  {entry.filmId ? (
                    <Link
                      prefetch={false}
                      href={localizedPath(`/peliculas/${entry.filmId}`, locale)}
                    >
                      {entry.originalTitle} <span aria-hidden="true">↗</span>
                    </Link>
                  ) : tmdbUrl ? (
                    <a href={tmdbUrl} target="_blank" rel="noreferrer">
                      {entry.originalTitle}{" "}
                      <span aria-hidden="true">TMDB ↗</span>
                    </a>
                  ) : (
                    entry.originalTitle
                  )}
                </h3>
                {entry.originalRecipient ? (
                  <p>{entry.originalRecipient}</p>
                ) : null}
                {metadata ? (
                  <p className="festival-entry-metadata">{metadata}</p>
                ) : null}
                {imdbUrl || sourceFilmUrl || (entry.filmId && tmdbUrl) ? (
                  <p className="festival-entry-links">
                    {entry.filmId && tmdbUrl ? (
                      <a href={tmdbUrl} target="_blank" rel="noreferrer">
                        TMDB ↗
                      </a>
                    ) : null}
                    {imdbUrl ? (
                      <a href={imdbUrl} target="_blank" rel="noreferrer">
                        IMDb ↗
                      </a>
                    ) : null}
                    {sourceFilmUrl ? (
                      <a href={sourceFilmUrl} target="_blank" rel="noreferrer">
                        {en ? "Film in the source" : "Película en la fuente"} ↗
                      </a>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {!entries.length ? (
        <div className="festival-no-results">
          <p>
            {en
              ? "No films match your search."
              : "No hay películas que coincidan con tu búsqueda."}
          </p>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setQuery("");
              setSection("");
            }}
          >
            {en ? "Clear filters" : "Borrar filtros"}
          </button>
        </div>
      ) : null}
    </>
  );
}
