"use client";

import { useActionState, useMemo, useState } from "react";
import {
  deleteRankingAction,
  saveRankingAction,
  type CommunityFormState,
} from "../comunidad/actions";
import type { FilmWatchState } from "../../lib/community/validation";
import type { Locale } from "../../lib/i18n/config";

const initialCommunityFormState: CommunityFormState = {
  message: "",
  tone: "idle",
};

type Candidate = {
  id: string;
  label: string;
  filmId: string | null;
};

export function RankingEditor({
  candidates,
  categoryId,
  initialCandidateIds,
  initialIsPublic,
  initialFilmStates,
  rankingExists,
  locale,
}: {
  candidates: Candidate[];
  categoryId: string;
  initialCandidateIds: string[];
  initialIsPublic: boolean;
  initialFilmStates: Array<{ filmId: string; state: FilmWatchState }>;
  rankingExists: boolean;
  locale: Locale;
}) {
  const en = locale === "en";
  const defaultIds = initialCandidateIds.length
    ? initialCandidateIds
    : candidates.map((candidate) => candidate.id);
  const [selectedIds, setSelectedIds] = useState(defaultIds);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [filmStates, setFilmStates] = useState<Record<string, FilmWatchState>>(
    () =>
      Object.fromEntries(
        initialFilmStates.map((item) => [item.filmId, item.state]),
      ),
  );
  const [state, action, pending] = useActionState(
    saveRankingAction,
    initialCommunityFormState,
  );
  const candidateById = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.id, candidate])),
    [candidates],
  );
  const available = candidates.filter(
    (candidate) => !selectedIds.includes(candidate.id),
  );
  const filmStateUpdates = selectedIds.flatMap((candidateId) => {
    const filmId = candidateById.get(candidateId)?.filmId;
    return filmId ? [{ filmId, state: filmStates[filmId] ?? "unmarked" }] : [];
  });

  function move(index: number, offset: number) {
    setSelectedIds((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="ranking-editor">
      <form action={action}>
        <input name="locale" type="hidden" value={locale} />
        <input name="seasonId" type="hidden" value="oscars-2027" />
        <input name="categoryId" type="hidden" value={categoryId} />
        <input
          name="candidateIds"
          type="hidden"
          value={JSON.stringify(selectedIds)}
        />
        <input
          name="filmStates"
          type="hidden"
          value={JSON.stringify(filmStateUpdates)}
        />
        <ol aria-label={en ? "Your ranking" : "Tu ranking"}>
          {selectedIds.map((candidateId, index) => {
            const candidate = candidateById.get(candidateId);
            if (!candidate) return null;
            return (
              <li key={candidate.id}>
                <span className="user-rank">{index + 1}</span>
                <span className="ranking-swatch" aria-hidden="true" />
                <span className="ranking-film">
                  <strong>{candidate.label}</strong>
                  {candidate.filmId ? (
                    <span
                      className="ranking-watch-control"
                      role="group"
                      aria-label={`${en ? "Watch state for" : "Visionado de"} ${candidate.label}`}
                    >
                      <small>{en ? "Watch state" : "Visionado"}</small>
                      {(["watched", "not_watched", "unmarked"] as const).map(
                        (nextState) => (
                          <button
                            aria-pressed={
                              (filmStates[candidate.filmId!] ?? "unmarked") ===
                              nextState
                            }
                            className={
                              (filmStates[candidate.filmId!] ?? "unmarked") ===
                              nextState
                                ? "is-selected"
                                : ""
                            }
                            onClick={() =>
                              setFilmStates((current) => ({
                                ...current,
                                [candidate.filmId!]: nextState,
                              }))
                            }
                            type="button"
                            key={nextState}
                          >
                            {nextState === "watched"
                              ? en
                                ? "Watched"
                                : "Vista"
                              : nextState === "not_watched"
                                ? en
                                  ? "Not watched"
                                  : "No vista"
                                : en
                                  ? "Unmarked"
                                  : "No indicada"}
                          </button>
                        ),
                      )}
                    </span>
                  ) : null}
                  <button
                    onClick={() =>
                      setSelectedIds((current) =>
                        current.filter((id) => id !== candidate.id),
                      )
                    }
                    type="button"
                  >
                    {en ? "Remove from ranking" : "Quitar del ranking"}
                  </button>
                </span>
                <span className="ranking-controls">
                  <button
                    aria-label={`${en ? "Move up" : "Subir"} ${candidate.label}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`${en ? "Move down" : "Bajar"} ${candidate.label}`}
                    disabled={index === selectedIds.length - 1}
                    onClick={() => move(index, 1)}
                    type="button"
                  >
                    ↓
                  </button>
                </span>
              </li>
            );
          })}
        </ol>

        {available.length ? (
          <div className="ranking-available">
            <span>{en ? "Add candidate" : "Añadir candidatura"}</span>
            <div>
              {available.map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() =>
                    setSelectedIds((current) => [...current, candidate.id])
                  }
                  type="button"
                >
                  + {candidate.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label className="check-row ranking-visibility">
          <input
            checked={isPublic}
            name="isPublic"
            onChange={(event) => setIsPublic(event.target.checked)}
            type="checkbox"
          />
          {en ? "Public ranking" : "Ranking público"}
        </label>
        <div className="ranking-save-row">
          <button
            className="primary-button"
            disabled={pending || selectedIds.length === 0}
          >
            {pending
              ? en
                ? "Saving…"
                : "Guardando…"
              : en
                ? "Save ranking"
                : "Guardar ranking"}
          </button>
          <span
            aria-live="polite"
            className={state.tone === "error" ? "error-text" : ""}
          >
            {state.message ||
              `${selectedIds.length} ${en ? "explicit positions · missing candidates are not extrapolated" : "posiciones explícitas · sin extrapolar ausencias"}`}
          </span>
        </div>
      </form>

      {rankingExists ? (
        <form action={deleteRankingAction} className="ranking-delete-form">
          <input name="locale" type="hidden" value={locale} />
          <input name="seasonId" type="hidden" value="oscars-2027" />
          <input name="categoryId" type="hidden" value={categoryId} />
          <button type="submit">
            {en ? "Delete this ranking" : "Eliminar este ranking"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
