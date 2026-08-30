import Link from "next/link";
import { getCurrentUser } from "../../lib/auth/session";
import {
  categoryById,
  rankingEntryLimit,
  type PublicCategoryId,
} from "../../lib/categories/config";
import type {
  FilmWatchState,
  RankingEntryInput,
} from "../../lib/community/validation";
import { localizedCategoryName } from "../../lib/i18n/categories";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";
import { RankingEditor } from "./RankingEditor";

export async function UserRankingPanel({
  candidates,
  categoryId,
  categoryName,
}: {
  candidates: Array<{ id: string; label: string; filmId: string | null }>;
  categoryId: PublicCategoryId;
  categoryName: string;
}) {
  const [current, locale] = await Promise.all([
    getCurrentUser(),
    getRequestLocale(),
  ]);
  const en = locale === "en";
  const category = categoryById(categoryId);
  const rankingLimit = rankingEntryLimit(categoryId);
  if (!category || rankingLimit === null) return null;
  const localizedName = localizedCategoryName(locale, categoryId, categoryName);
  if (!current) {
    return (
      <section className="ranking-lab ranking-locked">
        <div className="ranking-intro">
          <p className="section-index">
            {en ? "COMMUNITY · SEPARATE SIGNAL" : "COMUNIDAD · SEÑAL SEPARADA"}
          </p>
          <h2>
            {en
              ? `Your ${localizedName} ranking`
              : `Tu ranking de ${localizedName}`}
          </h2>
          <p>
            {en
              ? "Sign in to order candidates and decide whether the result will be public or private."
              : "Inicia sesión para ordenar candidaturas y decidir si el resultado será público o privado."}
          </p>
          <Link
            className="primary-button"
            href={localizedPath("/acceso", locale)}
          >
            {en ? "Sign in to rank" : "Entrar para ordenar"}
          </Link>
        </div>
        <div className="ranking-lock-copy">
          <strong>{en ? "Private by default" : "Privado por defecto"}</strong>
          <p>
            {en
              ? "Community rankings never change the points or positions in professional consensus."
              : "Ningún ranking comunitario altera los puntos ni las posiciones del consenso profesional."}
          </p>
        </div>
      </section>
    );
  }

  const [rankingResult, profileResult] = await Promise.all([
    current.supabase
      .from("user_rankings")
      .select("id,is_public")
      .eq("user_id", current.user.id)
      .eq("season_id", "oscars-2027")
      .eq("category_id", categoryId)
      .maybeSingle(),
    current.supabase
      .from("user_profiles")
      .select("is_public")
      .eq("user_id", current.user.id)
      .single(),
  ]);

  const ranking = rankingResult.data;
  const entriesResult = ranking
    ? await current.supabase
        .from("user_ranking_entries")
        .select(
          "category_candidate_id,custom_label,custom_kind,tmdb_url,qualifying_movie_tmdb_url,us_theatrical_release_date,tmdb_verified_at,position",
        )
        .eq("ranking_id", ranking.id)
        .eq("user_id", current.user.id)
        .order("position")
    : { data: [], error: null };
  const entries = entriesResult.data ?? [];
  const currentCandidateIds = new Set(
    candidates.map((candidate) => candidate.id),
  );
  const missingCandidateIds = entries
    .map((entry) => entry.category_candidate_id)
    .filter(
      (candidateId): candidateId is string =>
        Boolean(candidateId) && !currentCandidateIds.has(candidateId!),
    );
  const missingCandidatesResult = missingCandidateIds.length
    ? await current.supabase
        .from("category_candidates")
        .select("id,display_label,film_id")
        .in("id", missingCandidateIds)
    : { data: [], error: null };
  const editorCandidates = [
    ...candidates,
    ...(missingCandidatesResult.data ?? []).map((candidate) => ({
      id: candidate.id,
      label: `${candidate.display_label} · ${en ? "outside the current update" : "fuera de la actualización actual"}`,
      filmId: candidate.film_id,
    })),
  ];
  const filmIds = [
    ...new Set(
      editorCandidates
        .map((candidate) => candidate.filmId)
        .filter((filmId): filmId is string => Boolean(filmId)),
    ),
  ];
  const filmStatesResult = filmIds.length
    ? await current.supabase
        .from("user_film_states")
        .select("film_id,status")
        .eq("user_id", current.user.id)
        .in("film_id", filmIds)
    : { data: [], error: null };
  const statesByFilm = new Map(
    (filmStatesResult.data ?? []).map((state) => [
      state.film_id,
      state.status as FilmWatchState,
    ]),
  );
  const initialEntries = entries.reduce<RankingEntryInput[]>(
    (result, entry) => {
      if (entry.category_candidate_id) {
        result.push({
          kind: "candidate",
          candidateId: entry.category_candidate_id,
        });
      } else if (
        entry.custom_label &&
        entry.tmdb_url &&
        entry.us_theatrical_release_date &&
        entry.tmdb_verified_at
      ) {
        result.push({
          kind: "custom",
          label: entry.custom_label,
          tmdbUrl: entry.tmdb_url,
          qualifyingMovieTmdbUrl: entry.qualifying_movie_tmdb_url ?? undefined,
          usTheatricalReleaseDate: entry.us_theatrical_release_date,
          tmdbVerifiedAt: entry.tmdb_verified_at,
        });
      }
      return result;
    },
    [],
  );

  return (
    <section className="ranking-lab">
      <div className="ranking-intro">
        <p className="section-index">
          {en ? "COMMUNITY · SEPARATE SIGNAL" : "COMUNIDAD · SEÑAL SEPARADA"}
        </p>
        <h2>
          {en
            ? `Your ${localizedName} ranking`
            : `Tu ranking de ${localizedName}`}
        </h2>
        <p>
          {en
            ? "Rank only the candidates you want. Missing candidates remain unranked and do not become implicit votes."
            : "Ordena solo las candidaturas que quieras. Las ausencias quedan sin posición y no se transforman en votos implícitos."}
        </p>
        <div className="ranking-key">
          <span>
            {en ? "Profile" : "Perfil"}:{" "}
            {profileResult.data?.is_public
              ? en
                ? "public"
                : "público"
              : en
                ? "private"
                : "privado"}
          </span>
          <span>
            {en
              ? "One active ranking per season and category"
              : "Un ranking activo por temporada y categoría"}
          </span>
          <Link href={localizedPath("/cuenta", locale)}>
            {en ? "Manage privacy →" : "Gestionar privacidad →"}
          </Link>
        </div>
      </div>
      <RankingEditor
        candidates={editorCandidates}
        categoryId={categoryId}
        initialEntries={initialEntries}
        initialIsPublic={ranking?.is_public ?? false}
        initialFilmStates={filmIds.map((filmId) => ({
          filmId,
          state: statesByFilm.get(filmId) ?? "unmarked",
        }))}
        nomineeSlots={category.nomineeSlots}
        rankingExists={Boolean(ranking)}
        rankingLimit={rankingLimit}
        locale={locale}
      />
    </section>
  );
}
