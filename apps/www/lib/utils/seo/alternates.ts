import type { PublicRoute } from "@repo/contents/_types/route/schema";
import { routing } from "@repo/internationalization/src/routing";

interface LocalizedAlternatesOptions {
  languages?: Record<string, string>;
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
  const languages: Record<string, string> = {};

  for (const locale of routing.locales) {
    const alternate = routes.find(
      (candidate) =>
        candidate.locale === locale && isSameProjectedRoute(route, candidate)
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

/** Matches localized projected rows by stable source identity, not public slug text. */
function isSameProjectedRoute(left: PublicRoute, right: PublicRoute) {
  if (left.kind !== right.kind) {
    return false;
  }

  if (
    left.kind === "curriculum-context" &&
    right.kind === "curriculum-context"
  ) {
    return (
      left.programKey === right.programKey && left.nodeKey === right.nodeKey
    );
  }

  if (
    left.kind === "assessment-context" &&
    right.kind === "assessment-context"
  ) {
    if (left.materialKey && right.materialKey && left.level === right.level) {
      return (
        left.programKey === right.programKey &&
        left.materialKey === right.materialKey
      );
    }

    return (
      left.programKey === right.programKey && left.nodeKey === right.nodeKey
    );
  }

  return (
    "sourcePath" in left &&
    "sourcePath" in right &&
    left.sourcePath === right.sourcePath
  );
}
