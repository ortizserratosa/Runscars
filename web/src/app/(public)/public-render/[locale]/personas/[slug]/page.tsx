import { personMetadata, renderPerson } from "@/app/views/PersonPageView";
import { publicLocale } from "@/lib/rendering/public-locale";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

type PublicPersonProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: PublicPersonProps) {
  const [{ slug }, locale] = await Promise.all([params, publicLocale(params)]);
  return personMetadata(slug, locale);
}

export default async function PublicPerson({ params }: PublicPersonProps) {
  const [{ slug }, locale] = await Promise.all([params, publicLocale(params)]);
  return renderPerson(slug, locale);
}
