"use client";

import { useActionState, useMemo, useState } from "react";
import {
  deleteRankingAction,
  saveRankingAction,
  type CommunityFormState,
} from "../comunidad/actions";
import {
  manualTmdbPreviewSchema,
  type FilmWatchState,
  type RankingEntryInput,
} from "../../lib/community/validation";
import { rankingRequiresPersonEntry } from "../../lib/categories/config";
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

function formatReleaseDate(value: string, locale: Locale) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "es-ES", {
    dateStyle: "medium",
  }).format(new Date(year, month - 1, day));
}

function manualVerificationErrorMessage(code: string, en: boolean) {
  const messages: Record<string, [string, string]> = {
    invalid_url: [
      "Introduce un enlace válido de TMDB.",
      "Enter a valid TMDB link.",
    ],
    wrong_kind: [
      "El tipo de enlace TMDB no corresponde con esta categoría.",
      "That TMDB link type does not match this category.",
    ],
    not_found: [
      "TMDB no encuentra esa ficha.",
      "TMDB could not find that record.",
    ],
    no_us_theatrical_release: [
      "TMDB no registra un estreno teatral en salas de EE. UU. para esta película.",
      "TMDB does not record a US theatrical release for this film.",
    ],
    outside_eligibility_year: [
      "El estreno teatral en EE. UU. no cae dentro del año de elegibilidad de esta temporada.",
      "The US theatrical release is outside this season's eligibility year.",
    ],
    person_not_credited: [
      "TMDB no acredita a esa persona en la película indicada.",
      "TMDB does not credit that person in the selected film.",
    ],
    missing_token: [
      "La verificación TMDB no está configurada en este entorno.",
      "TMDB verification is not configured in this environment.",
    ],
    verification_unavailable: [
      "No se ha podido comprobar TMDB ahora. Vuelve a intentarlo.",
      "TMDB could not be checked right now. Try again.",
    ],
  };
  return (
    messages[code]?.[en ? 1 : 0] ??
    messages.verification_unavailable[en ? 1 : 0]
  );
}

export function RankingEditor({
  candidates,
  categoryId,
  initialEntries,
  initialIsPublic,
  initialFilmStates,
  nomineeSlots,
  rankingExists,
  rankingLimit,
  locale,
}: {
  candidates: Candidate[];
  categoryId: string;
  initialEntries: RankingEntryInput[];
  initialIsPublic: boolean;
  initialFilmStates: Array<{ filmId: string; state: FilmWatchState }>;
  nomineeSlots: number;
  rankingExists: boolean;
  rankingLimit: number;
  locale: Locale;
}) {
  const en = locale === "en";
  const requiresPerson = rankingRequiresPersonEntry(categoryId);
  const [selectedEntries, setSelectedEntries] = useState(initialEntries);
  const [tmdbUrl, setTmdbUrl] = useState("");
  const [qualifyingMovieTmdbUrl, setQualifyingMovieTmdbUrl] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
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
  const selectedCandidateIds = useMemo(
    () =>
      new Set(
        selectedEntries.flatMap((entry) =>
          entry.kind === "candidate" ? [entry.candidateId] : [],
        ),
      ),
    [selectedEntries],
  );
  const hasCustomEntry = selectedEntries.some(
    (entry) => entry.kind === "custom",
  );
  const available = candidates.filter(
    (candidate) => !selectedCandidateIds.has(candidate.id),
  );
  const atLimit = selectedEntries.length >= rankingLimit;
  const filmStateUpdates = selectedEntries.flatMap((entry) => {
    if (entry.kind !== "candidate") return [];
    const filmId = candidateById.get(entry.candidateId)?.filmId;
    return filmId ? [{ filmId, state: filmStates[filmId] ?? "unmarked" }] : [];
  });

  function move(index: number, offset: number) {
    setSelectedEntries((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function addCustomEntry() {
    if (atLimit || hasCustomEntry || !tmdbUrl.trim()) return;
    setVerificationPending(true);
    setVerificationMessage("");
    try {
      const response = await fetch("/api/comunidad/verificar-tmdb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonId: "oscars-2027",
          categoryId,
          tmdbUrl: tmdbUrl.trim(),
          qualifyingMovieTmdbUrl: requiresPerson
            ? qualifyingMovieTmdbUrl.trim()
            : undefined,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== "object") {
        const code =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "verification_unavailable";
        setVerificationMessage(manualVerificationErrorMessage(code, en));
        return;
      }
      const entry = manualTmdbPreviewSchema.safeParse(
        "entry" in payload ? payload.entry : null,
      );
      if (!entry.success) {
        setVerificationMessage(
          manualVerificationErrorMessage("verification_unavailable", en),
        );
        return;
      }
      setSelectedEntries((current) => [
        ...current,
        {
          kind: "custom",
          label: entry.data.label,
          tmdbUrl: entry.data.tmdbUrl,
          qualifyingMovieTmdbUrl:
            entry.data.qualifyingMovieTmdbUrl ?? undefined,
          usTheatricalReleaseDate: entry.data.usTheatricalReleaseDate,
          tmdbVerifiedAt: entry.data.tmdbVerifiedAt,
        },
      ]);
      setTmdbUrl("");
      setQualifyingMovieTmdbUrl("");
      setVerificationMessage(
        en
          ? `Verified in TMDB · US theatrical release ${formatReleaseDate(entry.data.usTheatricalReleaseDate, locale)}`
          : `Verificado en TMDB · estreno en salas de EE. UU. ${formatReleaseDate(entry.data.usTheatricalReleaseDate, locale)}`,
      );
    } catch {
      setVerificationMessage(
        manualVerificationErrorMessage("verification_unavailable", en),
      );
    } finally {
      setVerificationPending(false);
    }
  }

  function addCandidate(candidateId: string) {
    setSelectedEntries((current) => {
      if (
        current.length >= rankingLimit ||
        current.some(
          (entry) =>
            entry.kind === "candidate" && entry.candidateId === candidateId,
        )
      ) {
        return current;
      }
      return [...current, { kind: "candidate", candidateId }];
    });
  }

  return (
    <div className="ranking-editor">
      <form action={action}>
        <input name="locale" type="hidden" value={locale} />
        <input name="seasonId" type="hidden" value="oscars-2027" />
        <input name="categoryId" type="hidden" value={categoryId} />
        <input
          name="rankingEntries"
          type="hidden"
          value={JSON.stringify(selectedEntries)}
        />
        <input
          name="filmStates"
          type="hidden"
          value={JSON.stringify(filmStateUpdates)}
        />

        <div className="ranking-limit-copy">
          <strong>
            {selectedEntries.length}/{rankingLimit}
          </strong>
          <span>
            {en
              ? `${nomineeSlots} nominee slots + 1 alternate`
              : `${nomineeSlots} plazas de nominación + 1 alternativa`}
          </span>
        </div>

        <ol aria-label={en ? "Your ranking" : "Tu ranking"}>
          {selectedEntries.map((entry, index) => {
            const candidate =
              entry.kind === "candidate"
                ? candidateById.get(entry.candidateId)
                : null;
            const label =
              entry.kind === "custom" ? entry.label : candidate?.label;
            if (!label) return null;
            const filmId = candidate?.filmId ?? null;
            const entryKey =
              entry.kind === "candidate"
                ? `candidate:${entry.candidateId}`
                : `custom:${entry.tmdbUrl}`;
            return (
              <li key={entryKey}>
                <span className="user-rank">{index + 1}</span>
                <span
                  className={`ranking-swatch${entry.kind === "custom" ? " is-custom" : ""}`}
                  aria-hidden="true"
                />
                <span className="ranking-film">
                  <strong>{label}</strong>
                  {entry.kind === "custom" ? (
                    <>
                      <small className="ranking-custom-badge">
                        {en
                          ? "Not tracked by Runscars · TMDB verified"
                          : "No rastreado por Runscars · TMDB verificado"}
                      </small>
                      <small className="ranking-custom-meta">
                        {en
                          ? "US theatrical release"
                          : "Estreno en salas de EE. UU."}
                        :{" "}
                        {entry.usTheatricalReleaseDate
                          ? formatReleaseDate(
                              entry.usTheatricalReleaseDate,
                              locale,
                            )
                          : en
                            ? "not available"
                            : "sin fecha"}{" "}
                        ·{" "}
                        <a
                          href={entry.tmdbUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          TMDB ↗
                        </a>
                      </small>
                    </>
                  ) : null}
                  {filmId ? (
                    <span
                      className="ranking-watch-control"
                      role="group"
                      aria-label={`${en ? "Watch state for" : "Visionado de"} ${label}`}
                    >
                      <small>{en ? "Watch state" : "Visionado"}</small>
                      {(["watched", "not_watched", "unmarked"] as const).map(
                        (nextState) => (
                          <button
                            aria-pressed={
                              (filmStates[filmId] ?? "unmarked") === nextState
                            }
                            className={
                              (filmStates[filmId] ?? "unmarked") === nextState
                                ? "is-selected"
                                : ""
                            }
                            onClick={() =>
                              setFilmStates((current) => ({
                                ...current,
                                [filmId]: nextState,
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
                      setSelectedEntries((current) =>
                        current.filter((_, entryIndex) => entryIndex !== index),
                      )
                    }
                    type="button"
                  >
                    {en ? "Remove from ranking" : "Quitar del ranking"}
                  </button>
                </span>
                <span className="ranking-controls">
                  <button
                    aria-label={`${en ? "Move up" : "Subir"} ${label}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`${en ? "Move down" : "Bajar"} ${label}`}
                    disabled={index === selectedEntries.length - 1}
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
            <span>
              {en ? "Add tracked candidate" : "Añadir candidatura rastreada"}
            </span>
            <div>
              {available.map((candidate) => (
                <button
                  disabled={atLimit}
                  key={candidate.id}
                  onClick={() => addCandidate(candidate.id)}
                  type="button"
                >
                  + {candidate.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!hasCustomEntry ? (
          <div className="ranking-custom-entry">
            <div className="ranking-custom-heading">
              <label htmlFor={`custom-ranking-entry-${categoryId}`}>
                {en
                  ? "Add one candidate not tracked by Runscars"
                  : "Añade una candidatura no rastreada por Runscars"}
              </label>
              <small>
                {en
                  ? "A TMDB link and a qualifying US theatrical release are required."
                  : "Necesitamos un enlace TMDB y un estreno teatral elegible en EE. UU."}
              </small>
            </div>
            <label htmlFor={`custom-ranking-entry-${categoryId}`}>
              {requiresPerson
                ? en
                  ? "Person TMDB link"
                  : "Enlace TMDB de la persona"
                : en
                  ? "Film TMDB link"
                  : "Enlace TMDB de la película"}
            </label>
            <input
              disabled={atLimit || verificationPending}
              id={`custom-ranking-entry-${categoryId}`}
              onChange={(event) => setTmdbUrl(event.target.value)}
              placeholder={
                requiresPerson
                  ? "https://www.themoviedb.org/person/..."
                  : "https://www.themoviedb.org/movie/..."
              }
              type="url"
              value={tmdbUrl}
            />
            {requiresPerson ? (
              <>
                <label htmlFor={`qualifying-film-${categoryId}`}>
                  {en
                    ? "Qualifying film TMDB link"
                    : "Enlace TMDB de la película elegible"}
                </label>
                <input
                  disabled={atLimit || verificationPending}
                  id={`qualifying-film-${categoryId}`}
                  onChange={(event) =>
                    setQualifyingMovieTmdbUrl(event.target.value)
                  }
                  placeholder="https://www.themoviedb.org/movie/..."
                  type="url"
                  value={qualifyingMovieTmdbUrl}
                />
              </>
            ) : null}
            <div>
              <button
                disabled={
                  atLimit ||
                  verificationPending ||
                  !tmdbUrl.trim() ||
                  (requiresPerson && !qualifyingMovieTmdbUrl.trim())
                }
                onClick={addCustomEntry}
                type="button"
              >
                {verificationPending
                  ? en
                    ? "Checking TMDB…"
                    : "Comprobando TMDB…"
                  : en
                    ? "Verify and add"
                    : "Verificar y añadir"}
              </button>
            </div>
            {verificationMessage ? (
              <p className="ranking-verification-message" role="status">
                {verificationMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {atLimit ? (
          <p className="ranking-limit-reached" role="status">
            {en
              ? "Category limit reached. Remove one position to add another."
              : "Has alcanzado el límite de la categoría. Quita una posición para añadir otra."}
          </p>
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
            disabled={
              pending || verificationPending || selectedEntries.length === 0
            }
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
              `${selectedEntries.length} ${en ? "explicit positions · missing candidates are not extrapolated" : "posiciones explícitas · sin extrapolar ausencias"}`}
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
