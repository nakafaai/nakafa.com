import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import { readStaticPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum/static";
import {
  hasCustomRouteInputs,
  type RouteInputs,
} from "@repo/contents/_types/route/input";
import {
  createPublicLearningIndex,
  type PublicLearningIndex,
} from "@repo/contents/_types/route/learning/public";
import { listPublicRoutes } from "@repo/contents/_types/route/projection";
import { readStaticPublicTryoutRoutes } from "@repo/contents/_types/route/tryout/static";
import { Effect } from "effect";

let staticPublicLearningIndex: PublicLearningIndex | undefined;

/**
 * Returns the default source-backed public learning index for static app seams.
 *
 * This reader is pure from the caller's perspective and intentionally avoids
 * Effect runners so Next static param and metadata helpers do not create Effect
 * fibers while Cache Components validate prerendered routes.
 */
export function readStaticPublicLearningIndex() {
  if (staticPublicLearningIndex) {
    return staticPublicLearningIndex;
  }

  const contentRoutes = readStaticPublicContentRoutes();
  const curriculumRoutes = readStaticPublicCurriculumRoutes();
  const tryoutRoutes = readStaticPublicTryoutRoutes();

  staticPublicLearningIndex = createPublicLearningIndex({
    routes: [...contentRoutes, ...curriculumRoutes, ...tryoutRoutes],
  });

  return staticPublicLearningIndex;
}

/**
 * Loads a public learning index behind an Effect seam for request/script callers.
 *
 * Default source registries reuse the static cached adapter. Caller-supplied
 * projection inputs build a scoped index from the Effect route projection so
 * tests and sync jobs keep source validation in the Effect error channel.
 */
export const loadStaticPublicLearningIndex = Effect.fn(
  "contents.route.learning.static.load"
)(function* (inputs: RouteInputs = {}) {
  if (!hasCustomRouteInputs(inputs)) {
    return readStaticPublicLearningIndex();
  }

  const routes = yield* listPublicRoutes(inputs);

  return createPublicLearningIndex({
    routes,
  });
});
