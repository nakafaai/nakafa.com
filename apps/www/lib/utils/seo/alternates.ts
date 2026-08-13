import { routing } from "@repo/internationalization/src/routing";

type AlternateLanguagePath = Partial<{
  [Key in (typeof routing.locales)[number] | "x-default"]: string;
}>;
type AlternateTypePath = Readonly<{ [mediaType: string]: string }>;

interface LocalizedAlternatesOptions {
  languages?: AlternateLanguagePath;
  types?: AlternateTypePath;
}

interface ResolvedAlternateRoute {
  readonly locale: (typeof routing.locales)[number];
  readonly publicPath: string;
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
  const languages =
    options.languages ??
    Object.fromEntries(
      routing.locales.map((locale) => [
        locale,
        `/${locale}${pathWithoutLocale}`,
      ])
    );
  const typeAlternates = options.types ? { types: options.types } : {};
  const xDefault =
    languages["x-default"] ??
    languages[routing.defaultLocale] ??
    `/${routing.defaultLocale}${pathWithoutLocale}`;

  return {
    canonical,
    languages: {
      ...languages,
      "x-default": xDefault,
    },
    ...typeAlternates,
  };
}

/** Builds hreflang alternates from already-resolved localized counterparts. */
export function createResolvedRouteAlternates(
  route: ResolvedAlternateRoute,
  alternates: readonly ResolvedAlternateRoute[],
  options: Omit<LocalizedAlternatesOptions, "languages"> = {}
) {
  const languages: AlternateLanguagePath = {};

  for (const alternate of alternates) {
    languages[alternate.locale] =
      `/${alternate.locale}/${alternate.publicPath}`;
  }
  languages["x-default"] =
    languages[routing.defaultLocale] ?? `/${route.locale}/${route.publicPath}`;

  return createLocalizedAlternates(`/${route.locale}/${route.publicPath}`, {
    ...options,
    languages,
  });
}
