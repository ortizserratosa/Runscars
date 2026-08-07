"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentUser } from "../../lib/auth/session";
import {
  parseCandidateIds,
  profileSchema,
  rankingSchema,
} from "../../lib/community/validation";
import { createSupabaseAdminClient } from "../../lib/supabase/server";

export type CommunityFormState = {
  message: string;
  tone: "error" | "success" | "idle";
};

export async function saveRankingAction(
  _previous: CommunityFormState,
  formData: FormData,
): Promise<CommunityFormState> {
  const fields = rankingSchema.safeParse({
    seasonId: formData.get("seasonId"),
    categoryId: formData.get("categoryId"),
    candidateIds: parseCandidateIds(formData.get("candidateIds")),
    isPublic: formData.get("isPublic") === "on",
  });
  if (!fields.success) {
    return {
      message:
        "El ranking debe contener entre 1 y 50 candidaturas sin repetir.",
      tone: "error",
    };
  }

  const { supabase } = await requireCurrentUser();
  const { error } = await supabase.rpc("save_my_ranking", {
    ranking_season_id: fields.data.seasonId,
    ranking_category_id: fields.data.categoryId,
    ranking_candidate_ids: fields.data.candidateIds,
    ranking_is_public: fields.data.isPublic,
  });
  if (error) {
    return {
      message: "No hemos podido guardar el ranking. Recarga y vuelve a probar.",
      tone: "error",
    };
  }

  revalidatePath("/cuenta");
  revalidatePath("/temporadas/2027");
  return { message: "Ranking guardado.", tone: "success" };
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

export async function toggleWatchedAction(
  filmId: string,
  watched: boolean,
  formData: FormData,
) {
  void formData;
  const parsedFilmId = z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .safeParse(filmId);
  if (!parsedFilmId.success) return;

  const { supabase, user } = await requireCurrentUser();
  if (watched) {
    await supabase.from("user_film_states").upsert({
      user_id: user.id,
      film_id: parsedFilmId.data,
      watched_at: new Date().toISOString(),
    });
  } else {
    await supabase
      .from("user_film_states")
      .delete()
      .eq("user_id", user.id)
      .eq("film_id", parsedFilmId.data);
  }
  revalidatePath(`/peliculas/${parsedFilmId.data}`);
  revalidatePath("/cuenta");
}

export async function updateProfileAction(
  _previous: CommunityFormState,
  formData: FormData,
): Promise<CommunityFormState> {
  const fields = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    slug: formData.get("slug"),
    isPublic: formData.get("isPublic") === "on",
    watchedIsPublic: formData.get("watchedIsPublic") === "on",
  });
  if (!fields.success) {
    return {
      message:
        "Revisa el nombre, la dirección pública y las opciones de visibilidad.",
      tone: "error",
    };
  }
  if (fields.data.watchedIsPublic && !fields.data.isPublic) {
    return {
      message: "Para publicar visionados, el perfil también debe ser público.",
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
      watched_is_public: fields.data.watchedIsPublic,
    })
    .eq("user_id", user.id);
  if (error) {
    return {
      message:
        error.code === "23505"
          ? "Esa dirección pública ya está ocupada."
          : "No hemos podido guardar el perfil.",
      tone: "error",
    };
  }

  revalidatePath("/cuenta");
  revalidatePath(`/usuarios/${fields.data.slug}`);
  return { message: "Perfil actualizado.", tone: "success" };
}

export async function deleteAccountAction(
  _previous: CommunityFormState,
  formData: FormData,
): Promise<CommunityFormState> {
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
      message: "Escribe ELIMINAR y confirma tu contraseña actual.",
      tone: "error",
    };
  }

  const { supabase, user } = await requireCurrentUser();
  if (!user.email) {
    return {
      message: "La cuenta no tiene un correo verificable.",
      tone: "error",
    };
  }
  const { error: reauthenticationError } =
    await supabase.auth.signInWithPassword({
      email: user.email,
      password: fields.data.password,
    });
  if (reauthenticationError) {
    return { message: "La contraseña no es correcta.", tone: "error" };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return {
      message: "El borrado de cuenta no está configurado en este entorno.",
      tone: "error",
    };
  }
  const { error } = await admin.auth.admin.deleteUser(user.id, false);
  if (error) {
    return {
      message: "No hemos podido eliminar la cuenta. Vuelve a intentarlo.",
      tone: "error",
    };
  }

  await supabase.auth.signOut({ scope: "local" });
  redirect("/acceso?cuenta=eliminada");
}
