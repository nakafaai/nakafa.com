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

function readPublicSurface(locale: PublicLocale, root: string) {
  return PUBLIC_ROUTE_SURFACES.find(
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
  if (segments.length === 0) {
    return true;
  }

  return (
    segments.length === 1 && (segments[0] === "focus" || segments[0] === "role")
  );
}

function isUserPath(segments: readonly string[]) {
  const [identity, child] = segments;

  if (!identity) {
    return false;
  }

  if (identity === "settings") {
    return (
      segments.length === 1 ||
      (segments.length === 2 && child === "subscriptions")
    );
  }

  return segments.length === 1 || (segments.length === 2 && child === "chat");
}

function isSchoolPath(segments: readonly string[]) {
  const [school, section, , child] = segments;

  if (!school) {
    return true;
  }

  if (school === "select") {
    return segments.length === 1;
  }

  if (school === "onboarding") {
    return (
      segments.length === 1 ||
      (segments.length === 2 && ["create", "join"].includes(section))
    );
  }

  if (segments.length === 1) {
    return true;
  }

  if (["home", "notifications"].includes(section)) {
    return segments.length === 2;
  }

  if (section !== "classes") {
    return false;
  }

  if (segments.length === 2 || segments.length === 3) {
    return true;
  }

  if (["assessments", "materials", "people"].includes(child)) {
    return segments.length === 4;
  }

  return child === "forum" && [4, 5].includes(segments.length);
}

/** Checks whether one root belongs to a concrete application route. */
export function isApplicationRouteRoot(locale: PublicLocale, root: string) {
  if (APPLICATION_ROUTE_ROOTS.has(root)) {
    return true;
  }

  return readPublicSurface(locale, root) !== undefined;
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
  if (publicSurface) {
    return isPublicSurfacePath(publicSurface, segments);
  }

  if (["auth", "contributor", "home", "search"].includes(root)) {
    return segments.length === 0;
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

  if (root === "school") {
    return isSchoolPath(segments);
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
