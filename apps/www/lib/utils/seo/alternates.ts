import { routing } from "@repo/internationalization/src/routing";

interface LocalizedAlternatesOptions {
  types?: Record<string, string>;
}

/** Removes an existing locale prefix before building language alternates. */
function getPathWithoutLocale(canonical: string) {
  for (const locale of routing.locales) {
    const prefix = `/${locale}`;

    if (canonical === prefix) {
      return "";
    }

    if (canonical.startsWith(`${prefix}/`)) {
      return canonical.slice(prefix.length);
    }
  }

  return canonical;
}

/** Builds canonical, hreflang, x-default, and optional typed alternates. */
export function createLocalizedAlternates(
  path: string,
  options: LocalizedAlternatesOptions = {}
) {
  const canonical = path.startsWith("/") ? path : `/${path}`;
  const pathWithoutLocale = getPathWithoutLocale(canonical);
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, `/${locale}${pathWithoutLocale}`])
  );
  const typeAlternates = options.types ? { types: options.types } : {};

  return {
    canonical,
    languages: {
      ...languages,
      "x-default": `/${routing.defaultLocale}${pathWithoutLocale}`,
    },
    ...typeAlternates,
  };
}
