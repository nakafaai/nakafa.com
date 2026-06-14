import {
  buildNakafaContentRef,
  parseNakafaContentRef,
} from "@repo/contents/_lib/agent/refs";
import { getSourceRouteProjectionForRoute } from "@repo/contents/_types/graph/spec";
import { Option } from "effect";

/** Resolves any exercise URL projection to its parent set reference. */
export function getNakafaExerciseSetRef(input: string) {
  const ref = parseNakafaContentRef(input);

  if (Option.isNone(ref) || ref.value.section !== "exercises") {
    return Option.none();
  }

  return Option.some(
    buildNakafaContentRef(
      ref.value.locale,
      getNakafaExerciseSetRoute(ref.value.route),
      "exercises"
    )
  );
}

/** Resolves any exercise question route to its parent set route. */
export function getNakafaExerciseSetRoute(route: string) {
  const projection = getSourceRouteProjectionForRoute(route);

  if (projection?.kind !== "exercise-question") {
    return route;
  }

  return projection.parentRoute;
}

/** Reads the question number encoded in a question-level exercise route. */
export function getNakafaExerciseRouteNumber(route: string) {
  const projection = getSourceRouteProjectionForRoute(route);
  const questionSegment = projection?.exercise?.questionSegment;

  if (projection?.kind !== "exercise-question" || !questionSegment) {
    return Option.none();
  }

  return Option.some(Number.parseInt(questionSegment, 10));
}
