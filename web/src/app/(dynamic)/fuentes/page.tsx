import { getRequestLocale } from "../../../lib/i18n/server";
import { sourcesMetadata, renderSources } from "../../views/SourcesPageView";
export async function generateMetadata() {
  return sourcesMetadata(await getRequestLocale());
}
export default async function Page() {
  return renderSources(await getRequestLocale());
}
