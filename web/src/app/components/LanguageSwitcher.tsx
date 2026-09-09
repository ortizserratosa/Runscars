import { getRequestLocale, getRequestPath } from "../../lib/i18n/server";
import { localizedPath } from "../../lib/i18n/config";

export async function LanguageSwitcher() {
  const [locale, path] = await Promise.all([
    getRequestLocale(),
    getRequestPath({ includeSearch: true }),
  ]);
  const nextLocale = locale === "es" ? "en" : "es";
  const label = locale === "es" ? "EN" : "ES";
  const description =
    locale === "es" ? "Switch to English" : "Cambiar a español";

  return (
    <a
      aria-label={description}
      className="language-switcher"
      href={localizedPath(path, nextLocale)}
      hrefLang={nextLocale}
      lang={nextLocale}
      rel="alternate"
    >
      {label}
    </a>
  );
}
