import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import { listPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum";
import type { RouteInputs } from "@repo/contents/_types/route/input";
import { uniqueRoutes } from "@repo/contents/_types/route/path";
import { listPublicTryoutRoutes } from "@repo/contents/_types/route/tryout";
import { Effect } from "effect";

/** Lists every public route row generated from material and curriculum sources. */
export const listPublicRoutes = Effect.fn("contents.route.listAll")(function* (
  inputs: RouteInputs = {}
) {
  const routes = yield* Effect.all([
    listPublicContentRoutes(inputs),
    listPublicCurriculumRoutes(inputs),
    listPublicTryoutRoutes(inputs),
  ]);

  return yield* uniqueRoutes(routes.flat());
});
