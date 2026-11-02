import { getRequestLocale } from "../../lib/i18n/server";
import { homeMetadata, renderHome } from "../views/HomeView";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return homeMetadata(await getRequestLocale());
}

export default async function Home() {
  return renderHome(await getRequestLocale());
}
