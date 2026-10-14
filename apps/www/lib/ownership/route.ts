import { APPLICATION_ROUTE_ROOTS } from "@repo/contents/route/root";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/route/surface";
import type { routing } from "@repo/internationalization/src/routing";
import { Array as Arr, HashSet, Option } from "effect";
import { isProfileTab, readProfileRoot } from "@/lib/profile/route";
import { userSettingsSections } from "@/lib/settings/routes";

type PublicLocale = (typeof routing.locales)[number];

function readPublicSurface(locale: PublicLocale, root: string) {
  return Arr.findFirst(
    PUBLIC_ROUTE_SURFACES,
    (surface) => surface.routeSlugs[locale] === root
  );
}

function isPublicSurfacePath(
  surface: (typeof PUBLIC_ROUTE_SURFACES)[number],
  segments: readonly string[]
) {
  if (surface.key === "curriculum") {
    return true;
  }

  if (surface.key === "subject") {
    return segments.length >= 2;
  }

  return segments.length <= 5;
}

function isOnboardingPath(segments: readonly string[]) {
  return segments.length === 0;
}

function isUserPath(segments: readonly string[]) {
  // The settings table owns which pages exist below `user`. A profile has no
  // address here: it lives at `@username`, which the profile root serves.
  return (
    segments[0] === "settings" &&
    Arr.some(
      userSettingsSections,
      ({ href }) => href === `/user/${Arr.join(segments, "/")}`
    )
  );
}

/** Checks whether one root belongs to a concrete application route. */
export function isApplicationRouteRoot(locale: PublicLocale, root: string) {
  if (
    HashSet.has(APPLICATION_ROUTE_ROOTS, root) ||
    Option.isSome(readProfileRoot(root))
  ) {
    return true;
  }

  return Option.isSome(readPublicSurface(locale, root));
}

/**
 * Checks whether the Next.js route tree can receive one public path.
 *
 * Signed projection namespaces accept descendant shapes here because their
 * owning route validates the exact published inventory. Fixed application
 * routes are matched exactly so impossible descendants can return a hard 404
 * before Next.js starts streaming.
 */
export function isApplicationRoutePath(
  locale: PublicLocale,
  publicPath: string
) {
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

  if (Arr.contains(["contributor", "home", "pricing", "search"], root)) {
    return segments.length === 0;
  }

  if (root === "auth") {
    return Arr.contains(["", "error"], Arr.join(segments, "/"));
  }

  if (root === "chat") {
    return segments.length <= 1;
  }

  if (root === "og") {
    return segments.length >= 1;
  }

  if (root === "onboarding") {
    return isOnboardingPath(segments);
  }

  if (root === "user") {
    return isUserPath(segments);
  }

  return false;
}

/** Checks whether one signed Page path would be shadowed by the application. */
export function isReservedPagePath(locale: PublicLocale, publicPath: string) {
  const [root] = publicPath.split("/");
  if (!root) {
    return false;
  }

  return isApplicationRouteRoot(locale, root);
}
