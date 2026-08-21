import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import type { routing } from "@repo/internationalization/src/routing";

const APPLICATION_ROUTE_ROOTS = new Set([
  "articles",
  "auth",
  "chat",
  "contributor",
  "home",
  "og",
  "onboarding",
  "quran",
  "school",
  "search",
  "user",
]);

type PublicLocale = (typeof routing.locales)[number];

/** Checks whether one root belongs to a concrete application route. */
export function isApplicationRouteRoot(locale: PublicLocale, root: string) {
  if (APPLICATION_ROUTE_ROOTS.has(root)) {
    return true;
  }

  return PUBLIC_ROUTE_SURFACES.some(
    (surface) => surface.routeSlugs[locale] === root
  );
}

/** Checks whether one signed Page path would be shadowed by the application. */
export function isReservedPagePath(locale: PublicLocale, publicPath: string) {
  const [root] = publicPath.split("/");
  return root !== undefined && isApplicationRouteRoot(locale, root);
}
