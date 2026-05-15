import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import {
  buildNakafaContentRef,
  parseNakafaContentRef,
} from "@repo/contents/_lib/agent/refs";
import { NakafaAgentExerciseResultSchema } from "@repo/contents/_lib/agent/schema/exercise";
import { getRenderableExercisesContent } from "@repo/contents/_lib/exercises/renderable";
import type { Locale } from "@repo/contents/_types/content";
import { Effect, Option, Schema } from "effect";

const EXERCISE_NUMBER_SEGMENT_PATTERN = /^\d+$/;

/** Retrieves a structured exercise set or one exercise by content ID or URL. */
export const getNakafaAgentExercise = Effect.fn("NakafaAgent.getExercise")(
  function* (input: string, exerciseNumber?: number) {
    const ref = parseNakafaContentRef(input);

    if (Option.isNone(ref) || ref.value.section !== "exercises") {
      return Option.none();
    }

    const target = getNakafaExerciseTarget(ref.value.route, exerciseNumber);
    const exercises = yield* readRenderableNakafaExercises(
      ref.value.locale,
      target.setRoute
    );
    const selectedExercises =
      typeof target.number === "number"
        ? exercises.filter((exercise) => exercise.number === target.number)
        : exercises;

    if (selectedExercises.length === 0) {
      return Option.none();
    }

    const setRef = buildNakafaContentRef(
      ref.value.locale,
      target.setRoute,
      "exercises"
    );

    return Option.some(
      Schema.decodeUnknownSync(NakafaAgentExerciseResultSchema)({
        ...setRef,
        count: selectedExercises.length,
        exercise_number: target.number,
        exercises: selectedExercises.map((exercise) => ({
          answer: {
            raw: exercise.answer.raw,
            title: exercise.answer.metadata.title,
          },
          choices: exercise.choices[ref.value.locale].map((choice) => ({
            correct: choice.value,
            label: choice.label,
          })),
          number: exercise.number,
          question: {
            raw: exercise.question.raw,
            title: exercise.question.metadata.title,
          },
        })),
      })
    );
  }
);

/** Reads renderable exercises through Effect so failures stay typed. */
function readRenderableNakafaExercises(locale: Locale, route: string) {
  return Effect.tryPromise({
    try: () => getRenderableExercisesContent(locale, route),
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message: "Unable to read Nakafa exercise content.",
      }),
  });
}

/** Resolves whether the input route points to a set or a numbered exercise. */
function getNakafaExerciseTarget(route: string, exerciseNumber?: number) {
  const parts = route.split("/");
  const lastPart = parts.at(-1);
  const routeNumber =
    lastPart && EXERCISE_NUMBER_SEGMENT_PATTERN.test(lastPart)
      ? Number.parseInt(lastPart, 10)
      : null;

  if (typeof exerciseNumber === "number") {
    return {
      number: exerciseNumber,
      setRoute: routeNumber ? parts.slice(0, -1).join("/") : route,
    };
  }

  return {
    number: routeNumber,
    setRoute: routeNumber ? parts.slice(0, -1).join("/") : route,
  };
}
