import { locale as rootLocale } from "next/root-params";
import { NotFoundView } from "@/app/components/NotFoundView";
import { isLocale } from "@/lib/i18n/config";

export default async function PublicNotFound() {
  const locale = await rootLocale();
  return <NotFoundView locale={isLocale(locale) ? locale : "es"} />;
}
