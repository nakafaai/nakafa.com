import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { Schema } from "effect";

export const exerciseAnswerIoFailedCode = "EXERCISE_ANSWER_IO_FAILED";
export const invalidExerciseAnswerCode = "INVALID_ARGUMENT";
export const invalidExerciseQuestionCode = "INVALID_QUESTION";
export const questionNotFoundCode = "QUESTION_NOT_FOUND";

export type ExerciseAttemptAnswerContext = Pick<
  Doc<"exerciseAttempts">,
  "exerciseNumber" | "scope" | "slug"
>;

export type CanonicalExerciseAnswer = Pick<
  Doc<"exerciseAnswers">,
  "isCorrect" | "questionId" | "selectedOptionId" | "textAnswer"
>;

export interface ScoreExerciseAnswerInput {
  readonly attempt: ExerciseAttemptAnswerContext;
  readonly exerciseNumber: Doc<"exerciseAnswers">["exerciseNumber"];
  readonly questionId: NonNullable<Doc<"exerciseAnswers">["questionId"]>;
  readonly selectedOptionId: NonNullable<
    Doc<"exerciseAnswers">["selectedOptionId"]
  >;
}

/** Raised when Convex IO fails during server-side answer scoring. */
export class ExerciseAnswerIoError extends Schema.TaggedError<ExerciseAnswerIoError>()(
  "ExerciseAnswerIoError",
  {
    code: Schema.Literal(exerciseAnswerIoFailedCode),
    message: Schema.String,
  }
) {}

/** Raised when a selected option or exercise number is not valid for the answer. */
export class InvalidExerciseAnswerError extends Schema.TaggedError<InvalidExerciseAnswerError>()(
  "InvalidExerciseAnswerError",
  {
    code: Schema.Literal(invalidExerciseAnswerCode),
    message: Schema.String,
  }
) {}

/** Raised when a question exists but does not belong to the attempt. */
export class InvalidExerciseQuestionError extends Schema.TaggedError<InvalidExerciseQuestionError>()(
  "InvalidExerciseQuestionError",
  {
    code: Schema.Literal(invalidExerciseQuestionCode),
    message: Schema.String,
  }
) {}

/** Raised when the submitted question ID no longer exists. */
export class ExerciseQuestionNotFoundError extends Schema.TaggedError<ExerciseQuestionNotFoundError>()(
  "ExerciseQuestionNotFoundError",
  {
    code: Schema.Literal(questionNotFoundCode),
    message: Schema.String,
  }
) {}

export type ExerciseAnswerScoringError =
  | ExerciseAnswerIoError
  | ExerciseQuestionNotFoundError
  | InvalidExerciseAnswerError
  | InvalidExerciseQuestionError;
