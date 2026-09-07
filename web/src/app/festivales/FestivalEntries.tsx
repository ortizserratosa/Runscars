"use client";

import { useState } from "react";
import Link from "next/link";
import { festivalAwardLabel } from "../../lib/festivals/presentation";
import type { FestivalSetView } from "../../lib/festivals/data";
import { localizedPath, type Locale } from "../../lib/i18n/config";

import type { FilmArtwork } from "../../lib/repositories/artwork";
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
  artwork: Record<string, FilmArtwork>;
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
        {entries.map((entry) => (
          <li key={entry.id}>
            {entry.filmId && artwork[entry.filmId]?.posterPath ? (
              <Link
                className="festival-entry-poster"
                prefetch={false}
                href={localizedPath(`/peliculas/${entry.filmId}`, locale)}
                aria-label={entry.originalTitle}
              >
                <PosterBlock
                  title={entry.originalTitle}
                  locale={locale}
                  size="small"
                  imagePath={artwork[entry.filmId].posterPath}
                />
              </Link>
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
                ) : (
                  entry.originalTitle
                )}
              </h3>
              {entry.originalRecipient ? (
                <p>{entry.originalRecipient}</p>
              ) : null}
            </div>
          </li>
        ))}
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
