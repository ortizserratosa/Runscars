import { getRequestLocale } from "../../../../lib/i18n/server";
import { listCatalogPersonIds } from "../../../../lib/repositories/catalog";
import { personMetadata, renderPerson } from "../../../views/PersonPageView";

type PersonPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return (await listCatalogPersonIds()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PersonPageProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  return personMetadata(slug, locale);
}

export default async function PersonPage({ params }: PersonPageProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  return renderPerson(slug, locale);
}
