import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const browserFixturePath = process.env.PHASE8_BROWSER_FIXTURE_PATH
  ? path.resolve(process.env.PHASE8_BROWSER_FIXTURE_PATH)
  : null;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY.",
  );
}
if (browserFixturePath && !browserFixturePath.startsWith("/tmp/")) {
  throw new Error("PHASE8_BROWSER_FIXTURE_PATH debe estar dentro de /tmp.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = `Runscars!${randomUUID()}`;
const users = [
  { email: `phase8-a-${suffix}@example.test`, displayName: "Phase 8 A" },
  { email: `phase8-b-${suffix}@example.test`, displayName: "Phase 8 B" },
];
const createdUserIds = [];

function authenticatedClient() {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  for (const fixture of users) {
    const { data, error } = await admin.auth.admin.createUser({
      email: fixture.email,
      password,
      email_confirm: true,
      user_metadata: { display_name: fixture.displayName },
    });
    if (error || !data.user) {
      throw error ?? new Error("Supabase no devolvió el usuario creado.");
    }
    createdUserIds.push(data.user.id);
  }

  const first = authenticatedClient();
  const second = authenticatedClient();
  const firstLogin = await first.auth.signInWithPassword({
    email: users[0].email,
    password,
  });
  const secondLogin = await second.auth.signInWithPassword({
    email: users[1].email,
    password,
  });
  if (firstLogin.error) throw firstLogin.error;
  if (secondLogin.error) throw secondLogin.error;

  const candidateResult = await admin
    .from("category_candidates")
    .select("id,film_id")
    .eq("season_id", "oscars-2027")
    .eq("category_id", "best-picture")
    .not("film_id", "is", null)
    .limit(1)
    .single();
  if (candidateResult.error) throw candidateResult.error;
  const candidate = candidateResult.data;

  const profileUpdate = await first
    .from("user_profiles")
    .update({ is_public: false, watched_is_public: false })
    .eq("user_id", createdUserIds[0]);
  if (profileUpdate.error) throw profileUpdate.error;
  const rankingSave = await first.rpc("save_my_ranking", {
    ranking_season_id: "oscars-2027",
    ranking_category_id: "best-picture",
    ranking_candidate_ids: [candidate.id],
    ranking_is_public: false,
  });
  if (rankingSave.error) throw rankingSave.error;
  const watchedInsert = await first.from("user_film_states").insert({
    user_id: createdUserIds[0],
    film_id: candidate.film_id,
    watched_at: new Date().toISOString(),
  });
  if (watchedInsert.error) throw watchedInsert.error;

  const privateResults = await Promise.all([
    second
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", createdUserIds[0]),
    second.from("user_rankings").select("id").eq("user_id", createdUserIds[0]),
    second
      .from("user_ranking_entries")
      .select("ranking_id")
      .eq("user_id", createdUserIds[0]),
    second
      .from("user_film_states")
      .select("film_id")
      .eq("user_id", createdUserIds[0]),
  ]);
  privateResults.forEach((result) => {
    if (result.error) throw result.error;
    assert(result.data.length === 0, "Una segunda cuenta leyó datos privados.");
  });

  const foreignUpdate = await second
    .from("user_rankings")
    .update({ is_public: true })
    .eq("id", rankingSave.data)
    .select("id");
  if (foreignUpdate.error) throw foreignUpdate.error;
  assert(
    foreignUpdate.data.length === 0,
    "Una segunda cuenta modificó un ranking ajeno.",
  );

  const publishProfile = await first
    .from("user_profiles")
    .update({ is_public: true, watched_is_public: true })
    .eq("user_id", createdUserIds[0]);
  if (publishProfile.error) throw publishProfile.error;
  const publishRanking = await first
    .from("user_rankings")
    .update({ is_public: true })
    .eq("id", rankingSave.data);
  if (publishRanking.error) throw publishRanking.error;

  const publicResults = await Promise.all([
    second
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", createdUserIds[0]),
    second.from("user_rankings").select("id").eq("id", rankingSave.data),
    second
      .from("user_ranking_entries")
      .select("ranking_id")
      .eq("ranking_id", rankingSave.data),
    second
      .from("user_film_states")
      .select("film_id")
      .eq("user_id", createdUserIds[0]),
  ]);
  publicResults.forEach((result) => {
    if (result.error) throw result.error;
    assert(
      result.data.length === 1,
      "Los datos publicados explícitamente no fueron visibles.",
    );
  });

  if (browserFixturePath) {
    await writeFile(
      browserFixturePath,
      JSON.stringify({
        userId: createdUserIds[0],
        email: users[0].email,
        password,
      }),
      { mode: 0o600 },
    );
  }

  console.log(
    JSON.stringify({
      status: "ok",
      privateRowsVisibleToSecondUser: 0,
      foreignRowsModified: 0,
      explicitlyPublicRowsVisible: 4,
      browserFixtureCreated: Boolean(browserFixturePath),
    }),
  );
} finally {
  for (const [index, userId] of createdUserIds.entries()) {
    if (browserFixturePath && index === 0) continue;
    const { error } = await admin.auth.admin.deleteUser(userId, false);
    if (error) {
      console.error(`No se pudo limpiar el usuario efímero ${userId}.`);
    }
  }
}
