import Link from "next/link";
import { getRequestLocale, getRequestPath } from "../../lib/i18n/server";

export async function LanguageSwitcher() {
  const [locale, path] = await Promise.all([
    getRequestLocale(),
    getRequestPath(),
  ]);
  const nextLocale = locale === "es" ? "en" : "es";
  const label = locale === "es" ? "EN" : "ES";
  const description =
    locale === "es" ? "Switch to English" : "Cambiar a español";

  return (
    <Link
      aria-label={description}
      className="language-switcher"
      href={`/api/locale?locale=${nextLocale}&returnTo=${encodeURIComponent(path)}`}
      hrefLang={nextLocale}
      lang={nextLocale}
      prefetch={false}
      rel="alternate"
    >
      {label}
    </Link>
  );
}
