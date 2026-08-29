import { permanentRedirect } from "next/navigation";
import { localizedPath } from "../../lib/i18n/config";
import { getRequestLocale } from "../../lib/i18n/server";

export default async function RetiredCriticalReceptionPage() {
  const locale = await getRequestLocale();
  permanentRedirect(localizedPath("/temporadas/2027", locale));
}
