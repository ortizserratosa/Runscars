import { RootDocument } from "@/app/components/RootDocument";
import { rootMetadata } from "@/lib/root-metadata";
import { publicLocale } from "@/lib/rendering/public-locale";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return rootMetadata(await publicLocale(params));
}

export default async function PublicRootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  return (
    <RootDocument locale={await publicLocale(params)} anonymous>
      {children}
    </RootDocument>
  );
}
