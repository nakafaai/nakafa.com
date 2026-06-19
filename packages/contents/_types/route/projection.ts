import type { Locale } from "@repo/contents/_types/content";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { listPublicAssessmentRoutes } from "@repo/contents/_types/route/assessment";
import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import { listPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum";
import type { RouteInputs } from "@repo/contents/_types/route/input";
import {
  decodePublicPath,
  normalizePublicPath,
  uniqueRoutes,
} from "@repo/contents/_types/route/path";
import { readPublicPracticeQuestionRouteByPath } from "@repo/contents/_types/route/practice/question";
import type { PublicRoute } from "@repo/contents/_types/route/schema";
import { Effect, Option } from "effect";

/** Lists every public route row generated from material, curriculum, and assessment sources. */
export const listPublicRoutes = Effect.fn("contents.route.listAll")(function* (
  inputs: RouteInputs = {}
) {
  const routes = yield* Effect.all([
    listPublicContentRoutes(inputs),
    listPublicCurriculumRoutes(inputs),
    listPublicAssessmentRoutes(inputs),
  ]);

  return yield* uniqueRoutes(routes.flat());
});

/** Finds a public route row by localized public path across all route surfaces. */
export const findPublicRouteByPath = Effect.fn("contents.route.findByPath")(
  function* (path: string, locale: Locale, inputs: RouteInputs = {}) {
    const publicPath = yield* decodePublicPath(normalizePublicPath(path));
    const routes = yield* listPublicRoutes(inputs);
    const exactRoute = routes.find(
      (route) => route.locale === locale && route.publicPath === publicPath
    );

    if (exactRoute) {
      return Option.some<PublicRoute>(exactRoute);
    }

    return Option.fromNullable(
      readPublicPracticeQuestionRouteByPath({
        domains: inputs.domains ?? MATERIAL_ROUTE_DOMAINS,
        locale,
        materials: inputs.materials ?? MATERIAL_SOURCES,
        publicPath,
      })
    );
  }
);
