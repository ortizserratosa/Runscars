"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentUser } from "../../lib/auth/session";
import {
  parseRankingEntries,
  parseFilmStateUpdates,
  filmWatchStateSchema,
  profileSchema,
  rankingSchema,
} from "../../lib/community/validation";
import { createSupabaseAdminClient } from "../../lib/supabase/server";
import { isLocale, localizedPath, type Locale } from "../../lib/i18n/config";
import {
  ManualTmdbVerificationError,
  manualTmdbErrorMessage,
  verifyManualRankingEntry,
} from "../../lib/tmdb/manual-verification";

export type CommunityFormState = {
  message: string;
  tone: "error" | "success" | "idle";
};

function formLocale(formData: FormData): Locale {
  const value = formData.get("locale");
  return typeof value === "string" && isLocale(value) ? value : "es";
}

export async function saveRankingAction(
  _previous: CommunityFormState,
  formData: FormData,
): Promise<CommunityFormState> {
  const locale = formLocale(formData);
  const en = locale === "en";
  const fields = rankingSchema.safeParse({
    seasonId: formData.get("seasonId"),
    categoryId: formData.get("categoryId"),
    entries: parseRankingEntries(formData.get("rankingEntries")),
    isPublic: formData.get("isPublic") === "on",
  });
  if (!fields.success) {
    return {
      message: en
        ? "Check the category limit, duplicate candidates, and the single manual entry."
        : "Revisa el límite de la categoría, las candidaturas repetidas y la única entrada manual.",
      tone: "error",
    };
  }

  const { supabase, user } = await requireCurrentUser();
  const manualEntries = fields.data.entries.filter(
    (entry) => entry.kind === "custom",
  );
  const manualVerifications = new Map<
    number,
    Awaited<ReturnType<typeof verifyManualRankingEntry>>
  >();
  if (manualEntries.length) {
    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("eligibility_year")
      .eq("id", fields.data.seasonId)
      .maybeSingle();
    if (seasonError || !season) {
      return {
        message: en
          ? "We could not verify the season eligibility rules."
          : "No hemos podido comprobar las reglas de elegibilidad de la temporada.",
        tone: "error",
      };
    }
    try {
      const verifications = await Promise.all(
        manualEntries.map((entry) =>
          verifyManualRankingEntry({
            categoryId: fields.data.categoryId,
            tmdbUrl: entry.tmdbUrl,
            qualifyingMovieTmdbUrl: entry.qualifyingMovieTmdbUrl,
            eligibilityYear: season.eligibility_year,
          }),
        ),
      );
      manualEntries.forEach((_, index) => {
        manualVerifications.set(index, verifications[index]);
      });
    } catch (error) {
      const code =
        error instanceof ManualTmdbVerificationError
          ? error.code
          : "tmdb_unavailable";
      return {
        message: manualTmdbErrorMessage(code, locale),
        tone: "error",
      };
    }
  }

  let manualIndex = 0;
  const verifiedEntries = fields.data.entries.map((entry) => {
    if (entry.kind !== "custom") return null;
    const verification = manualVerifications.get(manualIndex);
    manualIndex += 1;
    return verification ?? null;
  });
  const { error } = await supabase.rpc("save_my_ranking", {
    ranking_season_id: fields.data.seasonId,
    ranking_category_id: fields.data.categoryId,
    ranking_candidate_ids: fields.data.entries.map((entry) =>
      entry.kind === "candidate" ? entry.candidateId : "",
    ),
    ranking_custom_labels: fields.data.entries.map((entry, index) =>
      entry.kind === "custom"
        ? (verifiedEntries[index]?.label ?? entry.label)
        : "",
    ),
    ranking_custom_metadata: verifiedEntries.map(
      (verification) => verification ?? {},
    ),
    ranking_is_public: fields.data.isPublic,
  });
  if (error) {
    return {
      message: en
        ? "We could not save the ranking. Reload the page and try again."
        : "No hemos podido guardar el ranking. Recarga y vuelve a probar.",
      tone: "error",
    };
  }

  const filmStates = parseFilmStateUpdates(formData.get("filmStates"));
  const unmarkedFilmIds = filmStates
    .filter((state) => state.state === "unmarked")
    .map((state) => state.filmId);
  if (unmarkedFilmIds.length) {
    const { error: deleteStatesError } = await supabase
      .from("user_film_states")
      .delete()
      .eq("user_id", user.id)
      .in("film_id", unmarkedFilmIds);
    if (deleteStatesError) {
      return {
        message: en
          ? "We could not save the watch states."
          : "No hemos podido guardar los estados de visionado.",
        tone: "error",
      };
    }
  }
  const markedFilmStates = filmStates.filter(
    (
      state,
    ): state is (typeof filmStates)[number] & {
      state: "watched" | "not_watched";
    } => state.state !== "unmarked",
  );
  if (markedFilmStates.length) {
    const now = new Date().toISOString();
    const { error: upsertStatesError } = await supabase
      .from("user_film_states")
      .upsert(
        markedFilmStates.map((state) => ({
          user_id: user.id,
          film_id: state.filmId,
          status: state.state,
          watched_at: state.state === "watched" ? now : null,
        })),
      );
    if (upsertStatesError) {
      return {
        message: en
          ? "We could not save the watch states."
          : "No hemos podido guardar los estados de visionado.",
        tone: "error",
      };
    }
  }

  revalidatePath("/cuenta");
  revalidatePath("/temporadas/2027");
  revalidatePath("/comunidad");
  return {
    message: en ? "Ranking saved." : "Ranking guardado.",
    tone: "success",
  };
}

export async function deleteRankingAction(formData: FormData) {
  const fields = z
    .object({
      seasonId: z.string().min(1),
      categoryId: z.string().min(1),
    })
    .safeParse({
      seasonId: formData.get("seasonId"),
      categoryId: formData.get("categoryId"),
    });
  if (!fields.success) return;

  const { supabase, user } = await requireCurrentUser();
  await supabase
    .from("user_rankings")
    .delete()
    .eq("user_id", user.id)
    .eq("season_id", fields.data.seasonId)
    .eq("category_id", fields.data.categoryId);
  revalidatePath("/cuenta");
  revalidatePath("/temporadas/2027");
}

export async function setFilmStateAction(
  filmId: string,
  state: string,
  formData: FormData,
) {
  void formData;
  const parsedFilmId = z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .safeParse(filmId);
  if (!parsedFilmId.success) return;
  const parsedState = filmWatchStateSchema.safeParse(state);
  if (!parsedState.success) return;

  const { supabase, user } = await requireCurrentUser();
  if (parsedState.data === "unmarked") {
    await supabase
      .from("user_film_states")
      .delete()
      .eq("user_id", user.id)
      .eq("film_id", parsedFilmId.data);
  } else {
    await supabase.from("user_film_states").upsert({
      user_id: user.id,
      film_id: parsedFilmId.data,
      status: parsedState.data,
      watched_at:
        parsedState.data === "watched" ? new Date().toISOString() : null,
    });
  }
  revalidatePath(`/peliculas/${parsedFilmId.data}`);
  revalidatePath("/cuenta");
  revalidatePath("/comunidad");
}

export async function updateProfileAction(
  _previous: CommunityFormState,
  formData: FormData,
): Promise<CommunityFormState> {
  const locale = formLocale(formData);
  const en = locale === "en";
  const fields = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    slug: formData.get("slug"),
    isPublic: formData.get("isPublic") === "on",
  });
  if (!fields.success) {
    return {
      message: en
        ? "Check the display name and public profile address."
        : "Revisa el nombre y la dirección pública del perfil.",
      tone: "error",
    };
  }

  const { supabase, user } = await requireCurrentUser();
  const { error } = await supabase
    .from("user_profiles")
    .update({
      display_name: fields.data.displayName,
      slug: fields.data.slug,
      is_public: fields.data.isPublic,
    })
    .eq("user_id", user.id);
  if (error) {
    return {
      message:
        error.code === "23505"
          ? en
            ? "That public address is already taken."
            : "Esa dirección pública ya está ocupada."
          : en
            ? "We could not save the profile."
            : "No hemos podido guardar el perfil.",
      tone: "error",
    };
  }

  revalidatePath("/cuenta");
  revalidatePath(`/usuarios/${fields.data.slug}`);
  return {
    message: en ? "Profile updated." : "Perfil actualizado.",
    tone: "success",
  };
}

export async function deleteAccountAction(
  _previous: CommunityFormState,
  formData: FormData,
): Promise<CommunityFormState> {
  const locale = formLocale(formData);
  const en = locale === "en";
  const fields = z
    .object({
      password: z.string().min(8).max(128),
      confirmation: z.literal("ELIMINAR"),
    })
    .safeParse({
      password: formData.get("password"),
      confirmation: formData.get("confirmation"),
    });
  if (!fields.success) {
    return {
      message: en
        ? "Type ELIMINAR and confirm your current password."
        : "Escribe ELIMINAR y confirma tu contraseña actual.",
      tone: "error",
    };
  }

  const { supabase, user } = await requireCurrentUser();
  if (!user.email) {
    return {
      message: en
        ? "This account does not have a verifiable email address."
        : "La cuenta no tiene un correo verificable.",
      tone: "error",
    };
  }
  const { error: reauthenticationError } =
    await supabase.auth.signInWithPassword({
      email: user.email,
      password: fields.data.password,
    });
  if (reauthenticationError) {
    return {
      message: en
        ? "The password is incorrect."
        : "La contraseña no es correcta.",
      tone: "error",
    };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return {
      message: en
        ? "Account deletion is not configured in this environment."
        : "El borrado de cuenta no está configurado en este entorno.",
      tone: "error",
    };
  }
  const { error } = await admin.auth.admin.deleteUser(user.id, false);
  if (error) {
    return {
      message: en
        ? "We could not delete the account. Try again."
        : "No hemos podido eliminar la cuenta. Vuelve a intentarlo.",
      tone: "error",
    };
  }

  await supabase.auth.signOut({ scope: "local" });
  redirect(localizedPath("/acceso?cuenta=eliminada", locale));
}
