import { routing } from "@repo/internationalization/src/routing";
import type { Locale } from "next-intl";

const mappedPathnames = routing.pathnames;
const mappedRoutePathnames = Object.keys(mappedPathnames).filter(
  isMappedRoutePathname
);

type MappedRoutePathname = keyof typeof mappedPathnames;

/** Resolves an internal app route key to its localized public pathname. */
export function getLocalizedMappedRoutePathname({
  locale,
  route,
}: {
  locale: Locale;
  route: string;
}) {
  if (!isMappedRoutePathname(route)) {
    return null;
  }

  return mappedPathnames[route][locale];
}

/** Projects one localized static public pathname to the same route in another locale. */
export function projectLocalizedMappedRoutePathname({
  currentLocale,
  publicPath,
  targetLocale,
}: {
  currentLocale: Locale;
  publicPath: string;
  targetLocale: Locale;
}) {
  const pathname = publicPath.startsWith("/") ? publicPath : `/${publicPath}`;

  for (const route of mappedRoutePathnames) {
    if (mappedPathnames[route][currentLocale] === pathname) {
      return mappedPathnames[route][targetLocale];
    }
  }

  return null;
}

function isMappedRoutePathname(route: string): route is MappedRoutePathname {
  return Object.hasOwn(mappedPathnames, route);
}
