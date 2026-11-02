import { homeMetadata, renderHome } from "@/app/views/HomeView";
import { publicLocale } from "@/lib/rendering/public-locale";

export const revalidate = 60;

type PublicHomeProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PublicHomeProps) {
  return homeMetadata(await publicLocale(params));
}

export default async function PublicHome({ params }: PublicHomeProps) {
  return renderHome(await publicLocale(params));
}
