import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/route/surface";
import type { Locale } from "@repo/internationalization/src/locale";
import type { AnyRouter } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { isProfileTab, readProfileRoot } from "@/lib/profile/route";
import { getRouter } from "@/router";

type PublicLocale = Locale;

/**
 * The route ids that answer every path of a locale with the signed Page
 * catch-all, so a match on them is no application page.
 */
const PAGE_CATCH_ALL_ROUTE_IDS: readonly string[] = ["/$locale/_marketing/$"];

/** The id prefix of every route under the locale segment. */
const LOCALE_ROUTE_ID = "/$locale";

/**
 * The application's router, built on first use. The route modules import the
 * server libraries that import this file, so the tree is read lazily.
 */
let appRouter: AnyRouter | undefined;

function readAppRouter(): AnyRouter {
  appRouter ??= getRouter();
  return appRouter;
}

/** Whether the route tree has a page for one path, which no signed catch-all answers. */
function isFixedRoute(pathname: string): boolean {
  return Option.match(Arr.last(readAppRouter().matchRoutes(pathname)), {
    onNone: () => false,
    onSome: (match) => !PAGE_CATCH_ALL_ROUTE_IDS.includes(match.routeId),
  });
}

/**
 * Whether the tree has a static top-level page for one root, such as `/school`.
 * The locale route also matches any single segment, so its pages do not count.
 */
function isTopLevelRoute(root: string): boolean {
  return Option.match(Arr.last(readAppRouter().matchRoutes(`/${root}`)), {
    onNone: () => false,
    onSome: (match) =>
      !(
        match.routeId.startsWith(LOCALE_ROUTE_ID) ||
        PAGE_CATCH_ALL_ROUTE_IDS.includes(match.routeId)
      ),
  });
}

/**
 * Whether one signed namespace owns the first segment of a public path. The
 * namespaces are signed projections, so the tree cannot tell their pages apart.
 */
function readPublicSurface(
  locale: PublicLocale,
  root: string
): Option.Option<(typeof PUBLIC_ROUTE_SURFACES)[number]> {
  return Arr.findFirst(
    PUBLIC_ROUTE_SURFACES,
    (surface) => surface.routeSlugs[locale] === root
  );
}

/**
 * Whether a signed namespace path names a page of that namespace. A curriculum
 * takes any depth, which its owner validates against the published inventory; a
 * subject needs a grade and a page; any other surface takes five segments at most.
 */
function isPublicSurfacePath(
  surface: (typeof PUBLIC_ROUTE_SURFACES)[number],
  segments: readonly string[]
): boolean {
  if (surface.key === "curriculum") {
    return true;
  }

  if (surface.key === "subject") {
    return segments.length >= 2;
  }

  return segments.length <= 5;
}

/** Checks whether one root belongs to a concrete application route. */
export function isApplicationRouteRoot(
  locale: PublicLocale,
  root: string
): boolean {
  return (
    Option.isSome(readPublicSurface(locale, root)) ||
    Option.isSome(readProfileRoot(root)) ||
    isFixedRoute(`/${locale}/${root}`) ||
    isTopLevelRoute(root)
  );
}

/**
 * Checks whether the route tree can receive one public path. The tree answers
 * every fixed route; a signed namespace and a profile address are the rules the
 * tree cannot express: the namespace's owner validates its pages, and a profile
 * address is rewritten to its route by the profile module.
 */
export function isApplicationRoutePath(
  locale: PublicLocale,
  publicPath: string
): boolean {
  const [root, ...segments] = publicPath.split("/");
  if (!root) {
    return false;
  }

  const publicSurface = readPublicSurface(locale, root);
  if (Option.isSome(publicSurface)) {
    return isPublicSurfacePath(publicSurface.value, segments);
  }

  if (Option.isSome(readProfileRoot(root))) {
    return isProfileTab(segments);
  }

  return isFixedRoute(`/${locale}/${publicPath}`);
}

/** Checks whether one signed Page path would be shadowed by the application. */
export function isReservedPagePath(
  locale: PublicLocale,
  publicPath: string
): boolean {
  const [root] = publicPath.split("/");
  if (!root) {
    return false;
  }

  return isApplicationRouteRoot(locale, root);
}
