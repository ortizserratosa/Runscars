import { createClient } from "@supabase/supabase-js";
import { canonicalJson, normalizeIdentity, prepareBatch } from "./core.mjs";
import { expandCatalogFromBatch } from "./tmdb-expansion.mjs";

function databaseError(result, action) {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message}`);
  }
  return result.data;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  const workerCount = Math.max(
    1,
    Math.min(items.length || 1, Number(concurrency) || 1),
  );
  let nextIndex = 0;
  let firstError = null;

  const workers = Array.from({ length: workerCount }, async () => {
    while (firstError === null) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        firstError ??= error;
      }
    }
  });

  await Promise.all(workers);
  if (firstError !== null) throw firstError;
  return results;
}

export class SupabaseIngestionRepository {
  constructor({ supabaseUrl, serviceRoleKey }) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    }
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async activeConnectors(selectedIds = null) {
    let query = this.client
      .from("source_connectors")
      .select("*")
      .eq("is_active", true)
      .order("id");
    if (selectedIds?.length) query = query.in("id", selectedIds);
    return databaseError(await query, "No se pudieron leer los conectores");
  }

  async filmIdentities(seasonId) {
    const links = databaseError(
      await this.client
        .from("season_films")
        .select(
          "films(id,title,alternate_titles,film_credits(role,department,billing_order,people(id,name,alternate_names)))",
        )
        .eq("season_id", seasonId),
      "No se pudo cargar el catálogo de matching",
    );
    return links
      .map((link) => {
        const film = Array.isArray(link.films) ? link.films[0] : link.films;
        if (!film) return null;
        return {
          ...film,
          credits: (film.film_credits ?? []).flatMap((credit) => {
            const person = Array.isArray(credit.people)
              ? credit.people[0]
              : credit.people;
            return person
              ? [
                  {
                    role: credit.role,
                    department: credit.department,
                    billingOrder: credit.billing_order,
                    person,
                  },
                ]
              : [];
          }),
        };
      })
      .filter(Boolean);
  }

  async seasonIdentity(seasonId) {
    const season = databaseError(
      await this.client
        .from("seasons")
        .select("eligibility_year")
        .eq("id", seasonId)
        .single(),
      "No se pudo cargar la temporada",
    );
    if (!season.eligibility_year) {
      throw new Error("La temporada no tiene año de elegibilidad");
    }
    return { eligibilityYear: season.eligibility_year };
  }

  async saveAutomaticTmdbFilm({
    filmIdBase,
    seasonId,
    eligibilityYear,
    raw,
    credits,
    snapshot,
    query,
  }) {
    const existingByTmdb = databaseError(
      await this.client
        .from("films")
        .select("id")
        .eq("tmdb_id", raw.id)
        .maybeSingle(),
      "No se pudo buscar la película TMDB",
    );
    if (existingByTmdb) {
      databaseError(
        await this.client
          .from("season_films")
          .upsert(
            { season_id: seasonId, film_id: existingByTmdb.id },
            { onConflict: "season_id,film_id", ignoreDuplicates: true },
          ),
        "No se pudo vincular la película existente",
      );
      return existingByTmdb.id;
    }
    const idCollision = databaseError(
      await this.client
        .from("films")
        .select("id")
        .eq("id", filmIdBase)
        .maybeSingle(),
      "No se pudo comprobar el ID de película",
    );
    const filmId = idCollision ? `${filmIdBase}-${raw.id}` : filmIdBase;
    const fetchedAt = snapshot.fetched_at;
    databaseError(
      await this.client
        .from("tmdb_movies")
        .upsert(
          { tmdb_id: raw.id, last_checked_at: fetchedAt },
          { onConflict: "tmdb_id" },
        ),
      "No se pudo guardar la identidad TMDB",
    );
    databaseError(
      await this.client.from("tmdb_movie_snapshots").upsert(snapshot, {
        onConflict: "tmdb_id,locale,content_hash",
        ignoreDuplicates: true,
      }),
      "No se pudo guardar la captura TMDB",
    );
    databaseError(
      await this.client.from("films").insert({
        id: filmId,
        title: raw.title,
        alternate_titles:
          raw.original_title && raw.original_title !== raw.title
            ? [raw.original_title]
            : [],
        eligibility_year: eligibilityYear,
        release_status: raw.release_date ? "released" : "upcoming",
        release_date: raw.release_date || null,
        verification_url: `https://www.themoviedb.org/movie/${raw.id}`,
        notes: "Coincidencia automática exacta y única; fase 7.1",
      }),
      "No se pudo crear la película",
    );
    databaseError(
      await this.client.rpc("record_film_tmdb_match", {
        target_film_id: filmId,
        target_tmdb_id: raw.id,
        match_method: "search_exact",
        match_query: query,
        match_reason:
          "Título o alias, temporada y estreno producen una coincidencia única",
        match_actor: "automatic-ingestion-v2",
      }),
      "No se pudo auditar el matching TMDB",
    );
    databaseError(
      await this.client.from("season_films").insert({
        season_id: seasonId,
        film_id: filmId,
      }),
      "No se pudo vincular la película",
    );
    for (const credit of credits) {
      databaseError(
        await this.client.from("tmdb_people").upsert(
          {
            tmdb_id: credit.tmdbPersonId,
            last_checked_at: fetchedAt,
          },
          { onConflict: "tmdb_id" },
        ),
        "No se pudo guardar la identidad de persona",
      );
      databaseError(
        await this.client.from("people").upsert(
          {
            id: `tmdb-${credit.tmdbPersonId}`,
            name: credit.name,
            tmdb_id: credit.tmdbPersonId,
          },
          { onConflict: "tmdb_id" },
        ),
        "No se pudo guardar la persona",
      );
    }
    if (credits.length) {
      databaseError(
        await this.client.from("film_credits").upsert(
          credits.map((credit) => ({
            film_id: filmId,
            person_id: `tmdb-${credit.tmdbPersonId}`,
            tmdb_credit_id: credit.tmdbCreditId,
            credit_kind: credit.kind,
            role: credit.role,
            department: credit.department,
            billing_order: credit.billingOrder,
          })),
          { onConflict: "film_id,tmdb_credit_id" },
        ),
        "No se pudieron guardar los créditos",
      );
    }
    return filmId;
  }

  async ensureCandidate(candidate) {
    if (!candidate) return null;
    databaseError(
      await this.client.from("category_candidates").upsert(
        {
          id: candidate.id,
          season_id: candidate.seasonId,
          category_id: candidate.categoryId,
          film_id: candidate.filmId,
          work_title: candidate.workTitle,
          display_label: candidate.displayLabel,
          identity_key: candidate.identityKey,
        },
        { onConflict: "season_id,category_id,identity_key" },
      ),
      "No se pudo guardar la candidatura",
    );
    if (candidate.people.length) {
      databaseError(
        await this.client.from("category_candidate_people").upsert(
          candidate.people.map((person) => ({
            category_candidate_id: candidate.id,
            person_id: person.id,
            role: person.role,
            display_order: person.displayOrder,
          })),
          {
            onConflict: "category_candidate_id,person_id,role",
            ignoreDuplicates: true,
          },
        ),
        "No se pudieron guardar los colaboradores de la candidatura",
      );
    }
    return candidate.id;
  }

  async beginRun({ connectorId, trigger, startedAt, runKey }) {
    const data = databaseError(
      await this.client
        .from("ingestion_runs")
        .insert({
          connector_id: connectorId,
          trigger,
          started_at: startedAt,
          run_key: runKey,
        })
        .select("id")
        .single(),
      "No se pudo iniciar la ejecución",
    );
    return data.id;
  }

  async failStaleRuns({ connectorId, staleBefore, recoveredAt }) {
    const staleRuns = databaseError(
      await this.client
        .from("ingestion_runs")
        .update({
          status: "failed",
          finished_at: recoveredAt,
          error_summary:
            "Ejecución abandonada; recuperada antes de iniciar un nuevo intento",
        })
        .eq("connector_id", connectorId)
        .eq("status", "running")
        .lt("started_at", staleBefore)
        .select("id"),
      "No se pudieron recuperar las ejecuciones abandonadas",
    );
    if (staleRuns.length) {
      databaseError(
        await this.client.from("ingestion_run_events").insert(
          staleRuns.map(({ id }) => ({
            run_id: id,
            level: "error",
            code: "connector.abandoned",
            message:
              "La ejecución se cerró al superar el umbral operativo sin terminar",
            context: {
              recovered_at: recoveredAt,
              stale_before: staleBefore,
              recovery_connector_id: connectorId,
            },
          })),
        ),
        "No se pudo auditar la recuperación de ejecuciones abandonadas",
      );
    }
    return staleRuns.length;
  }

  async addEvent(runId, level, code, message, context = {}) {
    databaseError(
      await this.client.from("ingestion_run_events").insert({
        run_id: runId,
        level,
        code,
        message,
        context,
      }),
      "No se pudo guardar el evento",
    );
  }

  async savePublication(batch, publication) {
    let existing = databaseError(
      await this.client
        .from("source_publications")
        .select("id")
        .eq("source_id", batch.sourceId)
        .eq("external_id", publication.externalId)
        .maybeSingle(),
      "No se pudo buscar la publicación por identidad",
    );
    if (!existing && publication.isMutable !== true) {
      existing = databaseError(
        await this.client
          .from("source_publications")
          .select("id")
          .eq("source_id", batch.sourceId)
          .eq("canonical_url", publication.canonicalUrl)
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle(),
        "No se pudo buscar la publicación por URL canónica",
      );
    }
    if (existing) {
      databaseError(
        await this.client
          .from("source_publications")
          .update({
            title: publication.title,
            author: publication.author,
            published_at: publication.publishedAt,
          })
          .eq("id", existing.id),
        "No se pudo actualizar la publicación",
      );
      await this.savePublicationDiscoveries(batch, existing.id, publication);
      return existing.id;
    }
    const data = databaseError(
      await this.client
        .from("source_publications")
        .upsert(
          {
            source_id: batch.sourceId,
            external_id: publication.externalId,
            canonical_url: publication.canonicalUrl,
            title: publication.title,
            author: publication.author,
            published_at: publication.publishedAt,
          },
          { onConflict: "source_id,external_id" },
        )
        .select("id")
        .single(),
      "No se pudo guardar la publicación",
    );
    await this.savePublicationDiscoveries(batch, data.id, publication);
    return data.id;
  }

  async savePublicationDiscoveries(batch, publicationId, publication) {
    if (!publication.discoveredVia?.length) return;
    databaseError(
      await this.client.from("source_publication_discoveries").upsert(
        publication.discoveredVia.map((discovery) => ({
          publication_id: publicationId,
          discovery_source_id: discovery.sourceId,
          discovery_url: discovery.url,
          discovered_at: discovery.discoveredAt ?? batch.capturedAt,
          original_data: {
            source_id: discovery.sourceId,
            url: discovery.url,
            discovered_at: discovery.discoveredAt ?? batch.capturedAt,
            entered_manually: true,
          },
        })),
        {
          onConflict: "publication_id,discovery_source_id,discovery_url",
          ignoreDuplicates: true,
        },
      ),
      "No se pudo guardar la procedencia de descubrimiento",
    );
  }

  async saveCapture(batch, publicationId, publication) {
    const data = databaseError(
      await this.client
        .from("source_publication_captures")
        .upsert(
          {
            publication_id: publicationId,
            content_hash: publication.contentHash,
            source_url: publication.canonicalUrl,
            original_data: publication.originalData,
            captured_at: batch.capturedAt,
            extractor_version: batch.extractorVersion,
          },
          {
            onConflict: "publication_id,content_hash",
            ignoreDuplicates: true,
          },
        )
        .select("id"),
      "No se pudo guardar la captura",
    );
    if (data.length) return { id: data[0].id, inserted: true };
    const existing = databaseError(
      await this.client
        .from("source_publication_captures")
        .select("id")
        .eq("publication_id", publicationId)
        .eq("content_hash", publication.contentHash)
        .single(),
      "No se pudo recuperar la captura existente",
    );
    return { id: existing.id, inserted: false };
  }

  async saveObservation({
    batch,
    publication,
    publicationId,
    captureId,
    runId,
    observation,
  }) {
    let equivalentQuery = this.client
      .from("professional_observations")
      .select("id,state,original_value")
      .eq("source_id", batch.sourceId)
      .eq("publication_id", publicationId)
      .eq("original_subject", observation.subject)
      .eq("data_type", observation.dataType);
    equivalentQuery = observation.categoryId
      ? equivalentQuery.eq("category_id", observation.categoryId)
      : equivalentQuery.is("category_id", null);
    equivalentQuery = observation.predictionIntention
      ? equivalentQuery.eq(
          "prediction_intention",
          observation.predictionIntention,
        )
      : equivalentQuery.is("prediction_intention", null);
    const equivalentRows = databaseError(
      await equivalentQuery,
      "No se pudo comprobar la identidad de la observación",
    );
    const equivalent = equivalentRows.find(
      (row) =>
        canonicalJson(row.original_value) ===
        canonicalJson(observation.originalValue),
    );
    if (equivalent) {
      await this.reconcilePendingObservation({
        batch,
        observation,
        observationId: equivalent.id,
        previousState: equivalent.state,
      });
      return {
        id: equivalent.id,
        inserted: false,
        state:
          equivalent.state === "pending_review"
            ? observation.state
            : equivalent.state,
      };
    }

    const data = databaseError(
      await this.client
        .from("professional_observations")
        .upsert(
          {
            dedupe_key: observation.dedupeKey,
            source_id: batch.sourceId,
            publication_id: publicationId,
            capture_id: captureId,
            run_id: runId,
            season_id: batch.seasonId,
            film_id: observation.filmId,
            person_id: observation.personId,
            category_id: observation.categoryId,
            category_candidate_id: observation.categoryCandidateId,
            data_type: observation.dataType,
            prediction_intention: observation.predictionIntention,
            original_subject: observation.subject,
            original_value: observation.originalValue,
            original_scale: observation.originalScale,
            source_url: publication.canonicalUrl,
            author: publication.author,
            published_at: publication.publishedAt,
            captured_at: batch.capturedAt,
            extractor_version: batch.extractorVersion,
            participates: observation.participates,
            state: observation.state,
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true },
        )
        .select("id"),
      "No se pudo guardar la observación",
    );
    if (data.length) {
      return { id: data[0].id, inserted: true, state: observation.state };
    }
    const existing = databaseError(
      await this.client
        .from("professional_observations")
        .select("id,state")
        .eq("dedupe_key", observation.dedupeKey)
        .single(),
      "No se pudo recuperar la observación existente",
    );
    await this.reconcilePendingObservation({
      batch,
      observation,
      observationId: existing.id,
      previousState: existing.state,
    });
    return {
      id: existing.id,
      inserted: false,
      state:
        existing.state === "pending_review"
          ? observation.state
          : existing.state,
    };
  }

  async reconcilePendingObservation({
    batch,
    observation,
    observationId,
    previousState,
  }) {
    if (
      previousState !== "pending_review" ||
      observation.state !== "published" ||
      !observation.categoryCandidateId
    ) {
      return;
    }
    databaseError(
      await this.client
        .from("professional_observations")
        .update({
          film_id: observation.filmId,
          person_id: observation.personId,
          category_candidate_id: observation.categoryCandidateId,
          participates: observation.participates,
          state: "published",
        })
        .eq("id", observationId)
        .eq("state", "pending_review"),
      "No se pudo publicar la observación reconciliada",
    );
    const matchKind =
      observation.peopleSubjects?.length > 1
        ? "team"
        : observation.peopleSubjects?.length === 1
          ? "person"
          : "film";
    databaseError(
      await this.client.from("category_candidate_match_history").upsert(
        {
          source_id: batch.sourceId,
          season_id: batch.seasonId,
          category_id: observation.categoryId,
          normalized_subject: normalizeIdentity(observation.subject),
          category_candidate_id: observation.categoryCandidateId,
          match_kind: matchKind,
          reason: "Coincidencia exacta resuelta tras ampliar el catálogo TMDB",
          actor: batch.connectorId,
        },
        {
          onConflict:
            "source_id,season_id,category_id,normalized_subject,category_candidate_id,match_kind",
          ignoreDuplicates: true,
        },
      ),
      "No se pudo auditar la reconciliación automática",
    );
    databaseError(
      await this.client
        .from("ingestion_review_items")
        .update({
          status: "resolved",
          resolution_note:
            "Resuelta automáticamente tras ampliar el catálogo TMDB",
          resolved_at: new Date().toISOString(),
          resolved_by: batch.connectorId,
        })
        .eq("observation_id", observationId)
        .eq("status", "pending"),
      "No se pudo cerrar la revisión reconciliada",
    );
  }

  async saveReviewItem({
    connectorId,
    runId,
    observationId,
    observation,
    seasonId,
  }) {
    const subjectKey = observation.review.subjectLabel
      .trim()
      .replace(/\s+/gu, " ")
      .toLocaleLowerCase();
    const reviewContext = {
      observation_dedupe_key: observation.dedupeKey,
      film_subject: observation.filmSubject ?? null,
      people_subjects: observation.peopleSubjects ?? [],
      season_id: seasonId,
      category_id: observation.categoryId ?? null,
      subject_key: subjectKey,
    };
    const data = databaseError(
      await this.client
        .from("ingestion_review_items")
        .upsert(
          {
            queue_key: observation.review.queueKey,
            run_id: runId,
            connector_id: connectorId,
            observation_id: observationId,
            kind: observation.review.kind,
            subject_label: observation.review.subjectLabel,
            candidate_film_ids: observation.review.candidateFilmIds,
            candidate_person_ids: observation.review.candidatePersonIds ?? [],
            context: reviewContext,
          },
          { onConflict: "queue_key", ignoreDuplicates: true },
        )
        .select("id"),
      "No se pudo guardar la revisión",
    );
    if (data.length) {
      databaseError(
        await this.client
          .from("ingestion_review_items")
          .update({
            status: "dismissed",
            resolution_note:
              "Sustituida por una revisión más reciente del mismo sujeto",
            resolved_at: new Date().toISOString(),
            resolved_by: connectorId,
          })
          .eq("connector_id", connectorId)
          .eq("kind", observation.review.kind)
          .eq("status", "pending")
          .neq("id", data[0].id)
          .contains("context", {
            season_id: seasonId,
            category_id: observation.categoryId ?? null,
            subject_key: subjectKey,
          }),
        "No se pudieron cerrar las revisiones sustituidas",
      );
    }
    return data.length > 0;
  }

  async resolveSemanticReviewItems({ connectorId, observation, seasonId }) {
    const subjectKey = observation.subject
      .trim()
      .replace(/\s+/gu, " ")
      .toLocaleLowerCase();
    const reviewKind =
      observation.peopleSubjects?.length > 0 ? "person_match" : "film_match";
    databaseError(
      await this.client
        .from("ingestion_review_items")
        .update({
          status: "resolved",
          resolution_note:
            "Resuelta por una revisión posterior con coincidencia exacta",
          resolved_at: new Date().toISOString(),
          resolved_by: connectorId,
        })
        .eq("connector_id", connectorId)
        .eq("kind", reviewKind)
        .eq("status", "pending")
        .contains("context", {
          season_id: seasonId,
          category_id: observation.categoryId ?? null,
          subject_key: subjectKey,
        }),
      "No se pudieron cerrar las revisiones resueltas por una revisión posterior",
    );
  }

  async finishRun(runId, result) {
    databaseError(
      await this.client
        .from("ingestion_runs")
        .update({
          status: result.status,
          finished_at: result.finishedAt,
          publications_seen: result.publicationsSeen,
          observations_seen: result.observationsSeen,
          observations_inserted: result.observationsInserted,
          observations_duplicate: result.observationsDuplicate,
          review_items_created: result.reviewItemsCreated,
          error_summary: result.errorSummary ?? null,
        })
        .eq("id", runId),
      "No se pudo cerrar la ejecución",
    );
  }

  async markConnector(connectorId, succeededAt, errorSummary = null) {
    const values = errorSummary
      ? { last_failure_at: succeededAt, last_error: errorSummary }
      : { last_success_at: succeededAt, last_error: null };
    databaseError(
      await this.client
        .from("source_connectors")
        .update(values)
        .eq("id", connectorId),
      "No se pudo actualizar el estado del conector",
    );
  }
}

export async function persistBatch({
  batch,
  repository,
  runId,
  persistenceConcurrency = 6,
}) {
  const counters = {
    publicationsSeen: batch.publications.length,
    capturesInserted: 0,
    capturesDuplicate: 0,
    observationsSeen: 0,
    observationsInserted: 0,
    observationsDuplicate: 0,
    reviewItemsCreated: 0,
  };

  try {
    const films = await repository.filmIdentities(batch.seasonId);
    const prepared = await prepareBatch(batch, films);

    for (const publication of prepared.publications) {
      const publicationId = await repository.savePublication(
        prepared,
        publication,
      );
      const capture = await repository.saveCapture(
        prepared,
        publicationId,
        publication,
      );
      const captureId =
        capture && typeof capture === "object" ? capture.id : capture;
      if (capture && typeof capture === "object") {
        if (capture.inserted) counters.capturesInserted += 1;
        else counters.capturesDuplicate += 1;
      }

      await mapWithConcurrency(
        publication.observations,
        persistenceConcurrency,
        async (observation) => {
          counters.observationsSeen += 1;
          await repository.ensureCandidate(observation.candidate);
          const saved = await repository.saveObservation({
            batch: prepared,
            publication,
            publicationId,
            captureId,
            runId,
            observation,
          });
          if (saved.inserted) counters.observationsInserted += 1;
          else counters.observationsDuplicate += 1;

          if (
            saved.inserted &&
            saved.state === "published" &&
            observation.categoryCandidateId
          ) {
            await repository.resolveSemanticReviewItems?.({
              connectorId: prepared.connectorId,
              observation,
              seasonId: prepared.seasonId,
            });
          }

          if (observation.review && saved.state === "pending_review") {
            const created = await repository.saveReviewItem({
              connectorId: prepared.connectorId,
              runId,
              observationId: saved.id,
              observation,
              seasonId: prepared.seasonId,
            });
            if (created) counters.reviewItemsCreated += 1;
          }
        },
      );
    }

    const finishedAt = new Date().toISOString();
    await repository.addEvent(
      runId,
      "info",
      counters.capturesInserted > 0 ? "source.updated" : "source.unchanged",
      counters.capturesInserted > 0
        ? "Se encontraron capturas nuevas"
        : "No se encontraron cambios en las publicaciones",
      {
        capturesInserted: counters.capturesInserted,
        capturesDuplicate: counters.capturesDuplicate,
      },
    );
    await repository.addEvent(
      runId,
      "info",
      "connector.completed",
      "Importación completada",
      counters,
    );
    await repository.finishRun(runId, {
      ...counters,
      status: "succeeded",
      finishedAt,
    });
    await repository.markConnector(batch.connectorId, finishedAt);
    return {
      connectorId: batch.connectorId,
      runId,
      status: "succeeded",
      ...counters,
    };
  } catch (error) {
    if (error && typeof error === "object") {
      error.ingestionCounters = counters;
    }
    throw error;
  }
}

export async function runConnectorSet({
  connectors,
  registry,
  repository,
  trigger,
  fetcher = fetch,
  secrets = {},
  now = () => new Date(),
  connectorConcurrency = 3,
}) {
  return mapWithConcurrency(
    connectors,
    connectorConcurrency,
    async (connector) => {
      const capturedAt = now().toISOString();
      const staleBefore = new Date(
        new Date(capturedAt).valueOf() - 15 * 60 * 1000,
      ).toISOString();
      const runKey = `${connector.id}:${trigger}:${capturedAt}`;
      let runId = null;
      try {
        await repository.failStaleRuns?.({
          connectorId: connector.id,
          staleBefore,
          recoveredAt: capturedAt,
        });
        runId = await repository.beginRun({
          connectorId: connector.id,
          trigger,
          startedAt: capturedAt,
          runKey,
        });
        const adapter = registry[connector.id];
        if (!adapter)
          throw new Error(`Conector no implementado: ${connector.id}`);
        const filmIdentities =
          connector.configuration?.catalog_only === true
            ? await repository.filmIdentities(connector.configuration.season_id)
            : [];
        const batch = await adapter({
          connector,
          capturedAt,
          fetcher,
          secrets,
          filmIdentities,
        });
        if (batch.discovery) {
          const partial =
            Array.isArray(batch.discovery.skippedUrls) &&
            batch.discovery.skippedUrls.length > 0;
          await repository.addEvent(
            runId,
            partial ? "warning" : "info",
            partial ? "discovery.partial" : "discovery.checked",
            partial
              ? "Discovery completado con publicaciones omitidas"
              : "Discovery completado sin incidencias",
            batch.discovery,
          );
        }
        const requiredCategoryIds = Array.isArray(
          connector.configuration?.required_category_ids,
        )
          ? connector.configuration.required_category_ids
          : [];
        if (requiredCategoryIds.length) {
          const observedCategoryIds = new Set(
            batch.publications.flatMap((publication) =>
              publication.observations.map(
                (observation) => observation.categoryId,
              ),
            ),
          );
          const missingCategoryIds = requiredCategoryIds.filter(
            (categoryId) => !observedCategoryIds.has(categoryId),
          );
          if (missingCategoryIds.length) {
            throw new Error(
              `Cobertura incompleta; faltan categorías requeridas: ${missingCategoryIds.join(", ")}`,
            );
          }
        }
        if (secrets.TMDB_READ_ACCESS_TOKEN) {
          const expansion = await expandCatalogFromBatch({
            batch,
            repository,
            token: secrets.TMDB_READ_ACCESS_TOKEN,
            fetcher,
          });
          if (expansion.imported.length || expansion.ambiguous.length) {
            await repository.addEvent(
              runId,
              expansion.ambiguous.length ? "warning" : "info",
              "catalog.expansion",
              "Expansión automática de catálogo completada",
              expansion,
            );
          }
        }
        return await persistBatch({
          batch,
          repository,
          runId,
          persistenceConcurrency:
            connector.configuration?.persistence_concurrency ?? 6,
        });
      } catch (error) {
        const errorSummary =
          error instanceof Error ? error.message : "Error desconocido";
        const counters = error?.ingestionCounters ?? {
          publicationsSeen: 0,
          capturesInserted: 0,
          capturesDuplicate: 0,
          observationsSeen: 0,
          observationsInserted: 0,
          observationsDuplicate: 0,
          reviewItemsCreated: 0,
        };
        const finishedAt = new Date().toISOString();
        if (runId !== null) {
          await repository.addEvent(
            runId,
            "error",
            "connector.failed",
            errorSummary,
          );
          await repository.finishRun(runId, {
            ...counters,
            status: "failed",
            finishedAt,
            errorSummary,
          });
          await repository.markConnector(
            connector.id,
            finishedAt,
            errorSummary,
          );
        }
        return {
          connectorId: connector.id,
          runId,
          status: "failed",
          error: errorSummary,
        };
      }
    },
  );
}
