import { getRequestLocale, getRequestPath } from "@/lib/i18n/server";
import { rootMetadata } from "@/lib/root-metadata";
import { RootDocument } from "@/app/components/RootDocument";

export async function generateMetadata() {
  const [locale, path] = await Promise.all([
    getRequestLocale(),
    getRequestPath(),
  ]);
  return rootMetadata(locale, path);
}

export default async function DynamicRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <RootDocument locale={await getRequestLocale()}>{children}</RootDocument>
  );
}
