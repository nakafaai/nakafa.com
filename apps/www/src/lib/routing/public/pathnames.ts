import { PATHNAMES } from "@repo/internationalization/src/pathnames";
import { withLeadingSlash } from "@repo/utilities/path";
import { Array as Arr, Option, Record as Rec } from "effect";
import type { Locale } from "use-intl";

const mappedPathnames = PATHNAMES;
const mappedRoutePathnames = Arr.filter(
  Rec.keys(mappedPathnames),
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
    return Option.none<string>();
  }

  return Option.fromNullishOr(mappedPathnames[route][locale]);
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
  const pathname = withLeadingSlash(publicPath);

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
