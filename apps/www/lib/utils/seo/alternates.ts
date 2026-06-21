import type { PublicRoute } from "@repo/contents/_types/route/schema";
import { routing } from "@repo/internationalization/src/routing";
import { isSamePublicRouteIdentity } from "@/lib/routing/locale/identity";

type AlternateLanguagePath = Partial<{
  [Key in (typeof routing.locales)[number] | "x-default"]: string;
}>;
type AlternateTypePath = Readonly<{ [mediaType: string]: string }>;

interface LocalizedAlternatesOptions {
  languages?: AlternateLanguagePath;
  types?: AlternateTypePath;
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

/** Builds hreflang alternates from projected public route rows. */
export function createProjectedRouteAlternates(
  route: PublicRoute,
  routes: readonly PublicRoute[],
  options: Omit<LocalizedAlternatesOptions, "languages"> = {}
) {
  const languages: AlternateLanguagePath = {};

  for (const locale of routing.locales) {
    const alternate = routes.find(
      (candidate) =>
        candidate.locale === locale &&
        isSamePublicRouteIdentity(route, candidate)
    );

    if (alternate) {
      languages[locale] = `/${locale}/${alternate.publicPath}`;
    }
  }

  return createLocalizedAlternates(`/${route.locale}/${route.publicPath}`, {
    ...options,
    languages,
  });
}
