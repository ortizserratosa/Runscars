import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const localEnvironmentPath = path.join(repositoryRoot, "web/.env.local");
if (existsSync(localEnvironmentPath)) process.loadEnvFile(localEnvironmentPath);

function required(value, message) {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

function client() {
  return createClient(
    required(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "Falta NEXT_PUBLIC_SUPABASE_URL",
    ),
    required(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Falta SUPABASE_SERVICE_ROLE_KEY",
    ),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function resolveUser(admin, identity) {
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(identity)) return identity;
  let page = 1;
  while (page <= 100) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error)
      throw new Error(`No se pudieron listar usuarios: ${error.message}`);
    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === identity.toLowerCase(),
    );
    if (user) return user.id;
    if (data.users.length < 100) break;
    page += 1;
  }
  throw new Error(`No existe una cuenta con identidad ${identity}`);
}

async function grant(identity) {
  const admin = client();
  const userId = await resolveUser(admin, identity);
  const { error } = await admin.from("editorial_admins").upsert({
    user_id: userId,
    note: "Acceso concedido mediante admin:grant",
  });
  if (error) throw new Error(error.message);
  console.log(`Administrador editorial concedido: ${userId}`);
}

async function revoke(identity) {
  const admin = client();
  const userId = await resolveUser(admin, identity);
  const { error } = await admin
    .from("editorial_admins")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  console.log(`Administrador editorial revocado: ${userId}`);
}

async function list() {
  const admin = client();
  const { data, error } = await admin
    .from("editorial_admins")
    .select("user_id,created_at,note")
    .order("created_at");
  if (error) throw new Error(error.message);
  for (const membership of data) {
    const { data: user } = await admin.auth.admin.getUserById(
      membership.user_id,
    );
    console.log(
      `${membership.user_id}\t${user.user?.email ?? "sin correo"}\t${membership.created_at}`,
    );
  }
}

function help() {
  console.log(`Uso:
  npm run admin:grant -- <correo-o-uuid>
  npm run admin:revoke -- <correo-o-uuid>
  npm run admin:list`);
}

const [command, identity] = process.argv.slice(2);
try {
  if (command === "grant")
    await grant(required(identity, "Indica correo o UUID"));
  else if (command === "revoke")
    await revoke(required(identity, "Indica correo o UUID"));
  else if (command === "list") await list();
  else help();
} catch (error) {
  console.error(
    `Administradores: ${error instanceof Error ? error.message : "error desconocido"}`,
  );
  process.exitCode = 1;
}
