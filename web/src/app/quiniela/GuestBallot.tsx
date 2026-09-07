"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";
import {
  draftKey,
  readDraft,
  serializeDraft,
} from "../../lib/discovery/ballot";
import { localizedPath, type Locale } from "../../lib/i18n/config";
import type { FilmArtwork } from "../../lib/repositories/artwork";
import { PosterBlock } from "../components/PosterBlock";

type Category = {
  id: string;
  slug: string;
  name: string;
  limit: number;
  candidates: { id: string; label: string; filmId: string | null }[];
};
export function GuestBallot({
  categories,
  locale,
  artwork,
  initialCategory,
}: {
  categories: Category[];
  locale: Locale;
  artwork: Record<string, FilmArtwork>;
  initialCategory: string;
}) {
  const [categoryId, setCategoryId] = useState(initialCategory);
  const category =
    categories.find((item) => item.id === categoryId) ?? categories[0];
  const en = locale === "en";
  return (
    <>
      <nav
        className="ballot-tabs"
        aria-label={en ? "Ballot category" : "Categoría de la quiniela"}
      >
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={category.id === item.id}
            onClick={() => setCategoryId(item.id)}
          >
            {item.name}
          </button>
        ))}
      </nav>
      <Ballot
        key={category.id}
        category={category}
        artwork={artwork}
        locale={locale}
      />
    </>
  );
}
function Ballot({
  category,
  locale,
  artwork,
}: {
  category: Category;
  locale: Locale;
  artwork: Record<string, FilmArtwork>;
}) {
  const en = locale === "en";
  const [ids, setIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      const stored = readDraft(
        localStorage.getItem(draftKey(category.id)),
        category.candidates.map((item) => item.id),
        category.limit,
      );
      queueMicrotask(() => setIds(stored));
    } catch {
      queueMicrotask(() => setStorageError(true));
    }
  }, [category]);
  function update(next: string[]) {
    if (!ids.length && next.length)
      track("guest_ballot_started", { category: category.id });
    setIds(next);
    try {
      localStorage.setItem(draftKey(category.id), serializeDraft(next));
    } catch {
      setStorageError(true);
    }
  }
  function move(index: number, delta: number) {
    const next = [...ids];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  }
  const available = category.candidates.filter(
    (item) =>
      !ids.includes(item.id) &&
      item.label
        .toLocaleLowerCase(locale)
        .includes(query.toLocaleLowerCase(locale)),
  );
  const nextPath = localizedPath(`/temporadas/2027/${category.slug}`, locale);
  return (
    <div className="guest-ballot-grid">
      <section className="ballot-picks">
        <p className="section-index">
          {en ? "YOUR PICKS" : "TUS ELEGIDAS"} · {ids.length}/{category.limit}
        </p>
        <h2>{category.name}</h2>
        <p>
          {en
            ? "Put your favourite first. Use the arrows to change the order."
            : "Pon tu favorita primero. Usa las flechas para cambiar el orden."}
        </p>
        {!ids.length ? (
          <div className="ballot-empty">
            {en
              ? "Your next Oscar winner starts here. Add your first pick."
              : "Tu próxima ganadora empieza aquí. Añade tu primera elección."}
          </div>
        ) : (
          <ol aria-label={en ? "Your sample ballot" : "Tu quiniela de prueba"}>
            {ids.map((id, index) => {
              const candidate = category.candidates.find(
                (item) => item.id === id,
              )!;
              return (
                <li key={id}>
                  <b className="user-rank">{index + 1}</b>
                  <strong>{candidate.label}</strong>
                  <span className="ranking-controls">
                    <button
                      type="button"
                      disabled={!index}
                      aria-label={`${en ? "Move up" : "Subir"} ${candidate.label}`}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === ids.length - 1}
                      aria-label={`${en ? "Move down" : "Bajar"} ${candidate.label}`}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`${en ? "Remove" : "Quitar"} ${candidate.label}`}
                      onClick={() =>
                        update(ids.filter((value) => value !== id))
                      }
                    >
                      ×
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <p className="ballot-storage" role="status">
          {storageError
            ? en
              ? "This browser cannot keep your picks after you leave this page."
              : "Este navegador no puede conservar tus elecciones al salir de esta página."
            : en
              ? "Your draft stays in this browser for 30 days. Sign in to save it to your account."
              : "Tu borrador se guarda en este navegador durante 30 días. Entra para guardarlo en tu cuenta."}
        </p>
        {ids.length ? (
          <Link
            className="primary-button dark-button"
            onClick={() =>
              track("guest_ballot_save_intent", { category: category.id })
            }
            href={`${localizedPath("/acceso", locale)}?next=${encodeURIComponent(nextPath)}`}
          >
            {en ? "Keep my ballot →" : "Guardar mi quiniela →"}
          </Link>
        ) : null}
        <Link className="text-link" href={nextPath}>
          {en ? "Compare with the experts" : "Comparar con los expertos"} →
        </Link>
      </section>
      <section className="ballot-candidates">
        <label htmlFor="ballot-search">
          {en ? "Choose your contenders" : "Elige tus candidatas"}
        </label>
        <input
          type="search"
          id="ballot-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            en ? "Search by title or name" : "Buscar por título o nombre"
          }
        />
        <p>
          {en
            ? `Choose up to ${category.limit} picks, including one alternate.`
            : `Elige hasta ${category.limit} candidaturas, incluida una alternativa.`}
        </p>
        <div className="ballot-candidate-grid">
          {available.map((candidate) => (
            <button
              className="ballot-candidate"
              type="button"
              key={candidate.id}
              disabled={ids.length >= category.limit}
              onClick={() => update([...ids, candidate.id])}
            >
              <PosterBlock
                title={candidate.label}
                imagePath={
                  candidate.filmId
                    ? artwork[candidate.filmId]?.posterPath
                    : null
                }
                locale={locale}
                size="small"
              />
              <span>{candidate.label}</span>
              <small>{en ? "+ Add" : "+ Añadir"}</small>
            </button>
          ))}
        </div>
        {!available.length ? (
          <p>
            {en
              ? "No more candidates match your search."
              : "No hay más candidaturas que coincidan con tu búsqueda."}
          </p>
        ) : null}
      </section>
    </div>
  );
}
