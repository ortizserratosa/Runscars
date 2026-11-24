import { publicLocale } from "../../../../../../lib/rendering/public-locale";
import {
  sourceMetadata,
  renderSource,
} from "../../../../../views/SourcePageView";
export const revalidate = 60;
export function generateStaticParams() {
  return [];
}
type Props = { params: Promise<{ locale: string; slug: string }> };
export async function generateMetadata({ params }: Props) {
  const [{ slug }, locale] = await Promise.all([params, publicLocale(params)]);
  return sourceMetadata(slug, locale);
}
export default async function Page({ params }: Props) {
  const [{ slug }, locale] = await Promise.all([params, publicLocale(params)]);
  return renderSource(slug, locale);
}
