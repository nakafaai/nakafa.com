import {
  buildNakafaContentRef,
  parseNakafaContentRef,
} from "@repo/contents/_lib/agent/refs";
import { Option } from "effect";

/** Resolves any exercise question reference to its parent set reference. */
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
  const parts = route.split("/");

  if (Option.isNone(getNakafaExerciseRouteNumber(route))) {
    return route;
  }

  return parts.slice(0, -1).join("/");
}

/** Reads the question number encoded in a question-level exercise route. */
export function getNakafaExerciseRouteNumber(route: string) {
  const lastPart = route.split("/").at(-1);

  if (!lastPart) {
    return Option.none();
  }

  const number = Number.parseInt(lastPart, 10);

  if (!(Number.isSafeInteger(number) && `${number}` === lastPart)) {
    return Option.none();
  }

  return Option.some(number);
}
