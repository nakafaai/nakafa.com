import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import {
  getNakafaExerciseRouteNumber,
  getNakafaExerciseSetRoute,
} from "@repo/contents/_lib/agent/exercise/ref";
import {
  parseNakafaContentRef,
  parseNakafaContentRefFields,
} from "@repo/contents/_lib/agent/refs";
import { NakafaAgentExerciseResultSchema } from "@repo/contents/_lib/agent/schema/exercise";
import { getRenderableExercisesContent } from "@repo/contents/_lib/exercises/renderable";
import { Effect, Option, Schema } from "effect";

type NakafaRenderableExercises = Effect.Effect.Success<
  ReturnType<typeof getRenderableExercisesContent>
>;

type NakafaRenderableExercisesLoader = (
  ...input: Parameters<typeof getRenderableExercisesContent>
) => Effect.Effect<NakafaRenderableExercises, NakafaAgentDataReadError>;

/** Retrieves a structured exercise set or one exercise by canonical URL projection. */
export const getNakafaAgentExercise = Effect.fn("NakafaAgent.getExercise")(
  function* (
    input: string,
    exerciseNumber?: number,
    loadExercises: NakafaRenderableExercisesLoader = getRenderableExercisesContent
  ) {
    const ref = parseNakafaContentRef(input);

    if (Option.isNone(ref) || ref.value.section !== "exercises") {
      return Option.none();
    }

    const target = getNakafaExerciseTarget(ref.value.route, exerciseNumber);
    const exercises = yield* loadExercises(ref.value.locale, target.setRoute);
    const targetNumberOption = target.number;
    const selectedExercises = Option.isSome(targetNumberOption)
      ? exercises.filter(
          (exercise) => exercise.number === targetNumberOption.value
        )
      : exercises;
    if (selectedExercises.length === 0) {
      return Option.none();
    }

    const setRef = yield* parseNakafaContentRefFields(
      ref.value.locale,
      target.setRoute,
      "exercises"
    );

    const exerciseResultInput = {
      ...setRef,
      count: selectedExercises.length,
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
    };
    const result = yield* decodeNakafaAgentExerciseResult(
      Option.match(targetNumberOption, {
        onNone: () => exerciseResultInput,
        onSome: (exerciseNumber) => ({
          ...exerciseResultInput,
          exercise_number: exerciseNumber,
        }),
      })
    );

    return Option.some(result);
  }
);

/** Validates and decodes the exercise read model with a typed data-read error. */
export const decodeNakafaAgentExerciseResult = Effect.fn(
  "NakafaAgent.decodeExerciseResult"
)(function* (input: unknown) {
  return yield* Effect.try({
    try: () => Schema.decodeUnknownSync(NakafaAgentExerciseResultSchema)(input),
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message: "Unable to build Nakafa exercise read model.",
      }),
  });
});

/** Resolves whether the input route points to a set or a numbered exercise. */
function getNakafaExerciseTarget(route: string, exerciseNumber?: number) {
  const routeNumber = getNakafaExerciseRouteNumber(route);
  const setRoute = getNakafaExerciseSetRoute(route);

  if (typeof exerciseNumber === "number") {
    return {
      number: Option.some(exerciseNumber),
      setRoute,
    };
  }

  return {
    number: routeNumber,
    setRoute,
  };
}
