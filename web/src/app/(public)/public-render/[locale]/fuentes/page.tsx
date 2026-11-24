import { publicLocale } from "../../../../../lib/rendering/public-locale";
import {
  sourcesMetadata,
  renderSources,
} from "../../../../views/SourcesPageView";
export const revalidate = 60;
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  return sourcesMetadata(await publicLocale(params));
}
export default async function Page({ params }: Props) {
  return renderSources(await publicLocale(params));
}
