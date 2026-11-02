import { NotFoundView } from "@/app/components/NotFoundView";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function NotFound() {
  return <NotFoundView locale={await getRequestLocale()} />;
}
