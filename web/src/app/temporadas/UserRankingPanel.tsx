import Link from "next/link";
import { getCurrentUser } from "../../lib/auth/session";
import type { PublicCategoryId } from "../../lib/categories/config";
import { RankingEditor } from "./RankingEditor";

export async function UserRankingPanel({
  candidates,
  categoryId,
  categoryName,
}: {
  candidates: Array<{ id: string; label: string }>;
  categoryId: PublicCategoryId;
  categoryName: string;
}) {
  const current = await getCurrentUser();
  if (!current) {
    return (
      <section className="ranking-lab ranking-locked">
        <div className="ranking-intro">
          <p className="section-index">COMUNIDAD · SEÑAL SEPARADA</p>
          <h2>Tu ranking de {categoryName}</h2>
          <p>
            Inicia sesión para ordenar candidaturas y decidir si el resultado
            será público o privado.
          </p>
          <Link className="primary-button" href="/acceso">
            Entrar para ordenar
          </Link>
        </div>
        <div className="ranking-lock-copy">
          <strong>Privado por defecto</strong>
          <p>
            Ningún ranking comunitario altera los puntos ni las posiciones del
            consenso profesional.
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
        .select("category_candidate_id,position")
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
    .filter((candidateId) => !currentCandidateIds.has(candidateId));
  const missingCandidatesResult = missingCandidateIds.length
    ? await current.supabase
        .from("category_candidates")
        .select("id,display_label")
        .in("id", missingCandidateIds)
    : { data: [], error: null };
  const editorCandidates = [
    ...candidates,
    ...(missingCandidatesResult.data ?? []).map((candidate) => ({
      id: candidate.id,
      label: `${candidate.display_label} · fuera del corte actual`,
    })),
  ];

  return (
    <section className="ranking-lab">
      <div className="ranking-intro">
        <p className="section-index">COMUNIDAD · SEÑAL SEPARADA</p>
        <h2>Tu ranking de {categoryName}</h2>
        <p>
          Ordena solo las candidaturas que quieras. Las ausencias quedan sin
          posición y no se transforman en votos implícitos.
        </p>
        <div className="ranking-key">
          <span>
            Perfil: {profileResult.data?.is_public ? "público" : "privado"}
          </span>
          <span>Un ranking activo por temporada y categoría</span>
          <Link href="/cuenta">Gestionar privacidad →</Link>
        </div>
      </div>
      {editorCandidates.length ? (
        <RankingEditor
          candidates={editorCandidates}
          categoryId={categoryId}
          initialCandidateIds={entries.map(
            (entry) => entry.category_candidate_id,
          )}
          initialIsPublic={ranking?.is_public ?? false}
          rankingExists={Boolean(ranking)}
        />
      ) : (
        <p>No hay candidaturas disponibles para ordenar.</p>
      )}
    </section>
  );
}
