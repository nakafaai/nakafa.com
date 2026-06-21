import type { Locale } from "@repo/contents/_types/content";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import { listPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum";
import { readStaticPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum/static";
import {
  hasCustomRouteInputs,
  type RouteInputs,
} from "@repo/contents/_types/route/input";
import {
  createPublicLearningIndex,
  type PublicLearningIndex,
} from "@repo/contents/_types/route/learning/public";
import {
  decodePublicPath,
  normalizePublicPath,
  uniqueRoutes,
} from "@repo/contents/_types/route/path";
import { Effect, Option } from "effect";

let defaultPublicLearningIndex: PublicLearningIndex | undefined;

/** Lists every public route row generated from material and curriculum sources. */
export const listPublicRoutes = Effect.fn("contents.route.listAll")(function* (
  inputs: RouteInputs = {}
) {
  const routes = yield* Effect.all([
    listPublicContentRoutes(inputs),
    listPublicCurriculumRoutes(inputs),
  ]);

  return yield* uniqueRoutes(routes.flat());
});

/** Finds a public route row by localized public path across all route surfaces. */
export const findPublicRouteByPath = Effect.fn("contents.route.findByPath")(
  function* (path: string, locale: Locale, inputs: RouteInputs = {}) {
    const publicPath = yield* decodePublicPath(normalizePublicPath(path));

    if (!hasCustomRouteInputs(inputs)) {
      return Option.fromNullable(
        readDefaultPublicLearningIndex().resolveRouteByPath(publicPath, locale)
      );
    }

    const routes = yield* listPublicRoutes(inputs);
    const index = createPublicLearningIndex({
      domains: inputs.domains ?? MATERIAL_ROUTE_DOMAINS,
      materials: inputs.materials ?? MATERIAL_SOURCES,
      routes,
    });

    return Option.fromNullable(index.resolveRouteByPath(publicPath, locale));
  }
);

/**
 * Builds the shared default route lookup index without starting an Effect runtime.
 *
 * Agent URL parsing and other default-source callers should not rebuild every
 * public route row for each lookup. Sync/tests with custom source inputs still
 * use the Effect projection branch above so source validation is preserved.
 */
function readDefaultPublicLearningIndex() {
  if (defaultPublicLearningIndex) {
    return defaultPublicLearningIndex;
  }

  defaultPublicLearningIndex = createPublicLearningIndex({
    routes: [
      ...readStaticPublicContentRoutes(),
      ...readStaticPublicCurriculumRoutes(),
    ],
  });

  return defaultPublicLearningIndex;
}
