"use client";

import { useActionState, useMemo, useState } from "react";
import {
  deleteRankingAction,
  saveRankingAction,
  type CommunityFormState,
} from "../comunidad/actions";

const initialCommunityFormState: CommunityFormState = {
  message: "",
  tone: "idle",
};

type Candidate = {
  id: string;
  label: string;
};

export function RankingEditor({
  candidates,
  categoryId,
  initialCandidateIds,
  initialIsPublic,
  rankingExists,
}: {
  candidates: Candidate[];
  categoryId: string;
  initialCandidateIds: string[];
  initialIsPublic: boolean;
  rankingExists: boolean;
}) {
  const defaultIds = initialCandidateIds.length
    ? initialCandidateIds
    : candidates.map((candidate) => candidate.id);
  const [selectedIds, setSelectedIds] = useState(defaultIds);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
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
        <input name="seasonId" type="hidden" value="oscars-2027" />
        <input name="categoryId" type="hidden" value={categoryId} />
        <input
          name="candidateIds"
          type="hidden"
          value={JSON.stringify(selectedIds)}
        />
        <ol aria-label="Tu ranking">
          {selectedIds.map((candidateId, index) => {
            const candidate = candidateById.get(candidateId);
            if (!candidate) return null;
            return (
              <li key={candidate.id}>
                <span className="user-rank">{index + 1}</span>
                <span className="ranking-swatch" aria-hidden="true" />
                <span className="ranking-film">
                  <strong>{candidate.label}</strong>
                  <button
                    onClick={() =>
                      setSelectedIds((current) =>
                        current.filter((id) => id !== candidate.id),
                      )
                    }
                    type="button"
                  >
                    Quitar del ranking
                  </button>
                </span>
                <span className="ranking-controls">
                  <button
                    aria-label={`Subir ${candidate.label}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Bajar ${candidate.label}`}
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
            <span>Añadir candidatura</span>
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
          Ranking público
        </label>
        <div className="ranking-save-row">
          <button
            className="primary-button"
            disabled={pending || selectedIds.length === 0}
          >
            {pending ? "Guardando…" : "Guardar ranking"}
          </button>
          <span
            aria-live="polite"
            className={state.tone === "error" ? "error-text" : ""}
          >
            {state.message ||
              `${selectedIds.length} posiciones explícitas · sin extrapolar ausencias`}
          </span>
        </div>
      </form>

      {rankingExists ? (
        <form action={deleteRankingAction} className="ranking-delete-form">
          <input name="seasonId" type="hidden" value="oscars-2027" />
          <input name="categoryId" type="hidden" value={categoryId} />
          <button type="submit">Eliminar este ranking</button>
        </form>
      ) : null}
    </div>
  );
}
