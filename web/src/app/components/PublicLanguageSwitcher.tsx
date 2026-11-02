"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { localizedPath, type Locale } from "../../lib/i18n/config";
import { canonicalPublicRenderPath } from "../../lib/rendering/public-route";

function LanguageLink({ locale, path }: { locale: Locale; path: string }) {
  const nextLocale = locale === "es" ? "en" : "es";

  return (
    <a
      aria-label={locale === "es" ? "Switch to English" : "Cambiar a español"}
      className="language-switcher"
      href={localizedPath(path, nextLocale)}
      hrefLang={nextLocale}
      lang={nextLocale}
      rel="alternate"
    >
      {locale === "es" ? "EN" : "ES"}
    </a>
  );
}

function SearchAwareLanguageLink({
  locale,
  path,
}: {
  locale: Locale;
  path: string;
}) {
  const search = useSearchParams().toString();
  return (
    <LanguageLink
      locale={locale}
      path={`${path}${search ? `?${search}` : ""}`}
    />
  );
}

export function PublicLanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const path = canonicalPublicRenderPath(pathname) ?? pathname;
  return (
    <Suspense fallback={<LanguageLink locale={locale} path={path} />}>
      <SearchAwareLanguageLink locale={locale} path={path} />
    </Suspense>
  );
}
