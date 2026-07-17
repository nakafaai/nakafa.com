import type { Locale } from "@repo/contents/_types/content";
import { normalizePublicPath } from "@repo/contents/_types/route/path";
import type { PublicRoute } from "@repo/contents/_types/route/schema";

/** Builds a locale/path key for exact public route lookup maps. */
export function readLocalePathKey(locale: Locale, path: string) {
  return [locale, normalizePublicPath(path)].join(":");
}

/** Builds a locale-qualified source identity key for route projection maps. */
export function readRouteLocaleIdentityKey(route: PublicRoute, locale: Locale) {
  return readIdentityLocaleKey(readRouteIdentityKey(route), locale);
}

/** Builds the source identity that survives localized public slug changes. */
function readRouteIdentityKey(route: PublicRoute) {
  if (route.kind === "article-category") {
    return ["article-category", route.category].join(":");
  }

  if (route.kind === "curriculum-context") {
    return ["curriculum", route.programKey, route.nodeKey].join(":");
  }

  if (route.kind === "tryout-country") {
    return ["tryout-country", route.countryKey].join(":");
  }

  if (route.kind === "tryout-exam") {
    return ["tryout-exam", route.countryKey, route.examKey].join(":");
  }

  if (route.kind === "tryout-track") {
    return [
      "tryout-track",
      route.countryKey,
      route.examKey,
      route.trackKey,
    ].join(":");
  }

  if (route.kind === "tryout-set") {
    return [
      "tryout-set",
      route.countryKey,
      route.examKey,
      route.trackKey,
      route.setKey,
    ].join(":");
  }

  if (route.kind === "tryout-section") {
    return [
      "tryout-section",
      route.countryKey,
      route.examKey,
      route.trackKey,
      route.setKey,
      route.sectionKey,
    ].join(":");
  }

  return [route.kind, route.sourcePath].join(":");
}

/** Builds one locale-qualified lookup key from a route-owned source identity. */
export function readIdentityLocaleKey(identity: string, locale: Locale) {
  return [identity, locale].join(":");
}
