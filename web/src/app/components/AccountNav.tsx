import Link from "next/link";
import { getCurrentUser } from "../../lib/auth/session";

export async function AccountNav() {
  let current = null;
  try {
    current = await getCurrentUser();
  } catch {
    current = null;
  }

  return current ? (
    <Link className="ghost-button compact" href="/cuenta">
      Mi cuenta
    </Link>
  ) : (
    <Link className="ghost-button compact" href="/acceso">
      Entrar
    </Link>
  );
}
