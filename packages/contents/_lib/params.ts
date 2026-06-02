import { resetContentRouteManifestCache } from "@repo/contents/_lib/manifest/cache/lifecycle";
import {
  getContentLocaleParams,
  getContentStaticParams,
} from "@repo/contents/_lib/manifest/cache/static-params";
import type { ContentRoot } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";

interface ContentPathsConfig {
  basePath: ContentRoot;
  locales?: readonly string[];
}

interface LocaleParamsConfig {
  locales?: readonly string[];
}

export {
  getExerciseNumberPaths,
  getExerciseSetPaths,
} from "@repo/contents/_lib/manifest/exercise-paths";

/** Clears generated static-param caches after content path discovery changes. */
export function resetStaticParamCaches() {
  resetContentRouteManifestCache();
}

/**
 * Generates static params for content API pages filtered by content root.
 *
 * @example
 * ```ts
 * export function generateStaticParams() {
 *   return generateContentParams({ basePath: "subject" });
 * }
 * ```
 */
export function generateContentParams({
  basePath,
  locales = routing.locales,
}: ContentPathsConfig) {
  return getContentStaticParams({ basePath, locales });
}

/**
 * Generates static params with locale as a separate route parameter.
 *
 * @example
 * ```ts
 * export function generateStaticParams() {
 *   return generateLocaleParams();
 * }
 * ```
 */
export function generateLocaleParams({
  locales = routing.locales,
}: LocaleParamsConfig = {}) {
  return getContentLocaleParams({ locales });
}
