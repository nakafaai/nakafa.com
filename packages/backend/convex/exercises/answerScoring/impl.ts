import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  type CanonicalExerciseAnswer,
  ExerciseAnswerIoError,
  type ExerciseAnswerScoringError,
  ExerciseQuestionNotFoundError,
  exerciseAnswerIoFailedCode,
  InvalidExerciseAnswerError,
  InvalidExerciseQuestionError,
  invalidExerciseAnswerCode,
  invalidExerciseQuestionCode,
  questionNotFoundCode,
  type ScoreExerciseAnswerInput,
} from "@repo/backend/convex/exercises/answerScoring/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { getManyFrom } from "convex-helpers/server/relationships";
import { Effect } from "effect";

type ExerciseDbReader = QueryCtx["db"];

/** Maps thrown Convex IO failures into the answer-scoring error channel. */
function toExerciseAnswerIoError(error: unknown) {
  return new ExerciseAnswerIoError({
    code: exerciseAnswerIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Loads and validates that the question belongs to the current attempt. */
const getQuestionForAttempt = Effect.fn(
  "exercises.answerScoring.getQuestionForAttempt"
)(function* (
  db: ExerciseDbReader,
  { attempt, exerciseNumber, questionId }: ScoreExerciseAnswerInput
) {
  const question = yield* Effect.tryPromise({
    try: () => db.get("exerciseQuestions", questionId),
    catch: toExerciseAnswerIoError,
  });

  if (!question) {
    return yield* Effect.fail(
      new ExerciseQuestionNotFoundError({
        code: questionNotFoundCode,
        message: "Question not found.",
      })
    );
  }

  const set = yield* Effect.tryPromise({
    try: () => db.get("exerciseSets", question.setId),
    catch: toExerciseAnswerIoError,
  });

  if (!set || set.slug !== attempt.slug) {
    return yield* Effect.fail(
      new InvalidExerciseQuestionError({
        code: invalidExerciseQuestionCode,
        message: "Question does not belong to this attempt.",
      })
    );
  }

  if (question.number !== exerciseNumber) {
    return yield* Effect.fail(
      new InvalidExerciseAnswerError({
        code: invalidExerciseAnswerCode,
        message: "exerciseNumber does not match the provided question.",
      })
    );
  }

  if (attempt.scope === "single" && attempt.exerciseNumber !== exerciseNumber) {
    return yield* Effect.fail(
      new InvalidExerciseAnswerError({
        code: invalidExerciseAnswerCode,
        message: "exerciseNumber does not match this single-scope attempt.",
      })
    );
  }

  return question;
});

/** Resolves the selected choice through the canonical option key. */
const getSelectedChoice = Effect.fn(
  "exercises.answerScoring.getSelectedChoice"
)(function* (
  db: ExerciseDbReader,
  {
    questionId,
    selectedOptionId,
  }: Pick<ScoreExerciseAnswerInput, "questionId" | "selectedOptionId">
) {
  const choices = yield* Effect.tryPromise({
    try: () =>
      getManyFrom(
        db,
        "exerciseChoices",
        "by_questionId_and_locale",
        questionId,
        "questionId"
      ),
    catch: toExerciseAnswerIoError,
  });

  const selectedChoice = choices.find(
    (choice) => choice.optionKey === selectedOptionId
  );

  if (!selectedChoice) {
    return yield* Effect.fail(
      new InvalidExerciseAnswerError({
        code: invalidExerciseAnswerCode,
        message: "selectedOptionId does not belong to the provided question.",
      })
    );
  }

  return selectedChoice;
});

/**
 * Canonicalizes and scores one submitted answer from stored choices.
 *
 * The backend derives correctness from the stored exercise choice instead of
 * trusting client-provided correctness flags.
 * @see https://effect.website/docs/error-management/expected-errors/
 */
export const scoreExerciseAnswer: (
  db: ExerciseDbReader,
  input: ScoreExerciseAnswerInput
) => Effect.Effect<CanonicalExerciseAnswer, ExerciseAnswerScoringError> =
  Effect.fn("exercises.answerScoring.scoreExerciseAnswer")(function* (
    db: ExerciseDbReader,
    input: ScoreExerciseAnswerInput
  ) {
    yield* getQuestionForAttempt(db, input);

    const selectedChoice = yield* getSelectedChoice(db, {
      questionId: input.questionId,
      selectedOptionId: input.selectedOptionId,
    });

    return {
      isCorrect: selectedChoice.isCorrect,
      questionId: input.questionId,
      selectedOptionId: selectedChoice.optionKey,
      textAnswer: selectedChoice.label,
    };
  });
