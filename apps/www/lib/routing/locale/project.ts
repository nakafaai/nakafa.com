import { isMaterialLessonRoute } from "@repo/contents/_types/route/content";
import type { PublicLearningIndex } from "@repo/contents/_types/route/learning/public";
import type {
  PublicContentRoute,
  PublicRoute,
} from "@repo/contents/_types/route/schema";
import type { routing } from "@repo/internationalization/src/routing";
import { Data } from "effect";
import {
  readMaterialContextQuery,
  toMaterialContextQueryString,
} from "@/lib/routing/material/query";

/** Locale values accepted by next-intl routing and public route projection. */
type Locale = (typeof routing.locales)[number];

/** Raised when a localized route exists but has no target-locale projection. */
export class MissingLocalizedRouteProjectionError extends Data.TaggedError(
  "MissingLocalizedRouteProjectionError"
)<{
  locale: Locale;
  publicPath: string;
}> {}

/** Narrows projected route rows to canonical source-backed content rows. */
function isContentRoute(route: PublicRoute): route is PublicContentRoute {
  return route.kind !== "curriculum-context";
}

/**
 * Preserves only validated material context state across localized projections.
 *
 * Other projected routes intentionally drop query/hash state because localized
 * source-owned slugs and heading anchors are not guaranteed to be equivalent.
 */
export function readProjectedRouteSuffix({
  index,
  route,
  search,
  targetRoute,
}: {
  index: PublicLearningIndex;
  route: PublicRoute;
  search: string;
  targetRoute: PublicRoute;
}) {
  if (
    !(
      isContentRoute(route) &&
      isContentRoute(targetRoute) &&
      isMaterialLessonRoute(route) &&
      isMaterialLessonRoute(targetRoute)
    )
  ) {
    return "";
  }

  const context = readMaterialContextQuery(search);
  const projectedContext = index.projectMaterialContextToLocale({
    context,
    currentRoute: route,
    targetRoute,
  });

  if (!projectedContext) {
    return "";
  }

  return toMaterialContextQueryString(projectedContext);
}
