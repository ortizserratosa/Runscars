import { getRequestLocale } from "../../../../lib/i18n/server";
import { sourceMetadata, renderSource } from "../../../views/SourcePageView";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  return sourceMetadata(slug, locale);
}
export default async function Page({ params }: Props) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  return renderSource(slug, locale);
}
